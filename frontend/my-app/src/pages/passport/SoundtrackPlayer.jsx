import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Travel Soundtrack player (YouTube)
//
// autoPlay = true (use on public profiles, /u/:username):
//   1. Tries to start with sound. Works when the visitor has already
//      clicked somewhere on Skyrio (e.g. came from search or a followers list).
//   2. If the browser blocks sound (fresh visit from a shared link),
//      it plays muted and shows "Tap for sound". The first tap/click/key
//      anywhere on the page turns the sound on.
//   3. If a visitor pauses a soundtrack, Skyrio remembers it and stops
//      autoplaying on other profiles until they press play again.
//
// Leaving the page stops the music (the player is destroyed on unmount).
// ─────────────────────────────────────────────────────────────

const PREF_KEY = "skyrio_profile_music_autoplay"; // "off" = visitor opted out
const VOLUME = 40;

const SP_CSS = `
.sp { font-family: "DM Sans", system-ui, sans-serif; color: #fff; }
.sp-row { display: flex; align-items: center; gap: 14px; }
.sp-cover { width: 64px; height: 64px; border-radius: 12px; flex-shrink: 0; background: #1a1430 center/cover no-repeat;
  border: 1px solid rgba(255,255,255,0.1); }
.sp-meta { flex: 1; min-width: 0; }
.sp-kicker { font: 600 10.5px "JetBrains Mono", ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase;
  color: rgba(255,179,71,0.85); }
.sp-title { margin-top: 3px; font-size: 16px; font-weight: 700; line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-sub { margin-top: 2px; font-size: 12.5px; color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 8px; }
.sp-btn { width: 42px; height: 42px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; cursor: pointer; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #fff; }
.sp-btn:hover { background: rgba(255,255,255,0.12); }
.sp-btn--main { width: 48px; height: 48px; border: 0; color: #1b1030;
  background: linear-gradient(135deg, #ffb347, #ff8a2a); box-shadow: 0 6px 18px rgba(255,138,42,0.35); }
.sp-btn--main:hover { filter: brightness(1.06); background: linear-gradient(135deg, #ffb347, #ff8a2a); }
.sp-btn:disabled { opacity: .5; cursor: default; }
.sp-bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 12px; }
.sp-bars i { width: 3px; border-radius: 2px; background: #ffb347; height: 4px; }
.sp-bars.is-on i { animation: spBar .9s ease-in-out infinite; }
.sp-bars.is-on i:nth-child(2) { animation-delay: .15s; }
.sp-bars.is-on i:nth-child(3) { animation-delay: .3s; }
.sp-bars.is-on i:nth-child(4) { animation-delay: .45s; }
.sp-pill { display: inline-flex; align-items: center; gap: 7px; margin-top: 12px; min-height: 36px; padding: 0 14px;
  border-radius: 999px; cursor: pointer; border: 1px solid rgba(255,138,42,0.5); background: rgba(255,138,42,0.14);
  color: #ffb347; font: 700 13px "DM Sans", system-ui, sans-serif; animation: spPulse 2s ease-in-out infinite; }
.sp-video { margin-top: 12px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,138,42,0.2);
  aspect-ratio: 16 / 9; max-height: 220px; background: #000; }
.sp-video iframe, .sp-video > div { width: 100%; height: 100%; display: block; border: 0; }
.sp-err { margin-top: 12px; padding: 12px 14px; border-radius: 10px; font-size: 13px; text-align: center;
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.65); }
.sp :focus-visible { outline: 2px solid #ff8a2a; outline-offset: 2px; }
@keyframes spBar { 0%,100% { height: 4px; } 50% { height: 12px; } }
@keyframes spPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,138,42,0.35); } 50% { box-shadow: 0 0 0 6px rgba(255,138,42,0); } }
@media (prefers-reduced-motion: reduce) { .sp-bars.is-on i, .sp-pill { animation: none; } }
`;

// ── YouTube helpers ─────────────────────────────────────────
export function getYouTubeId(url) {
  try {
    if (!url) return null;
    const u = new URL(url);
    if (u.hostname.includes("youtu.be"))
      return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

let ytApiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => {
        ytApiPromise = null;
        reject(new Error("YouTube API failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return ytApiPromise;
}

const readPref = () => {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
};
const writePref = (on) => {
  try {
    if (on) localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, "off");
  } catch {}
};

/**
 * props:
 *  url        YouTube link (watch, youtu.be, shorts, embed)
 *  name       song / playlist name
 *  artworkUrl optional cover image (falls back to the video thumbnail)
 *  autoPlay   true on public profiles, false on your own passport
 *  label      small heading, default "Travel Soundtrack"
 */
export default function SoundtrackPlayer({
  url,
  name,
  artworkUrl,
  autoPlay = false,
  label = "Travel Soundtrack",
}) {
  const videoId = getYouTubeId(url);
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | playing | paused | error
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false); // playing muted, waiting for a tap

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    let checkTimer;
    const shouldAutoplay = autoPlay && readPref();

    const unlockEvents = ["pointerdown", "keydown", "touchstart"];
    const unlock = () => {
      const p = playerRef.current;
      if (!p) return;
      p.unMute?.();
      p.setVolume?.(VOLUME);
      p.playVideo?.();
      setMuted(false);
      setNeedsTap(false);
      removeUnlock();
    };
    const removeUnlock = () =>
      unlockEvents.forEach((e) => window.removeEventListener(e, unlock, true));

    setStatus("loading");
    setNeedsTap(false);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        const mount = document.createElement("div");
        hostRef.current.innerHTML = "";
        hostRef.current.appendChild(mount);

        playerRef.current = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              e.target.setVolume(VOLUME);
              setStatus("ready");
              if (!shouldAutoplay) return;

              // 1) try with sound
              e.target.unMute();
              e.target.playVideo();

              // 2) if the browser blocked it, play muted + wait for a tap
              checkTimer = setTimeout(() => {
                if (cancelled) return;
                const st = e.target.getPlayerState?.();
                if (
                  st !== YT.PlayerState.PLAYING &&
                  st !== YT.PlayerState.BUFFERING
                ) {
                  e.target.mute();
                  e.target.playVideo();
                  setMuted(true);
                  setNeedsTap(true);
                  unlockEvents.forEach((ev) =>
                    window.addEventListener(ev, unlock, {
                      capture: true,
                      once: true,
                    })
                  );
                }
              }, 1200);
            },
            onStateChange: (e) => {
              if (cancelled) return;
              if (e.data === YT.PlayerState.PLAYING) setStatus("playing");
              else if (
                e.data === YT.PlayerState.PAUSED ||
                e.data === YT.PlayerState.ENDED
              )
                setStatus("paused");
              setMuted(!!e.target.isMuted?.());
            },
            onError: () => !cancelled && setStatus("error"),
          },
        });
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
      clearTimeout(checkTimer);
      removeUnlock();
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, [videoId, autoPlay]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (status === "playing") {
      p.pauseVideo();
      if (autoPlay) writePref(false); // visitor doesn't want profile music
    } else {
      if (needsTap || p.isMuted?.()) {
        p.unMute();
        setMuted(false);
        setNeedsTap(false);
      }
      p.setVolume(VOLUME);
      p.playVideo();
      writePref(true);
    }
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) {
      p.unMute();
      p.setVolume(VOLUME);
      setMuted(false);
      setNeedsTap(false);
    } else {
      p.mute();
      setMuted(true);
    }
  };

  if (!videoId) return null;

  const cover = artworkUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const playing = status === "playing";
  const busy = status === "loading";

  return (
    <div className="sp">
      <style>{SP_CSS}</style>

      <div className="sp-row">
        <div
          className="sp-cover"
          style={{ backgroundImage: `url(${cover})` }}
          aria-hidden="true"
        />
        <div className="sp-meta">
          <div className="sp-kicker">{label}</div>
          <div className="sp-title">{name || "My Playlist"}</div>
          <div className="sp-sub">
            <span
              className={`sp-bars${playing && !muted ? " is-on" : ""}`}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <i />
            </span>
            {busy
              ? "Loading…"
              : status === "error"
              ? "Unavailable"
              : playing
              ? muted
                ? "Playing (muted)"
                : "Now playing"
              : "Tap to play"}
          </div>
        </div>

        {playing && (
          <button
            type="button"
            className="sp-btn"
            onClick={toggleMute}
            aria-label={muted ? "Unmute soundtrack" : "Mute soundtrack"}
          >
            {muted ? (
              <VolumeX size={18} aria-hidden="true" />
            ) : (
              <Volume2 size={18} aria-hidden="true" />
            )}
          </button>
        )}
        <button
          type="button"
          className="sp-btn sp-btn--main"
          onClick={togglePlay}
          disabled={busy || status === "error"}
          aria-label={playing ? "Pause soundtrack" : "Play soundtrack"}
        >
          {playing ? (
            <Pause size={20} aria-hidden="true" />
          ) : (
            <Play size={20} aria-hidden="true" style={{ marginLeft: 2 }} />
          )}
        </button>
      </div>

      {needsTap && (
        <button type="button" className="sp-pill" onClick={toggleMute}>
          <Volume2 size={15} aria-hidden="true" />
          Tap for sound
        </button>
      )}

      {status === "error" ? (
        <div className="sp-err">
          This song can't be played here. It may be private or blocked from
          embedding.
        </div>
      ) : (
        <div className="sp-video" ref={hostRef} />
      )}
    </div>
  );
}
