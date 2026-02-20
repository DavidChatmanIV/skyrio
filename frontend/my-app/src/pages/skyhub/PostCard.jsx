import React from "react";

export default function PostCard({
  post,
  onLike = () => {},
  onComment = () => {},
  onShare = () => {},
  onSave = () => {},
  liked = false,
  saved = false,
}) {
  if (!post) return null;

  const {
    name = "Traveler",
    handle = "@traveler",
    time = "now",
    place = "",
    text = "",
    verified = false,
    images = [],
  } = post;

  const imgs = Array.isArray(images) ? images.filter(Boolean) : [];
  const hasGrid = imgs.length >= 2;

  return (
    <article className="skyhub-post">
      <header className="skyhub-postHeader">
        <div className="skyhub-user">
          <div className="skyhub-avatarBubble" aria-hidden="true" />

          <div className="skyhub-userMeta">
            <div className="skyhub-nameRow">
              <div className="skyhub-name" title={name}>
                {name}
              </div>
              {verified ? <span className="skyhub-verifiedDot" /> : null}
              <span className="skyhub-dot">•</span>
              <span className="skyhub-time">{time}</span>
            </div>

            <div className="skyhub-subRow">
              <span className="skyhub-handle">{handle}</span>
              {place ? (
                <>
                  <span className="skyhub-dot">•</span>
                  <span className="skyhub-place" title={place}>
                    {place}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <button className="skyhub-moreBtn skyhub-actionBtn" type="button" aria-label="More">
          •••
        </button>
      </header>

      {imgs.length > 0 ? (
        <div className="skyhub-mediaEdge">
          {hasGrid ? (
            <div className="skyhub-imgGrid">
              <img className="skyhub-img" src={imgs[0]} alt="" />
              <img className="skyhub-img" src={imgs[1]} alt="" />
            </div>
          ) : (
            <img className="skyhub-img" src={imgs[0]} alt="" />
          )}
        </div>
      ) : null}

      {(handle || text) && (
        <div className="skyhub-caption">
          {text ? <div className="skyhub-text">{text}</div> : null}
        </div>
      )}

      <div className="skyhub-actionsRow">
        <button
          className={`skyhub-actionBtn ${liked ? "is-on" : ""}`}
          type="button"
          onClick={onLike}
        >
          ❤️ Like
        </button>

        <button className="skyhub-actionBtn" type="button" onClick={onComment}>
          💬 Comment
        </button>

        <button className="skyhub-actionBtn" type="button" onClick={onShare}>
          ↗️ Share
        </button>

        <div className="skyhub-actionsSpacer" />

        <button
          className={`skyhub-savePill ${saved ? "is-on" : ""}`}
          type="button"
          onClick={onSave}
        >
          💾 Save
        </button>
      </div>
    </article>
  );
}