import {
  Compass,
  Zap,
  Waves,
  Map,
  Flame,
  Globe,
  Star,
  Crown,
} from "lucide-react";
import { getTierByName } from "@/config/xpConfig";

const ICONS = {
  compass: Compass,
  bolt: Zap,
  wave: Waves,
  map: Map,
  flame: Flame,
  globe: Globe,
  star: Star,
  crown: Crown,
};

/**
 * <TierIcon tier={tierObj} />  or  <TierIcon name="Globetrotter" />
 * color defaults to the tier's own color; pass color="#fff" to override.
 */
export default function TierIcon({
  tier,
  name,
  size = 18,
  color,
  strokeWidth = 2,
  style,
  ...rest
}) {
  const t = tier || getTierByName(name);
  const Icon = ICONS[t?.iconKey] || Compass;
  return (
    <Icon
      size={size}
      color={color || t?.color || "currentColor"}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
      {...rest}
    />
  );
}

/** Round badge version — tier-colored gradient circle with a white icon. */
export function TierMedal({ tier, name, size = 48, style }) {
  const t = tier || getTierByName(name);
  const c = t?.color || "#ff8a2a";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${c}, rgba(255,138,42,0.6))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 4px 20px ${c}55`,
        flexShrink: 0,
        ...style,
      }}
    >
      <TierIcon tier={t} size={Math.round(size * 0.46)} color="#fff" />
    </div>
  );
}
