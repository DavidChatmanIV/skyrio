import React from "react";
import { Modal } from "antd";
import { Plane, Gift, Trophy } from "lucide-react";

// "Turn on rewards?" — one clear choice instead of a switch + Save.
// "Turn on rewards" calls onConfirm(true); "Not now" closes (asks again later,
// same as before). Purple glass to match the rest of Skyrio.

const CSS = `
.rw-optin .ant-modal-content {
  position: relative; overflow: hidden; padding: 26px 24px 22px !important;
  background: linear-gradient(160deg, rgba(74,40,112,0.97), rgba(30,16,56,0.98)) !important;
  border: 1px solid rgba(255,255,255,0.16); border-radius: 22px !important;
  box-shadow: 0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1) !important;
  color: #fff; font-family: "DM Sans", system-ui, sans-serif;
}
.rw-optin .ant-modal-content::before {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
  background: linear-gradient(90deg, #ff8a2a, #ffb347 40%, #7c5cfc);
}
.rw-optin .ant-modal-close { color: rgba(255,255,255,0.6) !important; }
.rw-optin .ant-modal-close:hover { color: #fff !important; background: rgba(255,255,255,0.08) !important; }
.rw-badge { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); box-shadow: 0 10px 26px rgba(255,138,42,0.35); }
.rw-title { margin: 14px 0 4px; font-family: "Syne", "DM Sans", sans-serif; font-size: 22px; font-weight: 800; color: #fff; }
.rw-sub { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: rgba(255,255,255,0.78); }
.rw-list { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 10px; }
.rw-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.45; color: rgba(255,255,255,0.88); }
.rw-list svg { flex-shrink: 0; margin-top: 1px; color: #ffb347; }
.rw-fine { margin: 0 0 18px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.55); }
.rw-btns { display: flex; gap: 10px; }
.rw-btn { flex: 1; min-height: 46px; border-radius: 999px; font: 800 15px "DM Sans", sans-serif; cursor: pointer; }
.rw-btn--main { border: 0; color: #1a0e06; background: linear-gradient(135deg, #ff8a2a, #ffb347); box-shadow: 0 10px 26px rgba(255,138,42,0.3); }
.rw-btn--main:hover { filter: brightness(1.06); }
.rw-btn--ghost { color: #fff; background: transparent; border: 1px solid rgba(255,255,255,0.28); }
.rw-btn--ghost:hover { border-color: #ffb347; color: #ffb347; }
.rw-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (max-width: 380px) { .rw-btns { flex-direction: column-reverse; } }
`;

export default function RewardsOptInPrompt({ open, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      className="rw-optin"
      aria-labelledby="rw-optin-title"
    >
      <style>{CSS}</style>
      <span className="rw-badge" aria-hidden="true">
        <Gift size={24} />
      </span>
      <h2 className="rw-title" id="rw-optin-title">
        Earn rewards as you travel
      </h2>
      <p className="rw-sub">
        Collect XP and spend it on perks. Optional. Booking works the same
        either way.
      </p>
      <ul className="rw-list">
        <li>
          <Plane size={17} aria-hidden="true" />
          XP for bookings, reviews and challenges
        </li>
        <li>
          <Gift size={17} aria-hidden="true" />
          Spend it on perks
        </li>
        <li>
          <Trophy size={17} aria-hidden="true" />
          Climb the Passport ranks
        </li>
      </ul>
      <p className="rw-fine">
        XP isn&apos;t cash and can&apos;t be used to pay for flights or hotels.
      </p>
      <div className="rw-btns">
        <button
          type="button"
          className="rw-btn rw-btn--ghost"
          onClick={onClose}
        >
          Not now
        </button>
        <button
          type="button"
          className="rw-btn rw-btn--main"
          onClick={() => onConfirm(true)}
        >
          Turn on rewards
        </button>
      </div>
    </Modal>
  );
}
