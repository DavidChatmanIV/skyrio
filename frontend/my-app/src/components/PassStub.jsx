import React from "react";

const QR_URL =
  "https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=https%3A%2F%2Fskyrio-iota.vercel.app&color=1a0800&bgcolor=ffffff&margin=4";

export default function PassStub() {
  return (
    <div className="sk-passStub" aria-hidden="true">
      <div className="sk-stubTop">
        <div className="sk-stubGate">SKYGATE A3</div>
      </div>
      <div className="sk-qrBox">
        <div className="sk-qr">
          <img
            src={QR_URL}
            alt="Scan to board Skyrio"
            width={110}
            height={110}
            loading="lazy"
            style={{ display: "block", borderRadius: 8 }}
          />
        </div>
        <div className="sk-qrHint">SCAN TO BOARD</div>
      </div>
      <div className="sk-stubBarcode">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="sk-bar" />
        ))}
      </div>
    </div>
  );
}