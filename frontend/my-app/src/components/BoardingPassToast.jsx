import React from "react";
import { Typography } from "antd";
const { Text } = Typography;

export default function BoardingPassToast({
  name = "Explorer",
  routeFrom = "Home",
  routeTo = "Dashboard",
  subtitle = "Enjoy your XP boost for today's check-in ✨",
}) {
  return (
    <div style={styles.wrap}>
      {/* Side perforation dots */}
      <div style={{ ...styles.perf, left: -6 }} aria-hidden />
      <div style={{ ...styles.perf, right: -6 }} aria-hidden />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.chip} aria-hidden />
          <Text style={styles.headerTitle}>Skyrio Boarding Pass</Text>
        </div>
        <Text style={styles.headerIcon} aria-hidden>
          ✈️
        </Text>
      </div>

      {/* Route */}
      <div style={styles.route}>
        <div>
          <Text style={styles.label}>FROM</Text>
          <div style={styles.value}>{routeFrom}</div>
        </div>
        <div style={styles.arrow} aria-hidden>
          →
        </div>
        <div style={{ textAlign: "right" }}>
          <Text style={styles.label}>TO</Text>
          <div style={styles.value}>{routeTo}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={styles.divider} aria-hidden />

      {/* Passenger */}
      <div style={styles.passenger}>
        <Text style={styles.label}>PASSENGER</Text>
        <div style={styles.value}>{name}</div>
        <div style={styles.sub}>{subtitle}</div>
      </div>

      {/* Barcode */}
      <div style={styles.barcode} aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            style={{
              ...styles.bar,
              height: [14, 22, 18, 26, 16][i % 5],
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    padding: 0,
    width: 320,
    /* ✅ Dark glass — no more light background */
    border: "1px solid rgba(255, 138, 42, 0.30)",
    background: "rgba(9, 7, 26, 0.92)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow:
      "0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset",
  },

  perf: {
    position: "absolute",
    top: 14,
    bottom: 14,
    width: 12,
    borderRadius: 999,
    background:
      "radial-gradient(circle, rgba(255,138,42,0.25) 2px, transparent 3px)",
    backgroundSize: "10px 12px",
    opacity: 0.7,
    pointerEvents: "none",
  },

  header: {
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(255, 138, 42, 0.18)",
    background: "rgba(255, 138, 42, 0.06)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    width: 26,
    height: 16,
    borderRadius: 6,
    background: "linear-gradient(90deg, #7c5cfc, #ff8a2a, #ffb066)",
    boxShadow: "0 0 12px rgba(255,138,42,0.35)",
    display: "inline-block",
  },
  headerTitle: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  headerIcon: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: 700,
    fontSize: 16,
  },

  route: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 10,
    alignItems: "center",
    padding: "12px 16px",
  },
  label: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    letterSpacing: "0.18em",
    fontWeight: 700,
    textTransform: "uppercase",
    display: "block",
  },
  value: {
    color: "rgba(255,255,255,0.94)",
    fontWeight: 800,
    fontSize: 15,
    marginTop: 3,
  },
  arrow: {
    color: "rgba(255,138,42,0.85)",
    fontSize: 18,
    lineHeight: "1",
    textAlign: "center",
  },

  divider: {
    height: 1,
    background: "rgba(255,138,42,0.15)",
    margin: "0 16px",
  },

  passenger: {
    padding: "10px 16px 12px",
  },
  sub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.60)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  barcode: {
    display: "grid",
    gridTemplateColumns: "repeat(14, 1fr)",
    gap: 4,
    alignItems: "end",
    padding: "8px 16px 12px",
    borderTop: "1px solid rgba(255,138,42,0.15)",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    background: "rgba(255,138,42,0.35)",
  },
};