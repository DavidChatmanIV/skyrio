import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use your verified domain, or Resend's test domain to start
const FROM_EMAIL = process.env.FROM_EMAIL || "Skyrio <onboarding@resend.dev>";
const APP_URL = process.env.FRONTEND_ORIGIN || "https://skyrio-iota.vercel.app";

/**
 * Send a trip invitation email
 */
export async function sendTripInvite({
  to,
  inviterName,
  tripTitle,
  destination,
  inviteCode,
  memberNames,
}) {
  const joinUrl = `${APP_URL}/sync-together/join/${inviteCode}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0520;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#ff8a2a;">✈ Skyrio</span>
    </div>
    <div style="background:linear-gradient(160deg,#1a0a2e 0%,#2d1057 50%,#1e0b35 100%);border-radius:20px;padding:36px 28px;border:1px solid rgba(255,138,42,0.15);">
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">
        You're invited to a group trip!
      </h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
        <strong style="color:#ff8a2a;">${inviterName}</strong> wants you to join a trip${
    destination ? ` to <strong style="color:#fff;">${destination}</strong>` : ""
  }.
      </p>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:20px;margin-bottom:24px;">
        <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">TRIP</div>
        <div style="color:#fff;font-size:18px;font-weight:700;margin-bottom:4px;">${
          tripTitle || "Untitled Trip"
        }${destination ? ` → ${destination}` : ""}</div>
        ${
          memberNames
            ? `<div style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:8px;">Travelers: ${memberNames}</div>`
            : ""
        }
      </div>
      <div style="text-align:center;">
        <a href="${joinUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#FF8A2A 0%,#FF6000 100%);color:#fff;text-decoration:none;border-radius:14px;font-size:16px;font-weight:700;box-shadow:0 4px 20px rgba(255,138,42,0.4);">
          View Trip & Join
        </a>
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:20px 0 0;">
        Or use invite code: <strong style="color:rgba(255,255,255,0.5);">${inviteCode}</strong>
      </p>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;">
        Sent by Skyrio · Plan smarter. Travel better.
      </p>
      <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:8px 0 0;">
        You received this because ${inviterName} added you to a group trip.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `${inviterName} invited you to a trip${
    destination ? ` to ${destination}` : ""
  } on Skyrio.

Trip: ${tripTitle || "Untitled Trip"}${destination ? ` -> ${destination}` : ""}
${memberNames ? `Travelers: ${memberNames}\n` : ""}
View and join: ${joinUrl}
Or use invite code: ${inviteCode}

Sent by Skyrio - Plan smarter. Travel better.`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `${inviterName} invited you to a trip${
        destination ? ` to ${destination}` : ""
      } on Skyrio`,
      html,
      text,
    });

    if (error) {
      console.error("[email] Send failed:", error);
      return { ok: false, error };
    }

    console.log(`[email] Invite sent to ${to} (id: ${data?.id})`);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send a notification that the plan is ready for review
 */
export async function sendPlanReady({
  to,
  tripTitle,
  destination,
  plannerName,
  groupUrl,
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0520;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#ff8a2a;">✈ Skyrio</span>
    </div>
    <div style="background:linear-gradient(160deg,#1a0a2e 0%,#2d1057 50%,#1e0b35 100%);border-radius:20px;padding:36px 28px;border:1px solid rgba(255,138,42,0.15);">
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">
        Your trip plan is ready!
      </h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
        <strong style="color:#ff8a2a;">${plannerName}</strong> generated a plan for
        <strong style="color:#fff;">${tripTitle}${
    destination ? ` → ${destination}` : ""
  }</strong>.
        Review it and approve!
      </p>
      <div style="text-align:center;">
        <a href="${groupUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#FF8A2A 0%,#FF6000 100%);color:#fff;text-decoration:none;border-radius:14px;font-size:16px;font-weight:700;box-shadow:0 4px 20px rgba(255,138,42,0.4);">
          Review Plan
        </a>
      </div>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;">Sent by Skyrio · Plan smarter. Travel better.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `${plannerName} generated a plan for ${tripTitle}${
    destination ? ` -> ${destination}` : ""
  }. Review it and approve!

Review the plan: ${groupUrl}

Sent by Skyrio - Plan smarter. Travel better.`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `Trip plan ready: ${tripTitle}${
        destination ? ` → ${destination}` : ""
      }`,
      html,
      text,
    });
    if (error) {
      console.error("[email] Plan ready send failed:", error);
      return { ok: false, error };
    }
    console.log(`[email] Plan ready sent to ${to}`);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Notify a member that a trip they were part of has been deleted
 */
export async function sendTripDeleted({
  to,
  tripTitle,
  destination,
  ownerName,
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0520;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#ff8a2a;">✈ Skyrio</span>
    </div>
    <div style="background:linear-gradient(160deg,#1a0a2e 0%,#2d1057 50%,#1e0b35 100%);border-radius:20px;padding:36px 28px;border:1px solid rgba(255,138,42,0.15);">
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">
        This trip has been cancelled
      </h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
        <strong style="color:#ff8a2a;">${ownerName}</strong> deleted
        <strong style="color:#fff;">${tripTitle || "Untitled Trip"}${
    destination ? ` → ${destination}` : ""
  }</strong>.
        There's nothing further you need to do — this trip no longer exists.
      </p>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;">Sent by Skyrio · Plan smarter. Travel better.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `${ownerName} deleted ${tripTitle || "Untitled Trip"}${
    destination ? ` -> ${destination}` : ""
  }.

There's nothing further you need to do - this trip no longer exists.

Sent by Skyrio - Plan smarter. Travel better.`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `Trip cancelled: ${tripTitle || "Untitled Trip"}`,
      html,
      text,
    });
    if (error) {
      console.error("[email] Trip deleted send failed:", error);
      return { ok: false, error };
    }
    console.log(`[email] Trip-deleted notice sent to ${to} (id: ${data?.id})`);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Notify a member that they were removed from a trip
 */
export async function sendMemberRemoved({
  to,
  tripTitle,
  destination,
  ownerName,
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0520;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#ff8a2a;">✈ Skyrio</span>
    </div>
    <div style="background:linear-gradient(160deg,#1a0a2e 0%,#2d1057 50%,#1e0b35 100%);border-radius:20px;padding:36px 28px;border:1px solid rgba(255,138,42,0.15);">
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">
        You've been removed from a trip
      </h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
        <strong style="color:#ff8a2a;">${ownerName}</strong> removed you from
        <strong style="color:#fff;">${tripTitle || "Untitled Trip"}${
    destination ? ` → ${destination}` : ""
  }</strong>.
        You won't receive further updates about this trip.
      </p>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;">Sent by Skyrio · Plan smarter. Travel better.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `${ownerName} removed you from ${tripTitle || "Untitled Trip"}${
    destination ? ` -> ${destination}` : ""
  }.

You won't receive further updates about this trip.

Sent by Skyrio - Plan smarter. Travel better.`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `You've been removed from ${tripTitle || "a trip"}`,
      html,
      text,
    });
    if (error) {
      console.error("[email] Member removed send failed:", error);
      return { ok: false, error };
    }
    console.log(
      `[email] Member-removed notice sent to ${to} (id: ${data?.id})`
    );
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordReset({ to, resetUrl }) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0520;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#ff8a2a;">✈ Skyrio</span>
    </div>
    <div style="background:linear-gradient(160deg,#1a0a2e 0%,#2d1057 50%,#1e0b35 100%);border-radius:20px;padding:36px 28px;border:1px solid rgba(255,138,42,0.15);">
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">
        Reset your password
      </h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
        Click the button below to reset your Skyrio password. This link expires in <strong style="color:#fff;">1 hour</strong>.
      </p>
      <div style="text-align:center;">
        <a href="${resetUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#FF8A2A 0%,#FF6000 100%);color:#fff;text-decoration:none;border-radius:14px;font-size:16px;font-weight:700;box-shadow:0 4px 20px rgba(255,138,42,0.4);">
          Reset Password
        </a>
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:24px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;">Sent by Skyrio · Plan smarter. Travel better.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Reset your Skyrio password.

Click the link below (expires in 1 hour):
${resetUrl}

If you didn't request this, you can safely ignore this email.

Sent by Skyrio - Plan smarter. Travel better.`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: "Reset your Skyrio password",
      html,
      text,
    });
    if (error) {
      console.error("[email] Password reset send failed:", error);
      return { ok: false, error };
    }
    console.log(`[email] Password reset sent to ${to} (id: ${data?.id})`);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send an email verification link
 */
export async function sendVerificationEmail({ to, verifyUrl }) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0520;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#ff8a2a;">✈ Skyrio</span>
    </div>
    <div style="background:linear-gradient(160deg,#1a0a2e 0%,#2d1057 50%,#1e0b35 100%);border-radius:20px;padding:36px 28px;border:1px solid rgba(255,138,42,0.15);">
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">
        Verify your email ✈️
      </h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
        Click below to verify your Skyrio account. This link expires in <strong style="color:#fff;">24 hours</strong>.
      </p>
      <div style="text-align:center;">
        <a href="${verifyUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#FF8A2A 0%,#FF6000 100%);color:#fff;text-decoration:none;border-radius:14px;font-size:16px;font-weight:700;box-shadow:0 4px 20px rgba(255,138,42,0.4);">
          Verify Email
        </a>
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:24px 0 0;">
        If you didn't create a Skyrio account, ignore this email.
      </p>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;">Sent by Skyrio · Plan smarter. Travel better.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Verify your Skyrio email.

Click the link below (expires in 24 hours):
${verifyUrl}

If you didn't create a Skyrio account, ignore this email.

Sent by Skyrio - Plan smarter. Travel better.`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: "Verify your Skyrio email",
      html,
      text,
    });
    if (error) {
      console.error("[email] Verification send failed:", error);
      return { ok: false, error };
    }
    console.log(`[email] Verification sent to ${to} (id: ${data?.id})`);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] Error:", err.message);
    return { ok: false, error: err.message };
  }
}
