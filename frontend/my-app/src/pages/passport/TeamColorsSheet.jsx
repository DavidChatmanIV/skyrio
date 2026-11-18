// Pick the Team Colors cover's two colors and sport, with a live preview of
// the passport. Presets are named by color only (no team names or logos);
// "Your own colors" takes any two colors.
import { useState } from "react";
import { Modal } from "antd";
import { Check, Loader2, Plane } from "lucide-react";
import "../../styles/passport-datapage.css";
import { TEAM_PRESETS, TEAM_PATTERNS, cleanTeam, teamCoverCss, teamKey, SportLines } from "./teamColors";

const CSS = `
.tcs { color: #fff; display: grid; gap: 16px; }
.tcs h3 { margin: 0 0 8px; font-size: 13px; font-weight: 800; letter-spacing: .04em; color: rgba(255,255,255,.85); }
.tcs-preview { height: 150px; border-radius: 16px; }
.tcs-preview .tcs-pName { padding: 14px 18px 0; font-size: 20px; font-weight: 800; }
.tcs-preview .tcs-pLabel { padding: 10px 18px 0; font: 700 10px ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; }
.tcs-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.tcs-sw { display: grid; gap: 6px; justify-items: center; padding: 8px 6px; border-radius: 12px; cursor: pointer;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.85); font-size: 11.5px; line-height: 1.2; text-align: center; }
.tcs-sw.is-on { border-color: #ffb347; background: rgba(255,179,71,.12); }
.tcs-dots { display: flex; }
.tcs-dots i { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,.7); }
.tcs-dots i + i { margin-left: -7px; }
.tcs-own { display: flex; gap: 12px; flex-wrap: wrap; }
.tcs-own label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,.85); }
.tcs-own input[type=color] { width: 44px; height: 32px; border: 1px solid rgba(255,255,255,.25); border-radius: 8px; background: none; padding: 2px; cursor: pointer; }
.tcs-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.tcs-chip { padding: 7px 12px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); color: rgba(255,255,255,.85); }
.tcs-chip.is-on { border-color: #ffb347; color: #ffb347; background: rgba(255,179,71,.12); }
.tcs-note { margin: 0; font-size: 12px; color: rgba(255,255,255,.6); }
.tcs-save { width: 100%; min-height: 46px; border: 0; border-radius: 999px; cursor: pointer; font-weight: 800; font-size: 15px;
  background: linear-gradient(90deg, #ff8a2a, #ffb347); color: #1a1020; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.tcs-save:disabled { opacity: .6; cursor: wait; }
.tcs-sw:focus-visible, .tcs-chip:focus-visible, .tcs-save:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
`;

export default function TeamColorsSheet({ open, initial, saving, name = "Your name", onSave, onClose }) {
  const [team, setTeam] = useState(() => cleanTeam(initial));
  const set = (patch) => setTeam((t) => cleanTeam({ ...t, ...patch }));
  const presetOn = (p) => p.primary === team.primary && p.secondary === team.secondary;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={520}
      title={<span style={{ color: "#fff" }}>Team Colors</span>}
      closeIcon={<span style={{ color: "rgba(255,255,255,.8)", fontSize: 18 }} aria-label="Close">×</span>}
      destroyOnHidden
      styles={{
        content: { background: "linear-gradient(160deg, #2b1642, #1a1233)", border: "1px solid rgba(255,255,255,.14)" },
        header: { background: "transparent" },
      }}
    >
      <div className="tcs">
        <style>{CSS}</style>
        <style>{teamCoverCss(team)}</style>

        {/* Live preview: the passport's top with these colors */}
        <div className="pdp pdp--team tcs-preview" data-team={teamKey(team)} aria-label="Preview">
          <SportLines team={team} />
          <header className="pdp-head">
            <span className="pdp-headBrand">
              <span className="pdp-emblem" aria-hidden="true"><Plane size={12} /></span> SKYRIO
            </span>
            <span>DIGITAL PASSPORT</span>
          </header>
          <div className="tcs-pLabel pdp-label">Holder / Titulaire</div>
          <div className="tcs-pName pdp-name">{name}</div>
        </div>

        <div>
          <h3>Colors</h3>
          <div className="tcs-swatches" role="radiogroup" aria-label="Color pairs">
            {TEAM_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={presetOn(p)}
                className={`tcs-sw${presetOn(p) ? " is-on" : ""}`}
                onClick={() => set({ primary: p.primary, secondary: p.secondary })}
              >
                <span className="tcs-dots" aria-hidden="true">
                  <i style={{ background: p.primary }} />
                  <i style={{ background: p.secondary }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3>Your own colors</h3>
          <div className="tcs-own">
            <label>
              <input type="color" value={team.primary} onChange={(e) => set({ primary: e.target.value })} />
              Main color
            </label>
            <label>
              <input type="color" value={team.secondary} onChange={(e) => set({ secondary: e.target.value })} />
              Second color
            </label>
          </div>
        </div>

        <div>
          <h3>Sport</h3>
          <div className="tcs-chips" role="radiogroup" aria-label="Sport lines">
            {TEAM_PATTERNS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={team.pattern === p.key}
                className={`tcs-chip${team.pattern === p.key ? " is-on" : ""}`}
                onClick={() => set({ pattern: p.key })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <p className="tcs-note">Text stays easy to read with any two colors. Change them anytime.</p>

        <button type="button" className="tcs-save" disabled={saving} onClick={() => onSave(team)}>
          {saving ? <Loader2 size={16} className="pr-spin" /> : <Check size={16} />}
          Put on my Passport
        </button>
      </div>
    </Modal>
  );
}
