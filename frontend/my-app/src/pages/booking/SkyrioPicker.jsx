/**
 * SkyrioPicker — drop-in replacement for Ant Design <RangePicker>
 *
 * Mobile  (<= 768 px)  →  full-screen Expedia-style calendar
 * Desktop (>  768 px)  →  existing sk-orange-picker RangePicker
 *
 * Fixes v2:
 *  - Header sits below app nav bar (paddingTop accounts for safe-area + nav)
 *  - Done button always visible above browser bottom chrome
 *  - Calendar scrolls to top on open (full May visible)
 *  - Body scroll locked properly while open
 *  - Portal renders outside app DOM so z-index always wins
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { DatePicker } from "antd";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

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
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          textAlign: "center",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: 18,
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
              color: "rgba(255,255,255,0.35)",
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
          if (!date) return <div key={`e${idx}`} style={{ height: 46 }} />;

          const isPast = date < today;
          const isStart = sameDay(date, startDate);
          const isEnd =
            rangeEnd && sameDay(date, rangeEnd) && !sameDay(date, startDate);
          const inRange =
            startDate && rangeEnd && between(date, startDate, rangeEnd);
          const isToday = sameDay(date, today);
          const col = idx % 7;
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
              onTouchEnd={(e) => {
                e.preventDefault();
                !isPast && onDay(date);
              }}
              style={{
                position: "relative",
                height: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isPast ? "not-allowed" : "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Range strip */}
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
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isStart || isEnd ? "#FF8A2A" : "transparent",
                  border:
                    isToday && !isStart && !isEnd
                      ? "2px solid rgba(255,138,42,0.8)"
                      : "2px solid transparent",
                  transition: "background 0.12s",
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: isStart || isEnd ? 700 : isToday ? 600 : 400,
                    fontFamily: "'DM Sans', sans-serif",
                    color: isPast
                      ? "rgba(255,255,255,0.2)"
                      : isStart || isEnd
                      ? "#1b1024"
                      : inRange
                      ? "rgba(255,255,255,0.92)"
                      : "rgba(255,255,255,0.85)",
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
}) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const scrollRef = useRef(null);
  const savedScrollY = useRef(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 14 months from current month
  const months = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  // Open / close side-effects
  useEffect(() => {
    if (open) {
      // Save scroll position and lock body
      savedScrollY.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      // Reset picker state and scroll to top
      setStartDate(null);
      setEndDate(null);
      setHoverDate(null);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
      });
    } else {
      // Restore body scroll
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, savedScrollY.current);
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
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

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background:
          "linear-gradient(160deg, #1a0a2e 0%, #2d1057 50%, #1e0b35 100%)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
        // Respect iOS notch / dynamic island at top
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* ── Sticky Header ── */}
      <div
        style={{
          flexShrink: 0,
          background: "rgba(20, 8, 40, 0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          // Extra top padding so it clears the app's own nav bar (~60px) plus safe area
          paddingTop: 16,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 14,
          zIndex: 2,
        }}
      >
        {/* Row 1: ✕  title  Clear */}
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
              background: "rgba(255,255,255,0.12)",
              border: "none",
              borderRadius: "50%",
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              fontSize: 18,
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            ✕
          </button>

          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: 0.3,
            }}
          >
            Select dates
          </span>

          <button
            onClick={handleClear}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,138,42,0.8)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              padding: "8px 4px",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            Clear
          </button>
        </div>

        {/* Row 2: Check-in → Check-out */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {placeholder[0]}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "'Playfair Display', Georgia, serif",
                color: startDate ? "#fff" : "rgba(255,255,255,0.22)",
                borderBottom: `2px solid ${
                  startDate ? "#FF8A2A" : "rgba(255,255,255,0.1)"
                }`,
                paddingBottom: 6,
                lineHeight: 1.2,
                minHeight: 30,
              }}
            >
              {startDate ? formatLabel(startDate) : "—"}
            </div>
          </div>

          <div
            style={{
              color: "rgba(255,255,255,0.2)",
              fontSize: 18,
              alignSelf: "flex-end",
              paddingBottom: 8,
            }}
          >
            →
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {placeholder[1]}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "'Playfair Display', Georgia, serif",
                color: endDate ? "#fff" : "rgba(255,255,255,0.22)",
                borderBottom: `2px solid ${
                  endDate ? "#FF8A2A" : "rgba(255,255,255,0.1)"
                }`,
                paddingBottom: 6,
                lineHeight: 1.2,
                minHeight: 30,
              }}
            >
              {endDate ? formatLabel(endDate) : "—"}
            </div>
          </div>
        </div>

        {/* Row 3: status pill */}
        <div style={{ minHeight: 26, display: "flex", alignItems: "center" }}>
          {nights ? (
            <span
              style={{
                background: "rgba(255,138,42,0.18)",
                border: "1px solid rgba(255,138,42,0.4)",
                borderRadius: 20,
                padding: "4px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: "#FF8A2A",
              }}
            >
              {nights} night{nights !== 1 ? "s" : ""}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
              {!startDate ? "Tap your check-in date" : "Now tap check-out"}
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable calendar body ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          padding: "20px 20px 0",
          // Prevents rubber-band from bleeding into header
          overscrollBehavior: "contain",
        }}
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
        {/* Bottom padding so last month isn't behind Done button */}
        <div style={{ height: 120 }} />
      </div>

      {/* ── Done button — always above browser chrome ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "14px 20px",
          // Respect home indicator / browser nav bar on iOS & Android
          paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))",
          background: "linear-gradient(to top, #140828 60%, transparent)",
          zIndex: 2,
        }}
      >
        <button
          onClick={handleDone}
          disabled={!startDate || !endDate}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: 16,
            border: "none",
            background:
              startDate && endDate
                ? "linear-gradient(135deg, #FF8A2A 0%, #FF6000 100%)"
                : "rgba(255,255,255,0.07)",
            color: startDate && endDate ? "#fff" : "rgba(255,255,255,0.22)",
            fontSize: 16,
            fontWeight: 800,
            cursor: startDate && endDate ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: 0.3,
            boxShadow:
              startDate && endDate
                ? "0 4px 28px rgba(255,138,42,0.45)"
                : "none",
            transition: "all 0.2s ease",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {startDate && endDate
            ? `Done  ·  ${nights} night${nights !== 1 ? "s" : ""}`
            : "Done"}
        </button>
      </div>
    </div>,
    document.body // ← portal: renders outside React tree, always on top
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

  useEffect(() => {
    if (value !== undefined) setRange(value ?? [null, null]);
  }, [value]);

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
            cursor: "pointer",
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: start ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.5)",
            fontWeight: start ? 600 : 500,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 14,
            height: 40,
            padding: "0 12px",
            backdropFilter: "blur(12px)",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <span style={{ opacity: 0.55, fontSize: 14 }}>📅</span>
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
