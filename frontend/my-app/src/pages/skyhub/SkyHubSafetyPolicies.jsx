import React from "react";

/* ─────────────────────────────────────────────────────────────
   SkyHubSafetyPolicies — rendered inside SkyHubGuidelines.jsx.
   Each section has an id so links like /skyhub/guidelines#meetups work.
   Have a lawyer review the wording before launch.
───────────────────────────────────────────────────────────── */

const box = {
  padding: "18px 20px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(240,236,255,0.82)",
  lineHeight: 1.6,
  fontSize: 14.5,
  scrollMarginTop: 100,
};
const h = {
  color: "#fff",
  fontFamily: "'Sora',sans-serif",
  fontSize: 17,
  margin: "0 0 8px",
};
const a = { color: "#ff9555", fontWeight: 600 };
const ul = { margin: "8px 0 0", paddingLeft: 20 };

export default function SkyHubSafetyPolicies() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section id="how-reports-work" style={box}>
        <h3 style={h}>How reports work</h3>
        Reports are anonymous. The person you report isn't told who reported
        them.
        <ul style={ul}>
          <li>
            <b>Hidden right away:</b> anything involving a child's safety, and
            intimate images shared without consent. We hide these on the first
            report and review them first.
          </li>
          <li>
            <b>Reviewed first:</b> threats, hate speech, harassment and
            self-harm.
          </li>
          <li>
            <b>Everything else:</b> hidden for review once several different
            travelers report it.
          </li>
        </ul>
        <p style={{ margin: "10px 0 0" }}>
          If we hide or remove something you posted, we'll tell you which
          guideline it broke. Strikes can be appealed from your account standing
          page within 30 days.
        </p>
      </section>

      <section id="child-safety" style={box}>
        <h3 style={h}>Child safety: zero tolerance</h3>
        We remove any content that sexualizes or endangers a minor, permanently
        ban the account, and report it to the National Center for Missing &amp;
        Exploited Children (NCMEC), as US law requires. If a child is in
        immediate danger, call 911. You can also report directly at{" "}
        <a
          style={a}
          href="https://report.cybertip.org"
          target="_blank"
          rel="noreferrer"
        >
          report.cybertip.org
        </a>
        .
      </section>

      <section id="intimate-images" style={box}>
        <h3 style={h}>Intimate images shared without consent</h3>
        Sharing a nude or sexual image of someone without their consent,
        including AI-generated or edited ones, is never allowed on SkyHub. If
        it's an image of you, send a{" "}
        <a style={a} href="/skyhub/report-content">
          removal request
        </a>
        . You don't need an account. We remove valid requests within 48 hours,
        along with copies of the same image. Sharing this content leads to a
        permanent ban.
      </section>

      <section id="support" style={box}>
        <h3 style={h}>If you or someone you know is struggling</h3>
        If a post makes you worried someone might hurt themselves, report it as
        "Someone may hurt themselves." We'll reach out to them with support, not
        a penalty.
        <ul style={ul}>
          <li>
            US: call or text <b>988</b> (Suicide &amp; Crisis Lifeline), any
            time.
          </li>
          <li>
            Outside the US:{" "}
            <a
              style={a}
              href="https://findahelpline.com"
              target="_blank"
              rel="noreferrer"
            >
              findahelpline.com
            </a>
          </li>
          <li>
            If someone is in immediate danger, call your local emergency number.
          </li>
        </ul>
      </section>

      <section id="meetups" style={box}>
        <h3 style={h}>Meeting travelers safely</h3>
        Sometimes travelers you meet on SkyHub want to meet up in person, so a
        little care goes a long way:
        <ul style={ul}>
          <li>
            Meet somewhere public for the first time, like a café, a tour or a
            hostel common room.
          </li>
          <li>Tell a friend where you're going and who you're meeting.</li>
          <li>
            Keep your hotel name, room number and travel documents to yourself.
          </li>
          <li>
            Never send money or deposits to someone you met on SkyHub. Book
            tours through Skyrio or the provider.
          </li>
          <li>
            If something happens offline, report the traveler from their
            profile. We take it seriously.
          </li>
        </ul>
      </section>

      <section id="promotions" style={box}>
        <h3 style={h}>Businesses, promotions and reviews</h3>
        Share real experiences only. If you were paid, got a free stay or tour,
        or work for the business, say so in your post. Fake reviews, fake tour
        listings and posts that ask for payment outside Skyrio are removed, and
        the account may be banned.
      </section>

      <section id="copyright" style={box}>
        <h3 style={h}>Copyright</h3>
        Only post photos and writing you own or have permission to share.
        Copyright owners can send a DMCA notice through our{" "}
        <a style={a} href="/skyhub/report-content?kind=copyright">
          removal request form
        </a>
        . If your post is removed and you believe it was a mistake, you can send
        a counter-notice. Accounts with repeated valid copyright complaints are
        permanently banned.
        <p style={{ margin: "10px 0 0", fontSize: 13, opacity: 0.75 }}>
          Designated DMCA agent: Skyrio LLC, [address], [email].{" "}
          {/* ← fill in after registering at copyright.gov/dmca-directory */}
        </p>
      </section>
    </div>
  );
}
