import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import { TRIP_TYPE_LABELS } from "@/components/Atlas/atlasTripTypes";

function SoloIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function RomanticIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20s-7.5-4.6-9.5-9C1.2 8 2.6 4.5 6 4.5c2 0 3.6 1.2 4.5 2.6.9-1.4 2.5-2.6 4.5-2.6 3.4 0 4.8 3.5 3.5 6.5-2 4.4-9.5 9-9.5 9z" />
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="7" r="3" />
      <path d="M2 21c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="10" r="2" />
      <path d="M13.5 21c.3-2.3 2-4 4-4s3.7 1.7 4 4" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <circle cx="17.5" cy="8" r="2.3" />
      <path d="M14.5 21c.4-2.6 2.3-4.6 4.5-4.6 2.5 0 4.5 2.3 4.5 5.6" />
    </svg>
  );
}

const ICONS = {
  solo: SoloIcon,
  romantic: RomanticIcon,
  family: FamilyIcon,
  group: GroupIcon,
};

const ATLAS_PROMPTS = {
  solo: "I'm planning a solo trip. What should I know, and how can you help me plan it?",
  romantic:
    "I'm planning a romantic trip for two. What should I focus on and what can you help with?",
  family:
    "I'm planning a family trip with kids. What should I keep in mind, and how can you help?",
  group:
    "I'm planning a group trip with friends. What's the best way to coordinate and what can you help with?",
};

export default function TripTypeSelector() {
  const { atlasContext, updateAtlasContext, sendAtlasMessage } =
    useAtlasContext();
  const selected = atlasContext.tripType;

  const select = (type) => {
    const isDeselecting = selected === type;
    updateAtlasContext({ tripType: isDeselecting ? null : type });
    if (!isDeselecting) {
      sendAtlasMessage(ATLAS_PROMPTS[type]);
    }
  };

  return (
    <div style={{ marginTop: 14, marginBottom: 4 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          marginBottom: 8,
          letterSpacing: "0.02em",
        }}
      >
        Who's traveling?
      </div>

      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        role="group"
        aria-label="Who's traveling?"
      >
        {Object.entries(TRIP_TYPE_LABELS).map(([type, label]) => {
          const Icon = ICONS[type];
          const isSelected = selected === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => select(type)}
              aria-pressed={isSelected}
              className={isSelected ? "sk-qf is-active" : "sk-qf"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "inherit",
              }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
