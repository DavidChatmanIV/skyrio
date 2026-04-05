import React from "react";
import "@/styles/DmPage.css";

const inbox = [
  {
    id: 1,
    name: "Maya",
    handle: "@maya.travels",
    preview: "Kyoto looks better than Osaka...",
    time: "9:12 AM",
    unread: 2,
    active: true,
  },
  {
    id: 2,
    name: "Jordan",
    handle: "@jordangoes",
    preview: "Hotel vote tonight?",
    time: "Yesterday",
    unread: 0,
    active: false,
  },
  {
    id: 3,
    name: "Sierra",
    handle: "@sierraroute",
    preview: "I found a better flight bundle",
    time: "Mon",
    unread: 1,
    active: false,
  },
];

export default function DmPage() {
  return (
    <div className="dmPage">
      <div className="dmHero">
        <h2>DMs</h2>
        <p>
          Smooth launch inbox with chat preview, ready for backend wiring next.
        </p>
      </div>

      <div className="dmGrid">
        <section className="glassCard dmInboxPanel">
          <h3>Inbox</h3>
          <input className="dmSearch" placeholder="Search chats" />

          <div className="dmList">
            {inbox.map((chat) => (
              <div
                key={chat.id}
                className={`dmRow ${chat.active ? "active" : ""}`}
              >
                <div className="dmAvatar">{chat.name[0]}</div>

                <div className="dmMeta">
                  <div className="dmTopRow">
                    <strong>{chat.name}</strong>
                    <span>{chat.time}</span>
                  </div>

                  <div className="dmHandle">{chat.handle}</div>
                  <div className="dmPreview">{chat.preview}</div>
                </div>

                {!!chat.unread && <div className="dmUnread">{chat.unread}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="glassCard dmChatPanel">
          <div className="dmChatHeader">
            <div>
              <h3>Maya</h3>
              <p>@maya.travels • Online</p>
            </div>

            <button className="dmGhostBtn">View Profile</button>
          </div>

          <div className="dmMessages">
            <div className="dmBubble incoming">
              You still thinking Japan in April?
              <span>9:05 AM</span>
            </div>

            <div className="dmBubble outgoing">
              Yeah, I want Tokyo and Kyoto minimum
              <span>9:07 AM</span>
            </div>

            <div className="dmBubble incoming">
              Kyoto looks better than Osaka for the first stop
              <span>9:12 AM</span>
            </div>
          </div>

          <div className="dmComposer">
            <input placeholder="Type a message..." />
            <button>Send</button>
          </div>
        </section>
      </div>
    </div>
  );
}