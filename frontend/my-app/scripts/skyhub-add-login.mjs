// Makes every other SkyHub screen (comment drawer, destinations, travelers…)
// send your login with its requests, the same way SkyHubPage.jsx now does.
// Without it, commenting says "Please log in" even when you are.
//
// Run from frontend/my-app:  node scripts/skyhub-add-login.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const SKIP = new Set(["SkyHubPage.jsx", "AdminSkyHub.jsx", "SkyHubCommentDrawer.jsx", "SkyHubComposer.jsx", "SkyHubFeedCard.jsx"]);
const MARK = "/* skyhub-login */";
const HELPER = `${MARK}
const skyAuthFetch = (url, opts = {}) => {
  const token = localStorage.getItem("token");
  return fetch(url, {
    credentials: "include",
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: \`Bearer \${token}\` } : {}) },
  });
};
`;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name !== "node_modules") walk(p, out);
    } else if (/\.(jsx?|tsx?)$/.test(name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (SKIP.has(path.basename(file))) continue;
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("/api/skyhub")) continue;
  if (src.includes(MARK)) {
    console.log(`• already done: ${file}`);
    continue;
  }
  const replaced = src.replace(/(?<![\w.$])fetch\(/g, "skyAuthFetch(");
  if (replaced === src) continue;
  // Put the helper after the last import line.
  const imports = [...replaced.matchAll(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm)];
  const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
  src = replaced.slice(0, at) + "\n\n" + HELPER + replaced.slice(at);
  fs.writeFileSync(file, src);
  changed++;
  console.log(`✓ ${file}`);
}
console.log(changed ? `Done — updated ${changed} file(s).` : "Nothing needed updating.");
