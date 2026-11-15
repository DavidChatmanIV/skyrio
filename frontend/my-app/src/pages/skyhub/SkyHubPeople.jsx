// People pop-ups on SkyHub:
//  - ProfileCard: tap a traveler's name → who they are, places they post
//    about, Follow, and "Open Passport".
//  - LikesList: tap "Liked by …" → everyone who liked the post (public,
//    like Twitter/Threads/Bluesky). Saves stay private (count only).
import React, { useEffect, useState } from "react";
import { Modal } from "antd";

const AV_BG = [
  "linear-gradient(135deg,#ff7a35,#c94f10)",
  "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  "linear-gradient(135deg,#10b981,#065f46)",
  "linear-gradient(135deg,#f59e0b,#b45309)",
];

export function PersonAvatar({ name, src, size = 44 }) {
  const [broken, setBroken] = useState(false);
  if (src && /^https?:\/\//.test(src) && !broken)
    return (
      <img
        src={src}
        alt=""
        className="shPpl__av"
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  const n = name || "T";
  return (
    <span
      aria-hidden="true"
      className="shPpl__av"
      style={{ width: size, height: size, background: AV_BG[n.charCodeAt(0) % AV_BG.length], fontSize: size * 0.36 }}
    >
      {n.slice(0, 2).toUpperCase()}
    </span>
  );
}

function FollowBtn({ following, onClick, name }) {
  return (
    <button
      type="button"
      className={`shPpl__follow${following ? " is-on" : ""}`}
      aria-pressed={following}
      aria-label={following ? `Following ${name}` : `Follow ${name}`}
      onClick={onClick}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

/** userId → quick profile card. */
export function ProfileCard({ userId, fetcher, onClose, onFollow, onOpenPassport }) {
  const [card, setCard] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    setCard(null);
    setFailed(false);
    fetcher(`/api/skyhub/users/${userId}/card`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setCard(d);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [userId, fetcher]);

  const follow = async () => {
    const now = await onFollow?.({ authorId: card.id, author: card.name });
    if (typeof now === "boolean") setCard((c) => ({ ...c, following: now }));
  };

  return (
    <Modal open={!!userId} onCancel={onClose} footer={null} className="skyhub-modal shPpl" destroyOnHidden title={null}>
      {failed ? (
        <p className="shPpl__msg">Couldn&apos;t load this traveler. Try again.</p>
      ) : !card ? (
        <p className="shPpl__msg">Loading…</p>
      ) : (
        <div className="shPpl__card">
          <div className="shPpl__head">
            <PersonAvatar name={card.name} src={card.avatar} size={64} />
            <div className="shPpl__who">
              <div className="shPpl__name">{card.name}</div>
              <div className="shPpl__sub">
                {card.username ? `@${card.username}` : ""}
                {card.badge && <span className="shPpl__badge">{card.badge}</span>}
              </div>
              {card.city && <div className="shPpl__city">{card.city}</div>}
            </div>
          </div>
          <div className="shPpl__stats">
            <div>
              <b>{card.posts}</b>
              <span>post{card.posts === 1 ? "" : "s"}</span>
            </div>
            <div>
              <b>{card.followers}</b>
              <span>follower{card.followers === 1 ? "" : "s"}</span>
            </div>
          </div>
          {card.places?.length > 0 && (
            <div className="shPpl__places">
              <span className="shPpl__label">Posts about</span>
              <div className="shPpl__chips">
                {card.places.map((p) => (
                  <span key={p} className="shPpl__chip">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="shPpl__actions">
            {!card.isMe && onFollow && (
              <FollowBtn following={card.following} onClick={follow} name={card.name} />
            )}
            {card.username && (
              <button type="button" className="shPpl__open" onClick={() => onOpenPassport?.(card.username)}>
                Open Passport
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** postId → everyone who liked it. */
export function LikesList({ postId, fetcher, onClose, onOpenProfile, onFollow }) {
  const [people, setPeople] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!postId) return undefined;
    let alive = true;
    setPeople(null);
    setFailed(false);
    fetcher(`/api/skyhub/posts/${postId}/likes`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setPeople(d.people || []);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [postId, fetcher]);

  const follow = async (p) => {
    const now = await onFollow?.({ authorId: p.id, author: p.name });
    if (typeof now === "boolean")
      setPeople((list) => list.map((x) => (x.id === p.id ? { ...x, following: now } : x)));
  };

  return (
    <Modal open={!!postId} onCancel={onClose} footer={null} className="skyhub-modal shPpl" destroyOnHidden title="Liked by">
      {failed ? (
        <p className="shPpl__msg">Couldn&apos;t load likes. Try again.</p>
      ) : !people ? (
        <p className="shPpl__msg">Loading…</p>
      ) : !people.length ? (
        <p className="shPpl__msg">No likes yet.</p>
      ) : (
        <ul className="shPpl__list">
          {people.map((p) => (
            <li key={p.id} className="shPpl__row">
              <button type="button" className="shPpl__rowOpen" onClick={() => onOpenProfile?.(p.id)}>
                <PersonAvatar name={p.name} src={p.avatar} size={40} />
                <span className="shPpl__rowText">
                  <span className="shPpl__rowName">{p.isMe ? `${p.name} (you)` : p.name}</span>
                  {p.username && <span className="shPpl__rowSub">@{p.username}</span>}
                </span>
              </button>
              {!p.isMe && onFollow && <FollowBtn following={p.following} onClick={() => follow(p)} name={p.name} />}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
