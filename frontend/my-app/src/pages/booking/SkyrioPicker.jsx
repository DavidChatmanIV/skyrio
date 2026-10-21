/**
 * SkyrioPicker — Skyrio-branded date range picker
 *
 * Mobile  (<= 768 px)  →  full-screen scrollable calendar
 * Desktop (>  768 px)  →  centered modal with 2 months side-by-side + nav arrows
 *
 * Both use the purple/orange Skyrio theme.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon } from "lucide-react";
import dayjs from "dayjs";

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
const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

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
  const d = date.getTime(),
    lo = Math.min(s.getTime(), e.getTime()),
    hi = Math.max(s.getTime(), e.getTime());
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
function toDate(d) {
  return d ? dayjs(d).startOf("day").toDate() : null;
}

/**
 * While the picker is open, hide every fixed-position element outside it
 * (Skyrio's chat + support buttons, third-party chat bubbles, sticky bars).
 * No class names needed, and everything is restored exactly on close.
 */
function useHideFloating(open, rootRef) {
  useEffect(() => {
    if (!open) return;
    const hidden = [];
    const raf = requestAnimationFrame(() => {
      const root = rootRef.current;
      document.querySelectorAll("body *").forEach((el) => {
        if (root && (el === root || root.contains(el) || el.contains(root)))
          return;
        if (getComputedStyle(el).position !== "fixed") return;
        hidden.push([
          el,
          el.style.getPropertyValue("visibility"),
          el.style.getPropertyPriority("visibility"),
        ]);
        el.style.setProperty("visibility", "hidden", "important");
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      hidden.forEach(([el, prev, prio]) => {
        if (prev) el.style.setProperty("visibility", prev, prio);
        else el.style.removeProperty("visibility");
      });
    };
  }, [open, rootRef]);
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
  compact,
  disabledDate,
}) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = endDate || hoverDate;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));

  const cellSize = compact ? 40 : 46;

  return (
    <div
      style={{ marginBottom: compact ? 0 : 32, flex: compact ? 1 : undefined }}
    >
      <div
        style={{
          textAlign: "center",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: compact ? 16 : 18,
          color: "#fff",
          marginBottom: compact ? 12 : 14,
          letterSpacing: 0.5,
        }}
      >
        {MONTHS[month]} {year}
      </div>

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
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,255,255,0.35)",
              paddingBottom: 6,
              letterSpacing: 0.6,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {cells.map((date, idx) => {
          if (!date)
            return <div key={`e${idx}`} style={{ height: cellSize }} />;

          // past dates + anything the parent disables (e.g. outside a group's trip window)
          const isPast = date < today || !!disabledDate?.(dayjs(date));
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
          const circleSize = compact ? 34 : 38;

          return (
            <div
              key={date.toISOString()}
              // onClick only: the old onTouchEnd picked a date when you
              // lifted your finger after scrolling the month list
              onClick={() => !isPast && onDay(date)}
              onMouseEnter={() => onHover?.(date)}
              style={{
                position: "relative",
                height: cellSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isPast ? "not-allowed" : "pointer",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {(stripMid || stripStart || stripEnd) && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: circleSize - 4,
                    left: stripStart || stripFirst ? "50%" : 0,
                    right: stripEnd || stripLast ? "50%" : 0,
                    background: "rgba(255,138,42,0.15)",
                    zIndex: 0,
                  }}
                />
              )}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: circleSize,
                  height: circleSize,
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
                    fontSize: compact ? 13 : 15,
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

/* ─── shared range-selection logic ───────────────────────────── */
function useRangeSelection(open, initial) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  // reopen with the dates already picked instead of wiping them
  useEffect(() => {
    if (open) {
      setStartDate(initial?.[0] ?? null);
      setEndDate(initial?.[1] ?? null);
      setHoverDate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const clear = () => {
    setStartDate(null);
    setEndDate(null);
    setHoverDate(null);
  };

  return { startDate, endDate, hoverDate, handleDay, handleHover, clear };
}

/* ─── Desktop: centered modal with 2 months + nav arrows ───── */
function DesktopCalendar({
  open,
  onClose,
  onConfirm,
  placeholder,
  initial,
  disabledDate,
}) {
  const rootRef = useRef(null);
  const { startDate, endDate, hoverDate, handleDay, handleHover, clear } =
    useRangeSelection(open, initial);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useHideFloating(open, rootRef);

  // open on the month of the existing start date, if any
  useEffect(() => {
    if (open && initial?.[0]) {
      setViewMonth({
        year: initial[0].getFullYear(),
        month: initial[0].getMonth(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDone = () => {
    if (!startDate || !endDate) return;
    onConfirm([dayjs(startDate), dayjs(endDate)]);
    onClose();
  };

  const prevMonth = () => {
    setViewMonth((v) => {
      const d = new Date(v.year, v.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const nextMonth = () => {
    setViewMonth((v) => {
      const d = new Date(v.year, v.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const month2 = new Date(viewMonth.year, viewMonth.month + 1, 1);
  const nights = nightsBetween(startDate, endDate);

  const now = new Date();
  const canGoPrev =
    viewMonth.year > now.getFullYear() ||
    (viewMonth.year === now.getFullYear() && viewMonth.month > now.getMonth());

  if (!open) return null;

  return createPortal(
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999998,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(160deg, #1a0a2e 0%, #2d1057 50%, #1e0b35 100%)",
          borderRadius: 20,
          padding: "24px 28px 20px",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,138,42,0.15)",
          width: 640,
          maxWidth: "92vw",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              {placeholder?.[0] || "Depart"}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: startDate ? "#fff" : "rgba(255,255,255,0.25)",
                borderBottom: `2px solid ${
                  startDate ? "#FF8A2A" : "rgba(255,255,255,0.1)"
                }`,
                paddingBottom: 4,
                minHeight: 24,
              }}
            >
              {startDate ? formatLabel(startDate) : "—"}
            </div>
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.2)",
              fontSize: 16,
              alignSelf: "flex-end",
              paddingBottom: 6,
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
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              {placeholder?.[1] || "Return"}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: endDate ? "#fff" : "rgba(255,255,255,0.25)",
                borderBottom: `2px solid ${
                  endDate ? "#FF8A2A" : "rgba(255,255,255,0.1)"
                }`,
                paddingBottom: 4,
                minHeight: 24,
              }}
            >
              {endDate ? formatLabel(endDate) : "—"}
            </div>
          </div>
          {nights ? (
            <div style={{ alignSelf: "flex-end", paddingBottom: 4 }}>
              <span
                style={{
                  background: "rgba(255,138,42,0.18)",
                  border: "1px solid rgba(255,138,42,0.4)",
                  borderRadius: 20,
                  padding: "3px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#FF8A2A",
                }}
              >
                {nights} night{nights !== 1 ? "s" : ""}
              </span>
            </div>
          ) : null}
        </div>

        {/* Nav + months */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            style={{
              background: "none",
              border: "none",
              cursor: canGoPrev ? "pointer" : "not-allowed",
              color: canGoPrev
                ? "rgba(255,255,255,0.6)"
                : "rgba(255,255,255,0.15)",
              fontSize: 20,
              padding: "4px 6px",
              marginTop: 2,
              flexShrink: 0,
            }}
          >
            ‹
          </button>
          <MonthGrid
            year={viewMonth.year}
            month={viewMonth.month}
            startDate={startDate}
            endDate={endDate}
            hoverDate={hoverDate}
            onDay={handleDay}
            onHover={handleHover}
            disabledDate={disabledDate}
            compact
          />
          <MonthGrid
            year={month2.getFullYear()}
            month={month2.getMonth()}
            startDate={startDate}
            endDate={endDate}
            hoverDate={hoverDate}
            onDay={handleDay}
            onHover={handleHover}
            disabledDate={disabledDate}
            compact
          />
          <button
            onClick={nextMonth}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.6)",
              fontSize: 20,
              padding: "4px 6px",
              marginTop: 2,
              flexShrink: 0,
            }}
          >
            ›
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={clear}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,138,42,0.7)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "8px 14px",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Clear
          </button>
          <button
            onClick={handleDone}
            disabled={!startDate || !endDate}
            style={{
              padding: "10px 28px",
              borderRadius: 12,
              border: "none",
              background:
                startDate && endDate
                  ? "linear-gradient(135deg, #FF8A2A 0%, #FF6000 100%)"
                  : "rgba(255,255,255,0.07)",
              color: startDate && endDate ? "#fff" : "rgba(255,255,255,0.22)",
              fontSize: 14,
              fontWeight: 700,
              cursor: startDate && endDate ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow:
                startDate && endDate
                  ? "0 4px 20px rgba(255,138,42,0.35)"
                  : "none",
              transition: "all 0.2s",
            }}
          >
            {startDate && endDate
              ? `Done · ${nights} night${nights !== 1 ? "s" : ""}`
              : "Done"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Mobile: full-screen scrollable calendar ────────────────── */
function MobileCalendar({
  open,
  onClose,
  onConfirm,
  placeholder,
  initial,
  disabledDate,
}) {
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const savedScrollY = useRef(0);
  const { startDate, endDate, hoverDate, handleDay, handleHover, clear } =
    useRangeSelection(open, initial);

  useHideFloating(open, rootRef);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const months = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  useEffect(() => {
    if (!open) return;
    savedScrollY.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY.current}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    // scroll to the month of an existing start date, otherwise the top
    requestAnimationFrame(() => {
      const box = scrollRef.current;
      if (!box) return;
      const s = initial?.[0];
      const target = s
        ? box.querySelector(`[data-month="${s.getFullYear()}-${s.getMonth()}"]`)
        : null;
      box.scrollTo({
        top: target ? target.offsetTop - 12 : 0,
        behavior: "instant",
      });
    });

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, savedScrollY.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDone = () => {
    if (!startDate || !endDate) return;
    onConfirm([dayjs(startDate), dayjs(endDate)]);
    onClose();
  };

  const nights = nightsBetween(startDate, endDate);

  if (!open) return null;

  return createPortal(
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        // 100lvh fills the whole screen, including behind Safari's toolbar,
        // so the page no longer shows through under the Done button
        height: "100lvh",
        background:
          "linear-gradient(160deg, #1a0a2e 0%, #2d1057 50%, #1e0b35 100%)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          background: "rgba(20, 8, 40, 0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 20px 14px",
          zIndex: 2,
        }}
      >
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
            aria-label="Close"
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
            }}
          >
            Select dates
          </span>
          <button
            onClick={clear}
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
              {placeholder?.[0] || "Depart"}
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
              {placeholder?.[1] || "Return"}
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
                minHeight: 30,
              }}
            >
              {endDate ? formatLabel(endDate) : "—"}
            </div>
          </div>
        </div>
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
              {!startDate
                ? `Tap your ${(
                    placeholder?.[0] || "departure"
                  ).toLowerCase()} date`
                : `Now tap your ${(
                    placeholder?.[1] || "return"
                  ).toLowerCase()} date`}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable calendar */}
      <div
        ref={scrollRef}
        style={{
          position: "relative",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          padding: "20px 20px 0",
          overscrollBehavior: "contain",
        }}
      >
        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`} data-month={`${year}-${month}`}>
            <MonthGrid
              year={year}
              month={month}
              startDate={startDate}
              endDate={endDate}
              hoverDate={hoverDate}
              onDay={handleDay}
              onHover={handleHover}
              disabledDate={disabledDate}
            />
          </div>
        ))}
        <div style={{ height: 40 }} />
      </div>

      {/* Done button — padded up by the toolbar height so it stays tappable */}
      <div
        style={{
          flexShrink: 0,
          padding: "14px 20px",
          paddingBottom:
            "calc(max(14px, env(safe-area-inset-bottom, 14px)) + (100lvh - 100dvh))",
          background: "#140828",
          borderTop: "1px solid rgba(255,255,255,0.06)",
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
            boxShadow:
              startDate && endDate
                ? "0 4px 28px rgba(255,138,42,0.45)"
                : "none",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {startDate && endDate
            ? `Done · ${nights} night${nights !== 1 ? "s" : ""}`
            : "Done"}
        </button>
      </div>
    </div>,
    document.body
  );
}

/* ─── main export ───────────────────────────────────────────── */
export default function SkyrioPicker({
  onChange,
  placeholder = ["Depart", "Return"],
  disabledDate,
  value,
  className = "sk-orange-picker",
  triggerStyle, // optional overrides, e.g. a borderless trigger inside a search bar
  showIcon = true,
  ...rest
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState([null, null]);
  const anchorRef = useRef(null);

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

  const [start, end] = range;
  const initial = [toDate(start), toDate(end)];
  const triggerLabel =
    start && end
      ? `${start.format("MMM D")} → ${end.format("MMM D")}`
      : start
      ? `${start.format("MMM D")} → ${placeholder[1]}`
      : `${placeholder[0]} → ${placeholder[1]}`;

  const calendarProps = {
    open,
    onClose: () => setOpen(false),
    onConfirm: handleConfirm,
    placeholder,
    initial,
    disabledDate,
  };

  return (
    <div ref={anchorRef} style={{ position: "relative" }}>
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
          height: 44,
          padding: "0 14px",
          backdropFilter: "blur(12px)",
          WebkitTapHighlightColor: "transparent",
          transition: "border-color 0.15s",
          ...triggerStyle,
        }}
        onMouseEnter={(e) => {
          if (!triggerStyle)
            e.currentTarget.style.borderColor = "rgba(255,138,42,0.4)";
        }}
        onMouseLeave={(e) => {
          if (!triggerStyle)
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
        }}
      >
        {showIcon && (
          <CalendarIcon size={16} style={{ color: "#ff8a2a", flexShrink: 0 }} />
        )}
        {triggerLabel}
      </button>

      {isMobile ? (
        <MobileCalendar {...calendarProps} />
      ) : (
        <DesktopCalendar {...calendarProps} />
      )}
    </div>
  );
}
