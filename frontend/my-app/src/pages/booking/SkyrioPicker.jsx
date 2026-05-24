/**
 * SkyrioPicker — drop-in replacement for Ant Design <RangePicker>
 *
 * Mobile  (<= 768 px)  →  full-screen Expedia-style calendar
 * Desktop (>  768 px)  →  existing sk-orange-picker RangePicker
 *
 * Props mirror RangePicker:
 *   onChange(dates: [dayjs|null, dayjs|null])
 *   placeholder: [string, string]
 *   disabledDate: (dayjs) => boolean
 *   value: [dayjs|null, dayjs|null]          (optional controlled)
 *   className                                 (forwarded to RangePicker)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

/* ─── constants ─────────────────────────────────────────────── */
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/* ─── helpers ───────────────────────────────────────────────── */
function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function between(date, s, e) {
  if (!s || !e || !date) return false;
  const d = date.getTime();
  const lo = Math.min(s.getTime(), e.getTime());
  const hi = Math.max(s.getTime(), e.getTime());
  return d > lo && d < hi;
}
function formatLabel(d) {
  if (!d) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function nightsBetween(a, b) {
  if (!a || !b) return null;
  return Math.round(Math.abs(b - a) / 864e5);
}

/* ─── single month grid ─────────────────────────────────────── */
function MonthGrid({
  year,
  month,
  startDate,
  endDate,
  hoverDate,
  onDay,
  onHover,
}) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = endDate || hoverDate;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Month label */}
      <div
        style={{
          textAlign: "center",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: 17,
          color: "#fff",
          marginBottom: 14,
          letterSpacing: 0.5,
        }}
      >
        {MONTHS[month]} {year}
      </div>

      {/* Day-of-week header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          marginBottom: 4,
        }}
      >
        {DAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.38)",
              paddingBottom: 8,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {cells.map((date, idx) => {
          if (!date) return <div key={`e${idx}`} />;

          const isPast = date < today;
          const isStart = sameDay(date, startDate);
          const isEnd =
            rangeEnd && sameDay(date, rangeEnd) && !sameDay(date, startDate);
          const inRange =
            startDate && rangeEnd && between(date, startDate, rangeEnd);
          const isToday = sameDay(date, today);
          const col = idx % 7;

          // Range highlight strip
          const stripStart =
            isStart && rangeEnd && !sameDay(startDate, rangeEnd);
          const stripEnd = isEnd;
          const stripMid = inRange;
          const stripFirst = inRange && col === 0;
          const stripLast = inRange && col === 6;

          return (
            <div
              key={date.toISOString()}
              onClick={() => !isPast && onDay(date)}
              onMouseEnter={() => !isPast && onHover(date)}
              style={{
                position: "relative",
                height: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isPast ? "not-allowed" : "pointer",
              }}
            >
              {/* Strip background */}
              {(stripMid || stripStart || stripEnd) && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: 34,
                    left: stripStart || stripFirst ? "50%" : 0,
                    right: stripEnd || stripLast ? "50%" : 0,
                    background: "rgba(255,138,42,0.15)",
                    zIndex: 0,
                  }}
                />
              )}

              {/* Circle */}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isStart || isEnd ? "#FF8A2A" : "transparent",
                  border:
                    isToday && !isStart && !isEnd
                      ? "2px solid rgba(255,138,42,0.7)"
                      : "2px solid transparent",
                  transition: "background 0.12s",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: isStart || isEnd ? 700 : isToday ? 600 : 400,
                    fontFamily: "'DM Sans', sans-serif",
                    color: isPast
                      ? "rgba(255,255,255,0.2)"
                      : isStart || isEnd
                      ? "#1b1024"
                      : inRange
                      ? "rgba(255,255,255,0.92)"
                      : "rgba(255,255,255,0.82)",
                  }}
                >
                  {date.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── full-screen overlay ───────────────────────────────────── */
function FullScreenCalendar({
  open,
  onClose,
  onConfirm,
  placeholder = ["Check-in", "Check-out"],
  disabledDate,
}) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const scrollRef = useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 14 months starting this month
  const months = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  // Reset on open
  useEffect(() => {
    if (open) {
      setStartDate(null);
      setEndDate(null);
      setHoverDate(null);
      // Scroll to top after opening
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0 }), 50);
    }
  }, [open]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleDay = useCallback(
    (date) => {
      if (!startDate || (startDate && endDate)) {
        setStartDate(date);
        setEndDate(null);
        setHoverDate(null);
      } else {
        if (date < startDate) {
          setEndDate(startDate);
          setStartDate(date);
        } else {
          setEndDate(date);
        }
        setHoverDate(null);
      }
    },
    [startDate, endDate]
  );

  const handleHover = useCallback(
    (date) => {
      if (startDate && !endDate) setHoverDate(date);
    },
    [startDate, endDate]
  );

  const handleDone = () => {
    if (!startDate || !endDate) return;
    onConfirm([dayjs(startDate), dayjs(endDate)]);
    onClose();
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setHoverDate(null);
  };

  const nights = nightsBetween(startDate, endDate);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(160deg, #1a0a2e 0%, #2d1057 50%, #1e0b35 100%)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        overflowY: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "16px 20px 0",
          background: "rgba(26,10,46,0.95)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: 12,
        }}
      >
        {/* Top row: close + clear */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.85)",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            ✕
          </button>

          <button
            onClick={handleClear}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.45)",
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
            }}
          >
            Clear
          </button>
        </div>

        {/* Date range display */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 10,
            marginBottom: 10,
          }}
        >
          {/* Check-in */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(255,255,255,0.38)",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              {placeholder[0]}
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                fontFamily: "'Playfair Display', Georgia, serif",
                color: startDate ? "#fff" : "rgba(255,255,255,0.25)",
                borderBottom: `2px solid ${
                  startDate ? "#FF8A2A" : "rgba(255,255,255,0.12)"
                }`,
                paddingBottom: 6,
                lineHeight: 1.2,
              }}
            >
              {startDate ? formatLabel(startDate) : "—"}
            </div>
          </div>

          <div
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: 16,
              alignSelf: "flex-end",
              paddingBottom: 8,
            }}
          >
            →
          </div>

          {/* Check-out */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(255,255,255,0.38)",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              {placeholder[1]}
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                fontFamily: "'Playfair Display', Georgia, serif",
                color: endDate ? "#fff" : "rgba(255,255,255,0.25)",
                borderBottom: `2px solid ${
                  endDate ? "#FF8A2A" : "rgba(255,255,255,0.12)"
                }`,
                paddingBottom: 6,
                lineHeight: 1.2,
              }}
            >
              {endDate ? formatLabel(endDate) : "—"}
            </div>
          </div>
        </div>

        {/* Status / night count */}
        <div style={{ minHeight: 24, display: "flex", alignItems: "center" }}>
          {nights ? (
            <span
              style={{
                background: "rgba(255,138,42,0.18)",
                border: "1px solid rgba(255,138,42,0.4)",
                borderRadius: 20,
                padding: "3px 12px",
                fontSize: 13,
                fontWeight: 700,
                color: "#FF8A2A",
              }}
            >
              {nights} night{nights !== 1 ? "s" : ""}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              {!startDate
                ? "Select your check-in date"
                : "Now select check-out"}
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable calendar ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 20px 0",
          WebkitOverflowScrolling: "touch",
        }}
        onMouseLeave={() => setHoverDate(null)}
      >
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            startDate={startDate}
            endDate={endDate}
            hoverDate={hoverDate}
            onDay={handleDay}
            onHover={handleHover}
          />
        ))}
        <div style={{ height: 110 }} />
      </div>

      {/* ── Done button ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 20px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
          background: "linear-gradient(to top, #1a0a2e 65%, transparent)",
        }}
      >
        <button
          onClick={handleDone}
          disabled={!startDate || !endDate}
          style={{
            width: "100%",
            padding: "17px",
            borderRadius: 16,
            border: "none",
            background:
              startDate && endDate
                ? "linear-gradient(135deg, #FF8A2A 0%, #FF6B00 100%)"
                : "rgba(255,255,255,0.08)",
            color: startDate && endDate ? "#1b1024" : "rgba(255,255,255,0.25)",
            fontSize: 16,
            fontWeight: 800,
            cursor: startDate && endDate ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: 0.3,
            boxShadow:
              startDate && endDate ? "0 4px 24px rgba(255,138,42,0.4)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          {startDate && endDate
            ? `Done  ·  ${nights} night${nights !== 1 ? "s" : ""}`
            : "Done"}
        </button>
      </div>
    </div>
  );
}

/* ─── main export ───────────────────────────────────────────── */
export default function SkyrioPicker({
  onChange,
  placeholder = ["Depart", "Return"],
  disabledDate,
  value,
  className = "sk-orange-picker",
  ...rest
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState([null, null]);

  // Sync controlled value
  useEffect(() => {
    if (value !== undefined) setRange(value ?? [null, null]);
  }, [value]);

  // Detect viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleConfirm = useCallback(
    (dates) => {
      setRange(dates);
      onChange?.(dates);
    },
    [onChange]
  );

  const handleDesktopChange = useCallback(
    (dates) => {
      const normalized = dates ?? [null, null];
      setRange(normalized);
      onChange?.(normalized);
    },
    [onChange]
  );

  /* ── mobile trigger button ── */
  const [start, end] = range;
  const triggerLabel =
    start && end
      ? `${start.format("MMM D")} → ${end.format("MMM D")}`
      : start
      ? `${start.format("MMM D")} → ${placeholder[1]}`
      : `${placeholder[0]} → ${placeholder[1]}`;

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={className}
          style={{
            /* mirror the sk-orange-picker look exactly */
            cursor: "pointer",
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            width: "100%",
            /* inherit the class's existing background/border via className */
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: start ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)",
            fontWeight: start ? 600 : 500,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            /* remove default button chrome */
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 14,
            height: 40,
            padding: "0 12px",
            backdropFilter: "blur(12px)",
          }}
        >
          <span style={{ opacity: 0.6, fontSize: 14 }}>📅</span>
          {triggerLabel}
        </button>

        <FullScreenCalendar
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          placeholder={placeholder}
          disabledDate={disabledDate}
        />
      </>
    );
  }

  /* ── desktop: existing RangePicker ── */
  return (
    <RangePicker
      className={className}
      onChange={handleDesktopChange}
      disabledDate={disabledDate}
      value={range}
      {...rest}
    />
  );
}
