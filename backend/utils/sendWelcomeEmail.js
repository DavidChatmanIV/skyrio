import nodemailer from "nodemailer";

function createMailer() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendWelcomeEmail({ name, email }) {
  try {
    await createMailer().sendMail({
      from: `"Skyrio" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✦ Welcome to Skyrio, ${name}! Your Passport is ready.`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:0;background:#09071a;color:#fff;border-radius:16px;overflow:hidden">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1a0d2e 0%,#0d0b1a 100%);padding:40px 32px 32px;text-align:center;border-bottom:1px solid rgba(255,138,42,0.2)">
            <div style="font-size:36px;margin-bottom:12px">✦</div>
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#fff;margin-bottom:4px">
              Welcome to Skyrio
            </div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5)">
              Your AI travel companion is ready
            </div>
          </div>

          <!-- Body -->
          <div style="padding:32px">
            <p style="font-size:16px;color:rgba(255,255,255,0.85);margin:0 0 8px">
              Hey ${name} 👋
            </p>
            <p style="font-size:14px;color:rgba(255,255,255,0.55);margin:0 0 28px;line-height:1.6">
              You just unlocked something most travelers don't have — a smarter way to plan, save, and book every trip. Your Skyrio Passport is active and your XP journey starts now.
            </p>

            <!-- Passport card -->
            <div style="background:linear-gradient(135deg,rgba(124,58,237,0.3) 0%,rgba(255,138,42,0.2) 100%);border:1px solid rgba(255,138,42,0.3);border-radius:16px;padding:24px;margin-bottom:28px;text-align:center">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px">
                SKYRIO PASSPORT
              </div>
              <div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:4px">
                ${name}
              </div>
              <div style="display:inline-block;background:rgba(255,138,42,0.15);border:1px solid rgba(255,138,42,0.3);border-radius:999px;padding:4px 16px;font-size:12px;font-weight:700;color:#ff8a2a;margin-bottom:16px">
                ✦ Explorer · Level 1
              </div>
              <div style="background:rgba(255,255,255,0.06);border-radius:999px;height:6px;overflow:hidden;margin:0 auto;max-width:200px">
                <div style="width:5%;height:100%;background:linear-gradient(90deg,#ff8a2a,#ffb347);border-radius:999px"></div>
              </div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:8px">0 XP · Keep going</div>
            </div>

            <!-- How to earn XP -->
            <div style="margin-bottom:28px">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:14px">
                How to earn XP
              </div>
              ${[
                { icon: "🔍", action: "Search for a trip", xp: "+10 XP" },
                { icon: "🧡", action: "Save a trip", xp: "+50 XP" },
                { icon: "✈️", action: "Book a flight", xp: "+200 XP" },
              ]
                .map(
                  ({ icon, action, xp }) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:8px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:16px">${icon}</span>
                    <span style="font-size:13px;color:rgba(255,255,255,0.7)">${action}</span>
                  </div>
                  <span style="font-size:13px;font-weight:700;color:#ff8a2a">${xp}</span>
                </div>
              `
                )
                .join("")}
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin-bottom:28px">
              <a href="https://skyrio-iota.vercel.app"
                style="display:inline-block;background:linear-gradient(135deg,#ff8a2a,#ffb347);color:#1a0d04;padding:15px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.01em">
                Start planning your first trip →
              </a>
            </div>

            <!-- What's next -->
            <div style="background:rgba(255,138,42,0.06);border:1px solid rgba(255,138,42,0.15);border-radius:12px;padding:20px;margin-bottom:28px">
              <div style="font-size:12px;font-weight:700;color:#ff8a2a;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">
                What's waiting for you
              </div>
              ${[
                "Ask Atlas anything — flights, hotels, budget, vibes",
                "Build a trip plan in seconds with AI",
                "Unlock badges as you explore more destinations",
                "Earn rewards redeemable on future bookings",
              ]
                .map(
                  (item) => `
                <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
                  <span style="color:#ff8a2a;font-size:12px;margin-top:2px">✦</span>
                  <span style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.5">${item}</span>
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Footer -->
          <div style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
            <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:4px">Skyrio ✦</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.25);margin-bottom:12px">
              The smarter way to travel
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.2)">
              Questions? Reply to this email or visit
              <a href="https://skyrio-iota.vercel.app" style="color:rgba(255,138,42,0.6);text-decoration:none">skyrio-iota.vercel.app</a>
            </div>
          </div>

        </div>
      `,
    });
    console.log(`📧 Welcome email sent to ${email}`);
  } catch (err) {
    console.error("❌ Welcome email failed:", err.message);
  }
}
