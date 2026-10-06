import fs from "fs";
import path from "path";

const SRC = path.resolve("src");
if (!fs.existsSync(SRC)) {
  console.error("✗ No src/ folder here. cd into frontend/my-app first.");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const all = walk(SRC);
const targets = all.filter((f) => /BookingCheckout/i.test(path.basename(f)));
if (!targets.length) {
  console.error("✗ Couldn't find BookingCheckout.jsx under src/.");
  process.exit(1);
}

const oldUi = all.filter((f) => fs.readFileSync(f, "utf8").includes("Payments securely processed by Stripe"));
console.log("Files that still render the old Stripe box:");
oldUi.forEach((f) => console.log("   " + path.relative(process.cwd(), f)));
console.log("");

const NEW_BLOCK = `{!fareExpired && !prebookError && clientSecret && (
            <>
              <LiteApiPayForm
                clientSecret={clientSecret}
                prebookId={prebookId}
                transactionId={transactionId}
                total={total}
                flight={flight}
                passengers={passengers}
                groupId={groupId}
                progressKey={progressKey}
                fareExpired={fareExpired}
                onBack={onBack}
              />
              <CancellationBadge departureDateISO={flight?.outbound?.dateISO} />
            </>
          )}`;

for (const file of targets) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("function StepReviewPay(")) continue;
  const rel = path.relative(process.cwd(), file);
  const results = [];
  const step = (name, fn) => {
    const before = src;
    try {
      src = fn(src);
      results.push(before === src ? `  • ${name}: already done` : `  ✓ ${name}`);
    } catch (e) {
      results.push(`  ✗ ${name}: ${e.message}`);
    }
  };

  step("remove Stripe imports + stripePromise", (s) =>
    s
      .replace(/import\s*\{\s*loadStripe\s*\}\s*from\s*["']@stripe\/stripe-js["'];?\r?\n/, "")
      .replace(/import\s*\{[^}]*\}\s*from\s*["']@stripe\/react-stripe-js["'];?\r?\n/, "")
      .replace(/const stripePromise\s*=\s*loadStripe\([^)]*\);?\r?\n/, "")
  );

  step("add LiteApiPayForm import", (s) => {
    if (/from\s*["']\.\/LiteApiPayForm["']/.test(s)) return s;
    const anchor = /import SkyrioSeatMap from ["']\.\/SkyrioSeatMap["'];?/;
    if (!anchor.test(s)) throw new Error("couldn't find the SkyrioSeatMap import to anchor on");
    return s.replace(anchor, (m) => `${m}\nimport LiteApiPayForm from "./LiteApiPayForm";`);
  });

  step("delete StripePayForm component", (s) => {
    const a = s.indexOf("function StripePayForm(");
    if (a === -1) return s;
    const b = s.indexOf("function StepReviewPay(", a);
    if (b === -1) throw new Error("StepReviewPay not found after StripePayForm");
    return s.slice(0, a) + s.slice(b);
  });

  step("swap <Elements> block for <LiteApiPayForm>", (s) => {
    const start = s.indexOf("{!fareExpired && !prebookError && clientSecret && (");
    if (start === -1) return s;
    const region = s.slice(start, start + 200);
    if (region.includes("<LiteApiPayForm") || region.includes("<>")) return s;
    const endEl = s.indexOf("</Elements>", start);
    if (endEl === -1) throw new Error("couldn't find </Elements>");
    const close = s.indexOf(")}", endEl);
    if (close === -1) throw new Error("couldn't find the closing )} after </Elements>");
    return s.slice(0, start) + NEW_BLOCK + s.slice(close + 2);
  });

  step("add progressKey to StepReviewPay props", (s) => {
    const i = s.indexOf("function StepReviewPay({");
    const sigEnd = s.indexOf("}) {", i);
    if (s.slice(i, sigEnd).includes("progressKey")) return s;
    return s.replace("function StepReviewPay({", "function StepReviewPay({\n  progressKey,");
  });

  step("pass progressKey into <StepReviewPay>", (s) => {
    const i = s.indexOf("<StepReviewPay");
    if (i === -1) throw new Error("<StepReviewPay> not rendered anywhere");
    const tagEnd = s.indexOf("/>", i);
    if (s.slice(i, tagEnd).includes("progressKey=")) return s;
    return s.slice(0, i) + "<StepReviewPay\n            progressKey={progressKey}" + s.slice(i + "<StepReviewPay".length);
  });

  const leftovers = ["useStripe", "useElements", "<Elements", "stripePromise", "PaymentElement", "StripePayForm"].filter((t) => src.includes(t));

  const dir = path.dirname(file);
  const sib = fs.readdirSync(dir).find((n) => n.toLowerCase() === "liteapipayform.jsx");
  let sibMsg;
  if (!sib) sibMsg = `  ✗ LiteApiPayForm.jsx is NOT in ${path.relative(process.cwd(), dir)}/ — move it there`;
  else if (sib !== "LiteApiPayForm.jsx") {
    fs.renameSync(path.join(dir, sib), path.join(dir, "LiteApiPayForm.jsx.tmp"));
    fs.renameSync(path.join(dir, "LiteApiPayForm.jsx.tmp"), path.join(dir, "LiteApiPayForm.jsx"));
    sibMsg = `  ✓ renamed ${sib} → LiteApiPayForm.jsx`;
  } else sibMsg = "  ✓ LiteApiPayForm.jsx found next to it";

  if (src !== fs.readFileSync(file, "utf8")) {
    fs.copyFileSync(file, file + ".bak");
    fs.writeFileSync(file, src);
  }

  console.log(rel);
  results.forEach((r) => console.log(r));
  console.log(sibMsg);
  console.log(leftovers.length ? `  ⚠ still mentions: ${leftovers.join(", ")}` : "  ✓ no old Stripe code left");
  console.log("");
}
console.log("Done. Restart Vite (Ctrl+C, npm run dev) and hard-refresh (Cmd+Shift+R).");
