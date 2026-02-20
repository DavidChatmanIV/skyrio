import React from "react";

export default function DmPage() {
  return (
    <section className="skyhub-feed">
      <div className="skyhub-frame">
        <div className="skyhub-panelTitle">DMs</div>
        <div className="skyhub-panelSub">
          Launch version: simple inbox + chat next.
        </div>

        <div className="skyhub-empty">
          No messages yet.
          <div className="skyhub-emptyHint">
            When you launch, this becomes your WhatsApp-smooth chat.
          </div>
        </div>
      </div>
    </section>
  );
}