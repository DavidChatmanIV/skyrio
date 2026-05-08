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

export async function sendBookingConfirmationEmail({
  name,
  email,
  origin,
  destination,
  departDate,
  returnDate,
  airline,
  total,
  bookingId,
}) {
  try {
    await createMailer().sendMail({
      from: `"Skyrio" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✈️ Booking Confirmed — ${origin} → ${destination}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#09071a;color:#fff;border-radius:16px">
          <h2 style="color:#ff8a2a;margin-bottom:4px">You're booked! ✈️</h2>
          <p style="color:rgba(255,255,255,0.6);margin-top:0">Hi ${name}, your flight has been confirmed.</p>

          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin:20px 0">
            <div style="font-size:22px;font-weight:700;margin-bottom:8px">
              ${origin} → ${destination}
            </div>
            <div style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:4px">
              ✈️ ${airline || "Your airline"}
            </div>
            <div style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:4px">
              📅 Depart: ${departDate || "TBD"}
            </div>
            ${
              returnDate
                ? `<div style="color:rgba(255,255,255,0.6);font-size:14px">🔄 Return: ${returnDate}</div>`
                : ""
            }
          </div>

          <div style="background:rgba(255,138,42,0.12);border:1px solid rgba(255,138,42,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
            <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:4px">Total charged</div>
            <div style="font-size:24px;font-weight:700;color:#ff8a2a">$${Number(
              total || 0
            ).toFixed(2)}</div>
          </div>

          ${
            bookingId
              ? `<div style="font-size:12px;color:rgba(255,255,255,0.3);margin-bottom:20px">Booking ID: ${bookingId}</div>`
              : ""
          }

          <a href="https://skyrio-iota.vercel.app/saved-trips"
            style="display:inline-block;background:linear-gradient(135deg,#ff8a2a,#ffb066);color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            View your trips →
          </a>

          <p style="margin-top:32px;color:rgba(255,255,255,0.3);font-size:12px">
            Questions? Reply to this email or visit skyrio-iota.vercel.app
          </p>
        </div>
      `,
    });
    console.log(`📧 Booking confirmation sent to ${email}`);
  } catch (err) {
    console.error("❌ Booking confirmation email failed:", err.message);
  }
}
