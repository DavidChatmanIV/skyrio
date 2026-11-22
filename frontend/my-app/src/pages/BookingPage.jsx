import { tripPrice, arrivalNight } from "@/lib/tripPrice";
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Typography,
  Button,
  DatePicker,
  Card,
  Row,
  Col,
  Select,
  InputNumber,
  Input,
  Modal,
  message as antdMessage,
} from "antd";
import {
  SearchOutlined,
  EnvironmentOutlined,
  LoadingOutlined,
  SwapOutlined,
  SyncOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import useCloseOnBack from "@/lib/useCloseOnBack";
import { Link, useSearchParams } from "react-router-dom";

import heroImg from "@/assets/Booking/skyrio-hero.jpg";
import "@/styles/BookingPage.css";
import "@/styles/stays-search.css";
import "@/styles/package-tray.css";

import { lazyPart, LoadingLine } from "@/utils/lazyPart";
// Checkouts load when opened, not with the search page.
const BookingCheckout = lazyPart(() => import("@/pages/booking/BookingCheckout"), LoadingLine);
const HotelCheckout = lazyPart(() => import("@/pages/booking/HotelCheckout"), LoadingLine);
import SaveTripButton from "@/components/trips/SaveTripButton";
import TripBudgetCard from "./booking/TripBudgetCard";
import AirportInput from "@/pages/booking/AirportInput";
import SmartFilterBar from "@/pages/booking/SmartFilterBar";
import HotelFilterBar, {
  DEFAULT_HOTEL_FILTERS,
  applyHotelFilters,
  HOTEL_SORT_OPTIONS,
  compareHotels,
} from "@/pages/booking/HotelFilterBar";
import SkyrioPicker from "@/pages/booking/SkyrioPicker";
import HeroPlanner from "@/pages/booking/HeroPlanner";
import TripTypeSelector from "@/components/Atlas/TripTypeSelector";
import { useAtlasContext } from "@/components/Atlas/AtlasContext";
import ExcursionResults from "@/pages/booking/ExcursionResults";
import EventsForm from "@/pages/booking/EventsForm";
import EventsResults from "@/components/events/EventsResults";
import CarRentalForm from "@/pages/booking/CarRentalForm";
import CarResults from "@/components/cars/CarResults";
import TripBudgetBar from "@/components/syncTogether/TripBudgetBar";
import WeatherStrip from "@/components/WeatherStrip";
import useSiteStatus, { pausedMessage } from "@/lib/useSiteStatus";
import {
  tripBudgetFrom,
  priceFit,
  splitByBudget,
  money,
  tripSearchParams,
} from "@/utils/tripBudget";
import {
  Zap,
  Bell,
  BellOff,
  Plane as PlaneIcon,
  MapPin,
  DollarSign,
  Calendar,
  ChevronsDown,
  SlidersHorizontal,
  Info,
  ArrowRight,
  Clock,
  Users,
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  BedDouble,
  Check,
  X as XIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Sparkles,
  Wallet,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
// Book page parts (one file per tab / piece).
import { crispLogo, wholeUsd, API, IconHotel, IconFlight, IconWarning, RESULTS_PER_PAGE, MAX_ROOMS_PER_TRIP, getAutoSearchDates, Title, Text } from "@/pages/booking/parts/shared";
import { DEFAULT_FILTERS, getFlightXP, SORT_OPTIONS, compareFlights, applyFilters, getOutboundGroupKey, describeStops, closestFlight } from "@/pages/booking/parts/flightUtils";
import { roomKey, roomsIn, countRooms, RoomStepper, ROOMS_TIP_KEY, RoomsHowTo, RoomCartBar } from "@/pages/booking/parts/RoomCart";
import { EXAMPLE_PLANS, PLAN_SEEDS, extractBudgetFromPrompt, extractDestFromPrompt, PLAN_MODE_KEY, PLAN_MODES, readPlanMode, PLAN_CSS } from "@/pages/booking/parts/planning";
import { BookingTabBar } from "@/pages/booking/parts/BookingTabBar";
import { PackageTray } from "@/pages/booking/parts/PackageTray";
import { FlightsForm } from "@/pages/booking/parts/FlightsForm";
import { STAY_BOOKING_XP, StaysForm } from "@/pages/booking/parts/StaysForm";
import { PackagesForm } from "@/pages/booking/parts/PackagesForm";
import { ExcursionsForm } from "@/pages/booking/parts/ExcursionsForm";
import { LastMinuteForm } from "@/pages/booking/parts/LastMinuteForm";
import { SavedForm } from "@/pages/booking/parts/SavedForm";
import { FlightSkeleton, UnavailableNotice, PriceCheckBanner } from "@/pages/booking/parts/resultsParts";
import { saveLastSearch, readLastSearch, signedInHome } from "@/pages/booking/parts/lastSearch";

// Airline logos: ask the logo service for a bigger image than the tile
// shows, so it stays sharp on retina screens and when zoomed in (JetBlue's
// looked blurry). Unknown URLs are left exactly as they are.
export default function BookingPage() {
  // Disruption mode: show when this kind of booking is paused.
  const siteStatus = useSiteStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const { atlasContext, updateAtlasContext } = useAtlasContext();

  // Where flights leave from: the link, else a signed-in traveler's home
  // airport. Guests: nothing until they pick (no made-up EWR).
  const fromCode = searchParams.get("from") || signedInHome()?.code || "";

  // ── Sync Together: booking your own part of a group trip ──
  // /booking?groupId=… comes from the trip page. Kept in sessionStorage so
  // it survives switching tabs/searches until checkout.
  const syncGroupId = useMemo(() => {
    const fromUrl = searchParams.get("groupId");
    try {
      if (fromUrl) window.sessionStorage.setItem("skyrio_sync_group", fromUrl);
      return (
        fromUrl || window.sessionStorage.getItem("skyrio_sync_group") || null
      );
    } catch {
      return fromUrl || null;
    }
  }, [searchParams]);
  const leaveSyncGroup = useCallback(() => {
    try {
      window.sessionStorage.removeItem("skyrio_sync_group");
    } catch {
      /* non-fatal */
    }
    window.location.assign("/booking");
  }, []);
  // ?tab=flights works the same as ?tab=Flights.
  const tabParam = (() => {
    const t = String(searchParams.get("tab") || "").toLowerCase();
    return ["Flights", "Stays", "Cars", "Packages", "Excursions", "Events"].find((x) => x.toLowerCase() === t) || null;
  })();
  // Last search to bring back (see readLastSearch). Skipped when the URL
  // asks for something specific (a link with a destination, a group trip,
  // an Atlas hand-off…) or for another tab.
  const [restored] = useState(() => {
    const asksForSearch = ["to", "city", "depart", "auto", "hotelId", "kind", "groupId", "paid"].some(
      (k) => searchParams.get(k)
    );
    if (asksForSearch) return null;
    const last = readLastSearch();
    if (!last) return null;
    if (tabParam && tabParam !== last.tab) return null;
    return last;
  });
  // ── Sync Together trip info: is this person the organizer, and has the
  // group picked a hotel? (Lets the organizer pick it from these results.)
  const [syncInfo, setSyncInfo] = useState(null);
  const [savingGroupHotel, setSavingGroupHotel] = useState(null);
  useEffect(() => {
    if (!syncGroupId) return;
    let alive = true;
    const token = localStorage.getItem("token");
    fetch(`${API}/api/sync-together/${syncGroupId}/parts`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => alive && d.ok && setSyncInfo(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [syncGroupId]);
  const groupHotelId = syncInfo?.groupHotel?.hotelId || null;

  // ── Your private trip budget (Sync Together) ──
  // What's left = your budget − what you've booked on this trip. Results
  // that fit come first; the rest are tucked behind "Show". Nothing is
  // ever blocked.
  const tripBudget = useMemo(() => tripBudgetFrom(syncInfo), [syncInfo]);
  const budgetOn = Boolean(syncGroupId && tripBudget.set);
  const [showOverBudget, setShowOverBudget] = useState(false);
  const handleBudgetSaved = useCallback((data) => {
    setSyncInfo((prev) => ({
      ...(prev || {}),
      myBudget: data.myBudget,
      budgetSummary: data.budgetSummary ?? prev?.budgetSummary,
    }));
  }, []);
  const BudgetTag = ({ price }) => {
    if (!budgetOn) return null;
    const fit = priceFit(price, tripBudget);
    if (!fit) return null;
    return fit.fits ? (
      <span className="sk-tag sk-tag-good">Within your budget</span>
    ) : (
      <span className="sk-tag sk-tag-orange">
        {money(fit.over)} over your budget
      </span>
    );
  };
  const makeGroupHotel = useCallback(
    async (hotel) => {
      if (!syncGroupId) return;
      setSavingGroupHotel(hotel.hotelId);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${API}/api/sync-together/${syncGroupId}/group-hotel`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              hotel: {
                hotelId: hotel.hotelId,
                name: hotel.name,
                address: hotel.address,
                thumbnail: hotel.thumbnail,
                stars: hotel.stars,
                rating: hotel.rating,
              },
            }),
          }
        );
        const d = await res.json();
        if (!res.ok || !d.ok)
          throw new Error(d.error || "Couldn't save the group's hotel");
        setSyncInfo((prev) => ({ ...(prev || {}), groupHotel: d.groupHotel }));
        antdMessage.success(
          `${hotel.name} is now the group's hotel. Everyone's "Book my room" opens here.`
        );
      } catch (e) {
        antdMessage.error(e.message);
      } finally {
        setSavingGroupHotel(null);
      }
    },
    [syncGroupId]
  );

  // ── Group shortlist: "Suggest to group" on any flight or hotel ──
  const flightKey = (f) =>
    [
      "flight",
      f.ownerCode || f.owner,
      f.origin,
      f.destination,
      f.departingAt,
      f.returningAt || "",
    ]
      .map((x) => String(x || "").slice(0, 40))
      .join(":");
  // Excursion results come from Viator; accept the common field names.
  const activityFor = (ex) => ({
    id: String(ex.productCode || ex.id || ex.code || ""),
    name: ex.title || ex.name || "",
    image:
      ex.image ||
      ex.imageUrl ||
      ex.thumbnail ||
      ex.images?.[0]?.url ||
      ex.images?.[0]?.variants?.slice?.(-1)?.[0]?.url ||
      (typeof ex.images?.[0] === "string" ? ex.images[0] : undefined),
    city:
      ex.city ||
      ex.destination ||
      ex.location ||
      syncInfo?.destination ||
      undefined,
    duration: ex.duration || ex.durationText || undefined,
    rating: ex.rating ?? ex.reviews?.combinedAverageRating ?? undefined,
    reviews:
      ex.reviewCount ??
      ex.reviews?.totalReviews ??
      (typeof ex.reviews === "number" ? ex.reviews : undefined),
    url: ex.productUrl || ex.bookingUrl || ex.url || ex.link || undefined,
  });
  const activityKey = (ex) => {
    const a = activityFor(ex);
    return `activity:${String(a.id || a.url || "").slice(0, 120)}`;
  };
  // Rental cars (Duffel). Same key formula as carShortlistKey() in
  // syncTogether.routes.js — rate ids expire, so the key is car + where/when.
  // c._search = the Cars search it came from (pickup place, dates, times).
  const carFor = (c, srch = c._search) => ({
    rateId: c.id,
    name: c.car?.name,
    category: c.car?.category,
    type: c.car?.type,
    image: c.car?.image,
    supplier: c.supplier?.name,
    supplierLogo: c.supplier?.logo,
    passengers: c.car?.passengers,
    pickupName: c.pickup?.name,
    pickupCode: srch?.location,
    pickupDate: srch?.pickupDate,
    pickupTime: srch?.pickupTime,
    dropoffDate: srch?.dropoffDate,
    dropoffTime: srch?.dropoffTime,
    days: c.days,
  });
  const carShortlistKey = (c) => {
    const x = carFor(c);
    return [
      "car",
      x.supplier,
      x.name,
      x.pickupName || x.pickupCode,
      x.pickupDate,
      x.dropoffDate,
    ]
      .map((v) => String(v || "").slice(0, 40))
      .join(":");
  };
  // Ticketmaster events (normalized by eventsUtils.normalizeEvent).
  const eventFor = (e) => ({
    id: e.id,
    name: e.name,
    image: e.image,
    date: e.date,
    time: e.time,
    venue: e.venue?.name,
    city: e.venue?.city,
    category: e.genre || e.category,
    url: e.url,
  });
  const eventKey = (e) => `event:${String(e.id || "").slice(0, 120)}`;
  const shortlistKeyFor = (kind, data) =>
    kind === "hotel"
      ? `hotel:${data.hotelId}`
      : kind === "activity"
      ? activityKey(data)
      : kind === "car"
      ? carShortlistKey(data)
      : kind === "event"
      ? eventKey(data)
      : flightKey(data);
  const shortlistKeys = useMemo(
    () => new Set((syncInfo?.shortlist || []).map((i) => i.key)),
    [syncInfo]
  );

  // ── Opened from the group shortlist (?pick=<shortlist item id>) ──
  // The exact suggestion someone tapped. Once fresh results load, we find
  // the identical flight / room in them and open it — no hunting.
  const pickId = searchParams.get("pick");
  const pickedItem = useMemo(
    () =>
      pickId
        ? (syncInfo?.shortlist || []).find(
            (i) => String(i.id || i._id) === String(pickId)
          ) || null
        : null,
    [pickId, syncInfo]
  );
  const pickHandledRef = useRef(null);

  // How this person wants to plan (see PLAN_MODES). Remembered per browser.
  const [planMode, setPlanModeState] = useState(readPlanMode);
  // "On a budget" shows the budget planner (budget, flying from, places
  // that fit) right away. It waits for a "who's traveling" pick, which used
  // to be hidden in this mode, so tapping it looked like nothing happened
  // (tester: "doesn't feel intuitive"). Start on Solo; they can change it.
  useEffect(() => {
    if (planMode === "budget" && !atlasContext?.tripType)
      updateAtlasContext({ tripType: "solo" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planMode]);
  const setPlanMode = useCallback((m) => {
    setPlanModeState(m);
    try {
      localStorage.setItem(PLAN_MODE_KEY, m);
    } catch {
      /* storage blocked: just this visit */
    }
    if (m === "atlas") {
      window.dispatchEvent(
        new CustomEvent("skyrio:open-atlas", { detail: { mode: "chat" } })
      );
    }
  }, []);
  // After a search, the results take over the page (like a separate
  // results page) with a "Change search" bar on top. The planner stays
  // mounted underneath, so nothing typed is lost going back.
  // ── Phones: "Quick" (default) or "Full" ──
  // Quick is the same page with the extras tucked behind a tap: the
  // boarding-pass stub (XP, Price Watch, weather) and the filter dropdowns.
  // Full shows everything, like desktop. The choice is remembered.
  const [isPhone, setIsPhone] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(max-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 768px)");
    if (!mq) return;
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const [viewMode, setViewModeState] = useState(() => {
    try {
      return localStorage.getItem("skyrio_view_mode") === "full"
        ? "full"
        : "quick";
    } catch {
      return "quick";
    }
  });
  const setViewMode = useCallback((m) => {
    setViewModeState(m);
    try {
      localStorage.setItem("skyrio_view_mode", m);
    } catch {
      /* fine — just not remembered */
    }
  }, []);
  const quick = isPhone && viewMode === "quick";
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(false);
  const [quickPassOpen, setQuickPassOpen] = useState(false);

  const [resultsFocus, setResultsFocusState] = useState(false);
  const resultsFocusRef = useRef(false);
  const setResultsFocus = useCallback((on) => {
    if (on === resultsFocusRef.current) return;
    resultsFocusRef.current = on;
    setResultsFocusState(on);
    if (on) {
      // Phone/browser Back returns to the search instead of leaving.
      try {
        window.history.pushState(
          { ...(window.history.state || {}), skResults: true },
          ""
        );
      } catch {
        /* history blocked */
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    } else if (window.history.state?.skResults) {
      // Closed with the button: drop our extra history entry.
      try {
        window.history.back();
      } catch {
        /* ignore */
      }
    }
  }, []);
  useEffect(() => {
    const onPop = () => {
      if (resultsFocusRef.current && !window.history.state?.skResults) {
        resultsFocusRef.current = false;
        setResultsFocusState(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Brought back the last search: show it (on phones, open the results
  // view) and say so once.
  const restoredShownRef = useRef(false);
  useEffect(() => {
    if (restoredShownRef.current || !restored?.results?.length) return;
    restoredShownRef.current = true;
    setResultsFocus(true);
    antdMessage.info(
      restored.tab === "Flights"
        ? "Your last search. Prices are checked again before you pay."
        : "Your last stay search. Room prices are checked again before you pay."
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The big "not available anymore" notice (see UnavailableNotice).
  const [unavailableNotice, setUnavailableNotice] = useState(null);
  const closeUnavailableNotice = useCallback(
    () => setUnavailableNotice(null),
    []
  );
  // Tells the trip a suggested flight/room is gone, so it's removed from
  // the shortlist for everyone. Best-effort: the notice shows either way.
  const reportUnavailable = useCallback(
    async (item) => {
      const itemId = item?.id || item?._id;
      if (!syncGroupId || !itemId) return;
      try {
        const token = localStorage.getItem("token");
        const r = await fetch(
          `${API}/api/sync-together/${syncGroupId}/shortlist/${itemId}/unavailable`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const d = await r.json();
        if (!d.ok) return;
        setSyncInfo((prev) =>
          prev
            ? {
                ...prev,
                shortlist: (prev.shortlist || []).filter(
                  (i) => String(i.id || i._id) !== String(itemId)
                ),
                groupFlightKey: d.wasGroupFlight ? null : prev.groupFlightKey,
              }
            : prev
        );
        if (d.removed)
          setUnavailableNotice((n) => (n ? { ...n, removed: true } : n));
      } catch {
        /* the notice already explains it; removal can be retried later */
      }
    },
    [syncGroupId]
  );

  const [suggesting, setSuggesting] = useState(null);
  const suggestToGroup = useCallback(
    async (kind, data, e) => {
      e?.stopPropagation?.();
      if (!syncGroupId) return;
      const key = shortlistKeyFor(kind, data);
      setSuggesting(key);
      try {
        const token = localStorage.getItem("token");
        const body =
          kind === "car"
            ? {
                kind,
                // The whole rental, paid to the rental company at pickup.
                price: Number.isFinite(Number(data.totalAmount))
                  ? Number(data.totalAmount)
                  : null,
                currency: data.currency || "USD",
                car: carFor(data),
              }
            : kind === "event"
            ? {
                kind,
                // Ticketmaster's lowest listed price, when it gives one.
                price: data.priceRange?.min ?? null,
                currency: data.priceRange?.currency || "USD",
                event: eventFor(data),
              }
            : kind === "activity"
            ? {
                kind,
                price:
                  parseFloat(
                    data.price ??
                      data.fromPrice ??
                      data.pricing?.summary?.fromPrice ??
                      data.totalAmount
                  ) || null,
                currency: data.currency || data.pricing?.currency || "USD",
                activity: activityFor(data),
              }
            : kind === "hotel"
            ? {
                kind,
                price: data.totalAmount ?? null,
                currency: data.totalCurrency || "USD",
                hotel: {
                  hotelId: data.hotelId,
                  name: data.name,
                  address: data.address,
                  thumbnail: data.thumbnail,
                  stars: data.stars,
                  rating: data.rating,
                  roomName: data.roomName,
                  boardName: data.boardName,
                  checkin: data.checkin,
                  checkout: data.checkout,
                  adults: data.adults,
                },
              }
            : {
                kind,
                price: parseFloat(data.totalAmount) || null,
                currency: data.totalCurrency || "USD",
                flight: {
                  airline: data.owner,
                  airlineCode: data.ownerCode,
                  logo: data.ownerLogo,
                  origin: data.origin,
                  destination: data.destination,
                  departAt: data.departingAt,
                  arriveAt: data.arrivingAt,
                  returnDepartAt: data.returningAt,
                  returnArriveAt: data.returnArrivingAt,
                  stops: data.stops,
                  cabin: data.cabinClass || data.cabin,
                },
              };
        const res = await fetch(
          `${API}/api/sync-together/${syncGroupId}/shortlist`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          }
        );
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok)
          throw new Error(d.error || "Couldn't add it to the shortlist");
        setSyncInfo((prev) => ({
          ...(prev || {}),
          shortlist: [...(prev?.shortlist || []), { key, kind }],
        }));
        antdMessage.success(
          d.alreadyListed
            ? "Already on the shortlist — we added your vote."
            : "Added to the group shortlist. The group can vote on it."
        );
      } catch (err) {
        antdMessage.error(err.message);
      } finally {
        setSuggesting(null);
      }
    },
    [syncGroupId, syncInfo]
  );
  // Suggesting something above what the group is comfortable with gets a
  // quiet heads-up first. No names or numbers are shown.
  const itemPrice = (kind, data) =>
    kind === "car"
      ? parseFloat(data.totalAmount)
      : kind === "event"
      ? parseFloat(data.priceRange?.min)
      : kind === "activity"
      ? parseFloat(
          data.price ?? data.fromPrice ?? data.pricing?.summary?.fromPrice
        )
      : parseFloat(data.totalAmount);
  const suggestWithComfortCheck = (kind, data, e) => {
    e?.stopPropagation?.();
    const comfy = syncInfo?.budgetSummary?.comfortable;
    const price = itemPrice(kind, data);
    if (comfy && Number.isFinite(price) && price > comfy) {
      Modal.confirm({
        title: "Heads up",
        content:
          "This is above what the group is comfortable with. Suggest it anyway?",
        okText: "Suggest anyway",
        cancelText: "Keep looking",
        onOk: () => suggestToGroup(kind, data),
      });
      return;
    }
    suggestToGroup(kind, data);
  };
  const SuggestBtn = ({ kind, data }) => {
    if (!syncGroupId) return null;
    const key = shortlistKeyFor(kind, data);
    const done = shortlistKeys.has(key);
    const isPick =
      (kind === "flight" && syncInfo?.groupFlightKey === key) ||
      (kind === "hotel" && syncInfo?.groupHotel?.hotelId === data.hotelId) ||
      (["activity", "car", "event"].includes(kind) &&
        (syncInfo?.shortlist || []).some(
          (i) => i.key === key && i.status === "picked"
        ));
    if (isPick) {
      return (
        <span
          style={{
            background: "rgba(82,196,26,0.14)",
            border: "1px solid rgba(82,196,26,0.45)",
            color: "#52c41a",
            borderRadius: 10,
            padding: "7px 12px",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          The group's pick
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={done || suggesting === key}
        onClick={(e) => suggestWithComfortCheck(kind, data, e)}
        style={{
          background: done ? "rgba(82,196,26,0.12)" : "rgba(255,138,42,0.12)",
          border: `1px solid ${
            done ? "rgba(82,196,26,0.4)" : "rgba(255,138,42,0.45)"
          }`,
          color: done ? "#52c41a" : "#ff8a2a",
          borderRadius: 10,
          padding: "7px 12px",
          fontSize: 13,
          fontWeight: 600,
          cursor: done ? "default" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {done
          ? "✓ On the shortlist"
          : suggesting === key
          ? "Adding…"
          : "Suggest to group"}
      </button>
    );
  };

  // Prefill for the search forms (/booking?to=Miami&depart=2026-10-23&return=…).
  // auto=1 runs the search right away so results are waiting.
  const autoSearch = searchParams.get("auto") === "1";
  const flightInitial = useMemo(() => {
    const to = searchParams.get("to");
    const depart = searchParams.get("depart");
    if (!to && !depart) {
      // Coming back to Book: fill the fields with the last flight search
      // (no new search; any results still valid are already on screen).
      const q = restored?.tab === "Flights" ? restored.query : null;
      if (!q?.to) return null;
      return {
        from: q.from,
        to: q.to,
        fromName: q.fromName || undefined,
        toName: q.toName || undefined,
        depart: q.departDate,
        ret: q.returnDate || null,
        cabin: q.cabin || undefined,
        adults: q.adults || undefined,
        autoSearch: false,
      };
    }
    return {
      from: searchParams.get("from"),
      to,
      // Optional display names ("Newark", "New Orleans, LA") so a link with
      // airport codes shows "New Orleans (MSY)" instead of "MSY (MSY)".
      fromName: searchParams.get("fromName") || undefined,
      toName: searchParams.get("toName") || undefined,
      depart,
      ret: searchParams.get("return"),
      cabin: searchParams.get("cabin") || undefined,
      adults: searchParams.get("adults") || undefined,
      autoSearch,
    };
  }, [searchParams, autoSearch]);
  // "Today's price" from My Trips: what they paid, to compare with now.
  const priceCheck = useMemo(() => {
    const paid = Number(searchParams.get("paid"));
    if (!(paid > 0)) return null;
    return {
      paid,
      cur: searchParams.get("paidCur") || "USD",
      bookedOn: searchParams.get("bookedOn"),
      airline: searchParams.get("airline"),
      hotelName: searchParams.get("hotelName"),
      newDates: searchParams.get("newDates") === "1",
    };
  }, [searchParams]);
  const hotelIdParam = searchParams.get("hotelId");
  const stayInitial = useMemo(() => {
    const city = searchParams.get("city") || searchParams.get("to");
    const checkin = searchParams.get("depart");
    if (!city && !checkin && !hotelIdParam) {
      // Coming back to Book: fill the fields with the last stay search.
      const q = restored?.tab === "Stays" ? restored.query : null;
      if (!q?.city) return null;
      return {
        city: q.city,
        checkin: q.checkin,
        checkout: q.checkout,
        adults: q.adults,
        rooms: q.rooms,
        hotel: null,
        autoSearch: false,
      };
    }
    // Opening a specific hotel: wait until we know its name and photo.
    // A shortlist pick carries the suggested hotel's own details.
    let hotel = null;
    if (hotelIdParam) {
      if (!syncInfo) return null;
      const pickedHotel =
        pickedItem?.kind === "hotel" &&
        pickedItem.hotel?.hotelId === hotelIdParam
          ? pickedItem.hotel
          : null;
      hotel =
        pickedHotel ||
        (syncInfo.groupHotel?.hotelId === hotelIdParam
          ? syncInfo.groupHotel
          : { hotelId: hotelIdParam, name: "Hotel" });
    }
    return {
      city,
      checkin,
      checkout: searchParams.get("return"),
      adults: searchParams.get("adults"),
      rooms: searchParams.get("rooms"),
      hotel,
      autoSearch,
    };
  }, [searchParams, hotelIdParam, syncInfo, autoSearch, pickedItem]);
  const excursionInitial = useMemo(() => {
    const city = searchParams.get("city") || searchParams.get("to");
    if (!city) return null;
    return {
      city,
      start: searchParams.get("depart"),
      end: searchParams.get("return"),
      autoSearch,
    };
  }, [searchParams, autoSearch]);

  // Cars prefill: airport code from the link ("to"), trip dates.
  const carInitial = useMemo(() => {
    // "to" is an airport code (MIA) or, from a group trip, a city ("Miami")
    // — the Cars search finds the airport for a city too.
    const raw = String(searchParams.get("to") || "").trim();
    if (!raw || raw.length > 80) return null;
    const isCode = /^[A-Za-z]{3}$/.test(raw);
    const code = isCode ? raw.toUpperCase() : raw;
    const time = (k) =>
      /^\d{2}:\d{2}$/.test(searchParams.get(k) || "")
        ? searchParams.get(k)
        : null;
    const carCo = searchParams.get("carCo");
    const carModel = searchParams.get("carModel");
    return {
      code,
      city:
        searchParams.get("toName") ||
        searchParams.get("city") ||
        (isCode ? null : raw),
      start: searchParams.get("depart"),
      end: searchParams.get("return"),
      // From an Atlas car card: same search, then open that car's checkout.
      pickupTime: time("ptime"),
      dropoffTime: time("dtime"),
      driverAge: searchParams.get("age") || null,
      rateId: searchParams.get("carRate") || null,
      // From the group shortlist: re-find the same car if the rate expired.
      match: carCo && carModel ? { supplier: carCo, name: carModel } : null,
      autoSearch:
        searchParams.get("auto") === "1" && searchParams.get("tab") === "Cars",
    };
  }, [searchParams]);

  const prefillData = useMemo(() => {
    const promptParam = searchParams.get("prompt");
    const planParam = searchParams.get("plan");
    const exampleParam = searchParams.get("example");
    if (exampleParam && EXAMPLE_PLANS[exampleParam])
      return { ...EXAMPLE_PLANS[exampleParam], source: "example" };
    if (planParam && PLAN_SEEDS[planParam]) {
      const seed = PLAN_SEEDS[planParam];
      const mergedPrompt = promptParam ?? seed.prompt;
      const mergedBudget = extractBudgetFromPrompt(mergedPrompt) ?? seed.budget;
      return {
        ...seed,
        prompt: mergedPrompt,
        budget: mergedBudget,
        source: "plan",
      };
    }
    if (promptParam) {
      // From the Discover page: exact budget / trip length when picked there.
      const budgetParam = Number(searchParams.get("budget"));
      const nightsParam = Number(searchParams.get("nights"));
      return {
        prompt: promptParam,
        destination: extractDestFromPrompt(promptParam),
        budget:
          Number.isFinite(budgetParam) && budgetParam > 0
            ? budgetParam
            : extractBudgetFromPrompt(promptParam),
        tripDays:
          Number.isFinite(nightsParam) && nightsParam > 0 ? nightsParam : null,
        tab: null,
        iata: null,
        source: "prompt",
      };
    }
    return null;
  }, [searchParams]);

  const [tab, setTab] = useState(
    prefillData?.tab ??
      restored?.tab ??
      ([
        "Flights",
        "Stays",
        "Cars",
        "Packages",
        "Excursions",
        "Events",
      ].includes(tabParam)
        ? tabParam
        : "Flights")
  );
  // A link that changes ?tab= while you're already on Book (e.g. the
  // Skyrio tour's "Find events") switches the tab too.
  useEffect(() => {
    if (
      ["Flights", "Stays", "Cars", "Packages", "Excursions", "Events"].includes(
        tabParam
      )
    )
      setTab(tabParam);
  }, [tabParam]);
  const [flightResults, setFlightResults] = useState(() =>
    restored?.tab === "Flights" ? restored.results : []
  );
  const [hotelResults, setHotelResults] = useState(() =>
    restored?.tab === "Stays" ? restored.results : []
  );
  const [excursionResults, setExcursionResults] = useState([]);
  // Events tab: the last search (city/dates/category). EventsResults fetches itself.
  const [eventsSearch, setEventsSearch] = useState(null);
  // Cars tab: the last car search. CarResults fetches and handles checkout.
  const [carSearch, setCarSearch] = useState(null);
  const [selectedHotelOffer, setSelectedHotelOffer] = useState(null);
  // Rooms queued up for this Stays search — lets the user book one room,
  // then add another for family/friends before checking out together.
  const [roomCart, setRoomCart] = useState([]);
  // Normalized set of rooms actually going through checkout right now.
  // Populated either from a single "Book Now" click (one room) or the
  // cart's "Checkout N rooms" button (roomCart in full).
  const [checkoutRooms, setCheckoutRooms] = useState([]);
  const [autoSearchDone, setAutoSearchDone] = useState(false);
  const [autoSearchLoading, setAutoSearchLoading] = useState(false);
  const [autoSearchError, setAutoSearchError] = useState(null);
  // Manual flight-search failure (plain-language message from the API) and a
  // handle that re-runs the last manual search from the "Try again" button.
  const [searchError, setSearchError] = useState(null);
  const flightRetryRef = useRef(null);
  const [destCity, setDestCity] = useState(prefillData?.destination ?? "");
  // Keep the last stay search for this tab (see saveLastSearch). The city
  // name arrives just after the results, so this waits for both.
  useEffect(() => {
    if (!hotelResults.length || !destCity) return;
    const h = hotelResults[0] || {};
    saveLastSearch({
      tab: "Stays",
      query: {
        city: destCity,
        checkin: h.checkin,
        checkout: h.checkout,
        // Guests and rooms aren't on the results reliably, so the form
        // keeps its own defaults for those rather than guessing.
      },
      results: hotelResults,
    });
  }, [hotelResults, destCity]);
  const [originCity, setOriginCity] = useState("");
  // What the Flights form still needs (from FlightsForm).
  const [flightMissing, setFlightMissing] = useState([]);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [smartFilters, setSmartFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("price");
  const [hotelFilters, setHotelFilters] = useState(DEFAULT_HOTEL_FILTERS);
  const [hotelSortBy, setHotelSortBy] = useState("price");
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [showHotelCheckout, setShowHotelCheckout] = useState(false);
  const [selectedNights, setSelectedNights] = useState(
    prefillData?.tripDays ?? null
  );
  const [budgetState, setBudgetState] = useState({
    planned: prefillData?.budget ?? null,
    used: 0,
    bookingTotal: 0,
    tripDays: prefillData?.tripDays ?? null,
  });
  const [visibleCount, setVisibleCount] = useState(RESULTS_PER_PAGE);
  const budgetRef = useRef(null);
  const searchFormRef = useRef(null);
  const [priceWatchOn, setPriceWatchOn] = useState(false);
  const [priceWatchRoute, setPriceWatchRoute] = useState(null);
  const [watchingId, setWatchingId] = useState(null);
  // FIX: this map (flightId -> watch document id) was referenced in
  // handleWatchFlight below but never declared, causing:
  //   Uncaught ReferenceError: watchIds is not defined
  const [watchIds, setWatchIds] = useState({});
  // Which outbound flight (by group key) the person has committed to in
  // step 1 of the round-trip flow. Null means still browsing departing
  // flights; once set, the results area switches to showing only that
  // outbound's available return flights — the two-step pattern used by
  // Google Flights / Expedia / Kayak, rather than an inline expander.
  // (Back from "Choose your return flight" goes to the departing flights:
  // see useCloseOnBack below, after selectedOutboundGroupKey.)
  const [selectedOutboundGroupKey, setSelectedOutboundGroupKey] =
    useState(null);
  // Back / swipe back on "Choose your return flight" returns to the
  // departing flights instead of leaving Book (tester feedback).
  useCloseOnBack(!!selectedOutboundGroupKey, () =>
    setSelectedOutboundGroupKey(null)
  );

  // ── Price Watch (the card's switch) ──
  // ON creates a real watch on the server (same /api/watches the flight
  // cards use); OFF deletes it. The switch only shows "On" once the
  // server has saved the watch.
  const [routeWatchId, setRouteWatchId] = useState(null);
  const [priceWatchBusy, setPriceWatchBusy] = useState(false);
  const watchedRouteKey = useRef(null);
  const routeKeyOf = (r) =>
    r
      ? [
          r.from,
          r.to,
          r.depart ? dayjs(r.depart).format("YYYY-MM-DD") : "",
        ].join("|")
      : null;

  // A new search for a different route: the old watch keeps running on the
  // server, but the switch now describes the new route, so it starts Off.
  useEffect(() => {
    if (!priceWatchOn) return;
    if (routeKeyOf(priceWatchRoute) !== watchedRouteKey.current) {
      setPriceWatchOn(false);
      setRouteWatchId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceWatchRoute]);

  const handlePriceWatchToggle = useCallback(async () => {
    if (priceWatchBusy) return;
    const token = localStorage.getItem("token");

    // ── Turn OFF ──
    if (priceWatchOn) {
      setPriceWatchBusy(true);
      try {
        if (routeWatchId) {
          const res = await fetch(`${API}/api/watches/${routeWatchId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok && res.status !== 404) throw new Error();
        }
        setPriceWatchOn(false);
        setRouteWatchId(null);
        setWatchingId(null);
        setWatchIds({});
        watchedRouteKey.current = null;
        antdMessage.info("Price Watch is off for this route.");
      } catch {
        antdMessage.error("Couldn't turn off Price Watch. Please try again.");
      } finally {
        setPriceWatchBusy(false);
      }
      return;
    }

    // ── Turn ON ──
    if (!priceWatchRoute?.from || !priceWatchRoute?.to) {
      antdMessage.info("Search for a route first, then turn on Price Watch.");
      return;
    }
    if (!token) {
      antdMessage.info(
        "Log in to use Price Watch, so we know where to send alerts."
      );
      return;
    }
    const price = Number(priceWatchRoute.price);
    setPriceWatchBusy(true);
    try {
      const res = await fetch(`${API}/api/watches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "flights",
          origin: priceWatchRoute.from,
          destination: priceWatchRoute.to,
          dates: [
            priceWatchRoute.depart
              ? dayjs(priceWatchRoute.depart).format("YYYY-MM-DD")
              : null,
            priceWatchRoute.ret
              ? dayjs(priceWatchRoute.ret).format("YYYY-MM-DD")
              : null,
          ].filter(Boolean),
          // Same travelers and cabin as the search, so the job compares
          // like with like (a price for 2 isn't a "drop" from a price for 1).
          adults: priceWatchRoute.adults || 1,
          cabin: priceWatchRoute.cabin || "economy",
          lastSeenPrice: Number.isFinite(price) ? price : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.watch?._id) {
        throw new Error(
          data.error || data.message || "Couldn't start Price Watch."
        );
      }
      setRouteWatchId(data.watch._id);
      watchedRouteKey.current = routeKeyOf(priceWatchRoute);
      setPriceWatchOn(true);
      antdMessage.success(
        Number.isFinite(price)
          ? `Price Watch on. We'll notify you if ${priceWatchRoute.from} → ${
              priceWatchRoute.to
            } drops below $${wholeUsd(price)}.`
          : `Price Watch on for ${priceWatchRoute.from} → ${priceWatchRoute.to}.`
      );
    } catch (err) {
      antdMessage.error(
        err.message || "Couldn't start Price Watch. Please try again."
      );
    } finally {
      setPriceWatchBusy(false);
    }
  }, [priceWatchBusy, priceWatchOn, priceWatchRoute, routeWatchId]);

  const handleWatchFlight = useCallback(
    async (flight) => {
      const token = localStorage.getItem("token");

      // Already watching this flight — turn it off
      if (watchingId === flight.id) {
        const existingWatchId = watchIds[flight.id];
        setWatchingId(null);
        if (existingWatchId) {
          try {
            await fetch(`${API}/api/watches/${existingWatchId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            setWatchIds((prev) => {
              const next = { ...prev };
              delete next[flight.id];
              return next;
            });
          } catch {
            // non-fatal — local state already reflects "off"
          }
        }
        antdMessage.info("Stopped watching this flight.");
        return;
      }

      setWatchingId(flight.id);
      const price = parseFloat(flight.totalAmount);

      try {
        const res = await fetch(`${API}/api/watches`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "flights",
            origin: flight.origin,
            destination: flight.destination,
            dates: [
              flight.departingAt
                ? dayjs(flight.departingAt).format("YYYY-MM-DD")
                : null,
            ],
            // Same travelers/cabin as the search these results came from.
            adults: priceWatchRoute?.adults || 1,
            cabin: priceWatchRoute?.cabin || "economy",
            lastSeenPrice: price,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't create watch. Try again.");

        setWatchIds((prev) => ({ ...prev, [flight.id]: data.watch._id }));
        setPriceWatchRoute({
          from: flight.origin,
          to: flight.destination,
          price,
          flightId: flight.id,
          airline: flight.owner,
          depart: flight.departingAt || null,
          ret: flight.returningAt || null,
          adults: priceWatchRoute?.adults || 1,
          cabin: priceWatchRoute?.cabin || "economy",
        });
        // The flight's own watch is the route's watch too, so the card's
        // switch turns this same watch off.
        setRouteWatchId(data.watch._id);
        watchedRouteKey.current = routeKeyOf({
          from: flight.origin,
          to: flight.destination,
          depart: flight.departingAt || null,
        });
        setPriceWatchOn(true);
        antdMessage.success(
          `Watching $${wholeUsd(price)} — you'll be notified if it drops!`
        );
      } catch (err) {
        setWatchingId(null);
        antdMessage.error(err.message || "Couldn't set up price watch. Try again.");
      }
    },
    [watchingId, watchIds, priceWatchRoute]
  );

  // Trip dates from the search form, for the weather on the pass.
  const [tripDates, setTripDates] = useState([null, null]);
  // Forecast starts collapsed — open it on tap. Keeps the pass short.
  const [weatherOpen, setWeatherOpen] = useState(false);
  const handleDatesChange = useCallback(({ dates, nights }) => {
    setTripDates(Array.isArray(dates) ? dates : [null, null]);
    if (nights !== null && nights > 0) {
      setSelectedNights(nights);
      setBudgetState((prev) => ({ ...prev, tripDays: nights }));
    }
  }, []);

  // Events → "Plan a trip around it": open Flights with the event's city and
  // dates (arrive the day before, leave the day after) and search right away
  // from the home airport (if we know it). Venue info stays in the link for later
  // (e.g. sorting hotels by distance to the venue).
  const handlePlanTrip = useCallback(
    (event) => {
      const venue = event?.venue;
      const dates = event?.suggestedDates;
      if (!venue?.city || !dates) return;
      const next = new URLSearchParams();
      const gid = searchParams.get("groupId");
      if (gid) next.set("groupId", gid);
      // Leave from the airport in the link, else the saved home airport,
      // so the flight search can run right away.
      const home = signedInHome();
      const fromCode = searchParams.get("from") || home?.code;
      if (fromCode) {
        next.set("from", fromCode);
        if (!searchParams.get("from") && home?.city)
          next.set("fromName", home.city);
        next.set("auto", "1");
      }
      next.set("tab", "Flights");
      next.set("to", venue.city);
      next.set("city", venue.city);
      next.set("depart", dates.departDate);
      next.set("return", dates.returnDate);
      next.set("eventId", event.id);
      next.set("eventName", event.name);
      if (venue.name) next.set("venueName", venue.name);
      if (venue.lat != null && venue.lng != null) {
        next.set("venueLat", String(venue.lat));
        next.set("venueLng", String(venue.lng));
      }
      setSearchParams(next);
      setFlightResults([]);
      setHotelResults([]);
      setExcursionResults([]);
      setTab("Flights");
      antdMessage.success(
        fromCode
          ? `Finding flights for ${event.name}…`
          : `Dates set for ${event.name}. Pick your airport, then search.`
      );
      searchFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [searchParams, setSearchParams]
  );

  // "Search manually" / "Search flights to X" from HeroPlanner.
  // With a destination picked, prefill the Flights form (from/to) without
  // auto-searching — there are no dates yet. Then scroll to the form.
  const handleSearchManually = useCallback(
    (pick) => {
      if (pick?.dest?.iata) {
        const next = new URLSearchParams(searchParams);
        next.set("tab", "Flights");
        next.set("to", pick.dest.iata);
        next.set("toName", pick.dest.name);
        // So Stays / Excursions get the city name, not the airport code.
        next.set("city", pick.dest.name);
        if (pick.origin?.code) {
          next.set("from", pick.origin.code);
          next.set("fromName", pick.origin.city || pick.origin.code);
        }
        next.delete("auto");
        setSearchParams(next, { replace: true });
        setTab("Flights");
      }
      searchFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [searchParams, setSearchParams]
  );

  // HeroPlanner → boarding pass + Atlas: the slider is the planned budget.
  // (Before, this stayed null and the Atlas-context effect below overwrote
  // the budget HeroPlanner had just sent.)
  const handleHeroBudget = useCallback((b) => {
    setBudgetState((prev) =>
      prev.planned === b ? prev : { ...prev, planned: b }
    );
  }, []);

  // HeroPlanner's "Flying from" → the pass's FROM.
  const handleHeroOrigin = useCallback((ap) => {
    setOriginCity(ap?.city || ap?.code || "");
  }, []);

  // ── Room cart helpers ──────────────────────────────────────
  // Adds a hotel offer to the trip's room cart so the user can keep
  // browsing and add rooms for other travelers before checking out.
  //
  // Duplicates are now ALLOWED on purpose: a group might genuinely
  // want two identical rooms at the same hotel (e.g. a sports team
  // booking several of the same room type). The card UI below turns
  // into a quantity stepper (−/+) once a room is in the cart, rather
  // than a confusing "already added" block — the stepper count IS
  // how many of that room are in the trip.
  const addRoomToCart = useCallback((hotel) => {
    setRoomCart((prev) => {
      if (prev.length >= MAX_ROOMS_PER_TRIP) {
        antdMessage.warning(
          `You can add up to ${MAX_ROOMS_PER_TRIP} rooms per trip.`
        );
        return prev;
      }
      return [...prev, hotel];
    });
  }, []);

  // Removes exactly ONE instance of this room from the cart (not every
  // matching entry) — needed now that the same room can appear more
  // than once for a multi-room group booking.
  const removeRoomFromCart = useCallback((hotel) => {
    setRoomCart((prev) => {
      const idx = prev.findIndex((r) => roomKey(r) === roomKey(hotel));
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, []);

  // "Remove all" in the bottom bar.
  const clearRoomCart = useCallback(() => setRoomCart([]), []);

  // "How to book more than one room" tip — hidden for good once closed.
  const [roomsTipHidden, setRoomsTipHidden] = useState(() => {
    try {
      return window.localStorage.getItem(ROOMS_TIP_KEY) === "1";
    } catch {
      return false;
    }
  });
  const hideRoomsTip = useCallback(() => {
    setRoomsTipHidden(true);
    try {
      window.localStorage.setItem(ROOMS_TIP_KEY, "1");
    } catch {
      /* non-fatal */
    }
  }, []);

  // "Book Now" on a single card. Folds the room into the same cart
  // instead of bypassing it — that's what let a solo "Book Now"
  // dead-end with no way to add a second room for a teammate/family
  // member. It still opens checkout immediately for a fast one-room
  // booking, but since the room joined the cart, hitting "Back to
  // results" from checkout (below) lands back on Stays with that room
  // still selected, ready to add more.
  const handleBookSingleRoom = useCallback(
    (hotel) => {
      let next = roomCart;
      if (roomCart.length >= MAX_ROOMS_PER_TRIP) {
        antdMessage.warning(
          `You can add up to ${MAX_ROOMS_PER_TRIP} rooms per trip.`
        );
        next = roomCart.length ? roomCart : [hotel];
      } else {
        next = [...roomCart, hotel];
        setRoomCart(next);
      }
      setSelectedHotelOffer(next[0] ?? hotel);
      setCheckoutRooms(next.length ? next : [hotel]);
      setShowHotelCheckout(true);
    },
    [roomCart]
  );

  // "Checkout N rooms" from the cart bar — send the whole cart to
  // HotelCheckout as one bundled booking.
  const handleCheckoutCart = useCallback(() => {
    if (!roomCart.length) return;
    setSelectedHotelOffer(roomCart[0]);
    setCheckoutRooms(roomCart);
    setShowHotelCheckout(true);
  }, [roomCart]);

  // "Back to results" / "Add another room" from the checkout screen.
  // Deliberately does NOT clear roomCart or checkoutRooms — the whole
  // point is letting the user return to Stays, add one more room (e.g.
  // for a teammate), and come back to checkout with the full set intact.
  // The cart is only cleared once a booking actually completes, via
  // handleHotelBookingComplete below.
  const handleHotelCheckoutBack = useCallback(() => {
    setShowHotelCheckout(false);
  }, []);

  // Called by HotelCheckout once payment/booking actually succeeds —
  // clears the cart so a completed trip doesn't linger in the builder.
  const handleHotelBookingComplete = useCallback(() => {
    setRoomCart([]);
    setShowHotelCheckout(false);
    setSelectedHotelOffer(null);
    setCheckoutRooms([]);
  }, []);

  // ── Back button / swipe back from checkout → the listings ──
  // Checkout is drawn over the results, not a separate page, so the
  // browser had no "results" step: swiping back left Book and landed on
  // the home page (tester report). Opening checkout now adds one history
  // step; Back (or a swipe) removes it and closes checkout, with the
  // results still there. Closing checkout with its own Back button takes
  // the step away too, so the next Back doesn't do nothing.
  const flightCheckoutOpen = showCheckout && !!selectedFlight;
  const hotelCheckoutOpen = showHotelCheckout && checkoutRooms.length > 0;
  const checkoutOpen = flightCheckoutOpen || hotelCheckoutOpen;
  const checkoutStepRef = useRef(false);

  // Checkout scrolls inside its own layer (.sk-checkout-overlay), so
  // window.scrollTo doesn't reach it. On phones it could open partway
  // down, with "Back to results" hidden under the top bar (tester
  // report). Start it at the very top, again after layout settles.
  useEffect(() => {
    if (!checkoutOpen) return undefined;
    const toTop = () => {
      document
        .querySelectorAll(".sk-checkout-overlay")
        .forEach((el) => (el.scrollTop = 0));
    };
    // How tall the top bar really is (phone vs desktop, banners), so
    // checkout starts just under it.
    const fitUnderNav = () => {
      const nav = document.querySelector(".sk-navbar-wrap");
      const bottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 76;
      document.documentElement.style.setProperty(
        "--sk-co-top",
        `${Math.round(bottom + 8)}px`
      );
    };
    const settle = () => {
      fitUnderNav();
      toTop();
    };
    settle();
    const raf = requestAnimationFrame(settle);
    const t = setTimeout(settle, 300);
    window.addEventListener("resize", fitUnderNav);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", fitUnderNav);
    };
  }, [checkoutOpen]);

  useEffect(() => {
    if (checkoutOpen && !checkoutStepRef.current) {
      checkoutStepRef.current = true;
      try {
        window.history.pushState(
          { ...(window.history.state || {}), skCheckout: true },
          ""
        );
      } catch {
        /* history unavailable: Back just works as before */
      }
    } else if (!checkoutOpen && checkoutStepRef.current) {
      checkoutStepRef.current = false;
      // Closed from inside the page: drop the extra step we added, plus any
      // checkout steps (travelers → seats → pay) stacked on top of it.
      if (window.history.state?.skCheckout) {
        const extra = Number(window.__skStepDepth) || 0;
        window.__skStepDepth = 0;
        window.history.go(-(1 + extra));
      }
    }
  }, [checkoutOpen]);

  useEffect(() => {
    const onPop = () => {
      if (!checkoutStepRef.current || window.history.state?.skCheckout) return;
      // Back from checkout: close it, keep the results and the room cart.
      checkoutStepRef.current = false;
      setShowCheckout(false);
      setSelectedFlight(null);
      setShowHotelCheckout(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ── Read trip type from landing page URL param on mount ──
  useEffect(() => {
    const typeFromUrl = searchParams.get("type");
    if (
      typeFromUrl &&
      ["solo", "romantic", "family", "group"].includes(typeFromUrl)
    ) {
      updateAtlasContext({ tripType: typeFromUrl });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateAtlasContext({
      destination: destCity,
      budget: budgetState.planned,
      tripDays: budgetState.tripDays,
      bookingTotal: budgetState.bookingTotal,
      spent: budgetState.used,
      flights: flightResults,
    });
  }, [destCity, budgetState, flightResults, updateAtlasContext]);

  const [prefillEditing, setPrefillEditing] = useState(false);
  const [prefillDismissed, setPrefillDismissed] = useState(false);
  const [editPrompt, setEditPrompt] = useState(prefillData?.prompt ?? "");
  const [editBudget, setEditBudget] = useState(prefillData?.budget ?? null);
  const [editDays, setEditDays] = useState(prefillData?.tripDays ?? null);

  const budgetSeed = prefillData?.budget ?? null;
  const tripDaySeed = prefillData?.tripDays ?? null;

  const runAutoSearch = useCallback(() => {
    // No From airport yet (guest): let them pick it, don't guess.
    if (!prefillData?.iata || !fromCode) return;
    const { iata, tripDays: days = 10 } = prefillData;
    const { departDate, returnDate } = getAutoSearchDates(days);
    setAutoSearchLoading(true);
    setAutoSearchError(null);
    setTab("Flights");
    const params = new URLSearchParams({
      from: fromCode,
      to: iata,
      departDate,
      returnDate,
      adults: "1",
      cabin: "economy",
    });
    fetch(`${API}/api/flights/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.message || "Search failed");
        setFlightResults(data.flights ?? []);
        setAutoSearchDone(true);
        setVisibleCount(RESULTS_PER_PAGE);
        if (data.flights?.length) {
          const cheapest = [...data.flights].sort(
            (a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
          )[0];
          setPriceWatchRoute({
            from: fromCode,
            to: iata,
            price: parseFloat(cheapest.totalAmount),
            airline: cheapest.owner,
            depart: cheapest.departingAt || null,
            ret: cheapest.returningAt || null,
          });
          antdMessage.success(
            `Found ${data.flights.length} flights to ${prefillData.destination}`
          );
        } else {
          antdMessage.info("No flights found. Try other dates.");
        }
      })
      .catch((err) => {
        setAutoSearchError(err.message);
        antdMessage.error(`Flight search failed: ${err.message}`);
      })
      .finally(() => setAutoSearchLoading(false));
  }, [prefillData, fromCode]);

  useEffect(() => {
    runAutoSearch();
    // Runs once on mount, as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrefillSave = useCallback(() => {
    const newDest = extractDestFromPrompt(editPrompt) ?? destCity;
    const newBudget = editBudget ?? extractBudgetFromPrompt(editPrompt);
    setDestCity(newDest);
    if (newBudget) setBudgetState((prev) => ({ ...prev, planned: newBudget }));
    if (editDays) {
      setSelectedNights(editDays);
      setBudgetState((prev) => ({ ...prev, tripDays: editDays }));
    }
    setPrefillEditing(false);
    antdMessage.success("Trip details updated!");
  }, [editPrompt, editBudget, editDays, destCity]);

  const visibleFlights = useMemo(
    () =>
      applyFilters(flightResults, smartFilters).sort(compareFlights(sortBy)),
    [flightResults, smartFilters, sortBy]
  );

  // Round-trip searches return one priced "journey" per outbound+return
  // pairing, so the same outbound flight can appear many times, once
  // per available return time. Grouping by outbound lets step 1 show
  // one card per outbound flight, then step 2 lists only that group's
  // return options — the two-step pattern most travel search sites use.
  // One-way results (no returningAt on any flight) skip grouping
  // entirely and render exactly as they did before.
  const hasReturnData = useMemo(
    () => flightResults.some((f) => f.returningAt),
    [flightResults]
  );

  const flightGroups = useMemo(() => {
    if (!hasReturnData) return [];
    const groups = new Map();
    visibleFlights.forEach((f) => {
      const key = getOutboundGroupKey(f);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    });
    return Array.from(groups.entries())
      .map(([key, options]) => ({
        key,
        options,
        cheapest: options.reduce(
          (min, f) =>
            parseFloat(f.totalAmount) < parseFloat(min.totalAmount) ? f : min,
          options[0]
        ),
      }))
      .sort((a, b) => compareFlights(sortBy)(a.cheapest, b.cheapest));
  }, [visibleFlights, hasReturnData, sortBy]);

  // The group the person committed to in step 1, if any. Falls back to
  // null automatically if a filter change makes that group disappear.
  const selectedGroup = useMemo(
    () => flightGroups.find((g) => g.key === selectedOutboundGroupKey) || null,
    [flightGroups, selectedOutboundGroupKey]
  );

  // Budget split: what fits your trip budget first; the rest behind "Show".
  // (No budget set → everything shows exactly as before.)
  const flightFit = useMemo(
    () =>
      splitByBudget(
        visibleFlights,
        (f) => f.totalAmount,
        budgetOn ? tripBudget : null,
        showOverBudget
      ),
    [visibleFlights, budgetOn, tripBudget, showOverBudget]
  );
  const groupFit = useMemo(
    () =>
      splitByBudget(
        flightGroups,
        (g) => g.cheapest.totalAmount,
        budgetOn ? tripBudget : null,
        showOverBudget
      ),
    [flightGroups, budgetOn, tripBudget, showOverBudget]
  );

  const paginatedFlights = useMemo(
    () => flightFit.shown.slice(0, visibleCount),
    [flightFit, visibleCount]
  );
  const paginatedGroups = useMemo(
    () => groupFit.shown.slice(0, visibleCount),
    [groupFit, visibleCount]
  );
  const flightDisplayCount = hasReturnData
    ? groupFit.shown.length
    : flightFit.shown.length;
  // Pagination only applies to the step-1 outbound list — step 2 shows
  // a group's full set of return options at once (typically small).
  const hasMore = !selectedGroup && visibleCount < flightDisplayCount;
  const activeFilterCount = useMemo(
    () => Object.values(smartFilters).filter((v) => v !== "any").length,
    [smartFilters]
  );

  // Hotels — pagination mirrors flights (no separate filter set yet)
  const visibleHotels = useMemo(
    () =>
      applyHotelFilters(hotelResults, hotelFilters).sort(
        compareHotels(hotelSortBy)
      ),
    [hotelResults, hotelFilters, hotelSortBy]
  );
  const activeHotelFilterCount = useMemo(
    () => Object.values(hotelFilters).filter((v) => v !== "any").length,
    [hotelFilters]
  );
  const hotelFit = useMemo(
    () =>
      splitByBudget(
        visibleHotels,
        (h) => h.totalAmount,
        budgetOn ? tripBudget : null,
        showOverBudget
      ),
    [visibleHotels, budgetOn, tripBudget, showOverBudget]
  );
  const paginatedHotels = useMemo(
    () => hotelFit.shown.slice(0, visibleCount),
    [hotelFit, visibleCount]
  );
  const hotelHasMore = visibleCount < hotelFit.shown.length;

  // "Cash deposit" tag: which shown hotels take a deposit / cash at the
  // hotel. Duffel rooms carry it already; LiteAPI hotels are asked once
  // (cached on the server for a day, and reused by checkout).
  const [hotelDeposits, setHotelDeposits] = useState({});
  useEffect(() => {
    const ids = [
      ...new Set(
        paginatedHotels
          .filter((h) => h?.hotelId && h.provider !== "duffel")
          .map((h) => String(h.hotelId))
          .filter((id) => !(id in hotelDeposits))
      ),
    ].slice(0, 30);
    if (!ids.length) return;
    let alive = true;
    fetch(`${API}/api/hotels/deposits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.deposits) return;
        setHotelDeposits((prev) => ({ ...prev, ...d.deposits }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedHotels]);
  const depositOf = (h) =>
    h?.stayInfo?.deposit || hotelDeposits[String(h?.hotelId)] || null;

  // What the budget bar reports for the tab you're on.
  const budgetBarFit =
    tab === "Stays" ? hotelFit : hasReturnData ? groupFit : flightFit;

  // A new hotel search drops only what can't carry over: the picked hotel
  // and a meal plan the new results don't offer. Price, stars, rating and
  // refundable stay, so filters set before searching still apply.
  useEffect(() => {
    setHotelFilters((f) => {
      const boards = new Set(hotelResults.map((r) => r.boardName || "Room only"));
      const next = {
        ...f,
        hotel: "any",
        board: f.board !== "any" && hotelResults.length && !boards.has(f.board) ? "any" : f.board,
      };
      return next.hotel === f.hotel && next.board === f.board ? f : next;
    });
  }, [hotelResults]);

  useEffect(() => {
    setVisibleCount(RESULTS_PER_PAGE);
    setSelectedOutboundGroupKey(null);
    setShowOverBudget(false);
  }, [flightResults, hotelResults, smartFilters, hotelFilters, hotelSortBy]);

  // Quick chips are shortcuts into the SAME smartFilters the dropdowns use, so a
  // chip and its dropdown always agree. (The old Luxury / Unwind / Adventure /
  // Romantic chips only toggled their own highlight — flight data has nothing to
  // filter those on, so they were removed rather than left as fake controls.)
  const quickFilters = useMemo(
    () => [
      { label: "Under $500", key: "price", value: 500 },
      { label: "Nonstop", key: "stops", value: 0 },
      { label: "Morning", key: "time", value: "morning" },
      { label: "Max XP", key: "xp", value: 150 },
    ],
    []
  );
  const isQuickActive = (qf) =>
    String(smartFilters[qf.key]) === String(qf.value);
  const toggleFilter = (qf) =>
    setSmartFilters((prev) => ({
      ...prev,
      [qf.key]: String(prev[qf.key]) === String(qf.value) ? "any" : qf.value,
    }));
  const clearFilters = () => setSmartFilters(DEFAULT_FILTERS);

  const [selectedResult, setSelectedResult] = useState({
    id: "",
    title: "",
    total: 0,
  });
  const handleSelectResult = useCallback((result) => {
    setSelectedResult(result);
    setBudgetState((prev) => ({ ...prev, bookingTotal: result.total ?? 0 }));
  }, []);
  // "Plan on a budget" amount, carried into checkout (solo trips only;
  // Sync Together trips use the group budget instead).
  const soloBudget =
    !syncGroupId && planMode === "budget" && Number(budgetState.planned) > 0
      ? Number(budgetState.planned)
      : null;
  const handleBudgetChange = useCallback((state) => {
    // planned is undefined unless it was changed on the card itself.
    setBudgetState((prev) => ({
      ...state,
      planned: state.planned === undefined ? prev.planned : state.planned,
    }));
  }, []);
  const scrollToBudget = useCallback(() => {
    budgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Confirms a specific outbound+return combination and sends the
  // person straight to checkout with that exact flight object — used
  // both for single-return groups ("Book Now") and for a chosen return
  // time in step 2 of the round-trip flow.
  // Package mode is set further down; this ref lets the flight buttons
  // know about it without reordering the component.
  const packageRef = useRef({ plan: null, toStays: null });
  const selectFlightForCheckout = useCallback(
    (flight) => {
      // Building a package: pick now, pay at the end. Add the flight to
      // the trip and go straight to stays — no checkout yet.
      if (packageRef.current.plan) {
        setPackagePlan((p) =>
          p
            ? {
                ...p,
                flight: {
                  id: flight.id,
                  airline: flight.owner || null,
                  origin: flight.origin,
                  destination: flight.destination,
                  price: Number(flight.totalAmount) || 0,
                  currency: flight.totalCurrency || "USD",
                  raw: flight, // the exact offer, for checkout later
                  booked: false,
                },
              }
            : p
        );
        handleSelectResult({
          id: flight.id,
          title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
          total: parseFloat(flight.totalAmount),
        });
        antdMessage.success("Flight added to your trip. Now pick your stay.");
        packageRef.current.toStays?.(flight);
        return;
      }
      setSelectedFlight(flight);
      setShowCheckout(true);
      handleSelectResult({
        id: flight.id,
        title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
        total: parseFloat(flight.totalAmount),
      });
    },
    [handleSelectResult]
  );

  // Packages / Last-Minute hand off to a real Flights (or Stays) search:
  // the URL carries the prefill and auto=1 runs it as soon as the form opens.
  // A package link from an Atlas plan (kind=package) starts the same
  // flight-then-stay steps as the Packages form, so "Next: find your stay"
  // is ready after the flight search.
  const [packagePlan, setPackagePlan] = useState(() => {
    if (searchParams.get("kind") !== "package") return null;
    const city = searchParams.get("toName") || searchParams.get("to");
    const depart = searchParams.get("depart");
    const ret = searchParams.get("return");
    if (!city || !depart || !ret) return null;
    return {
      city,
      code: searchParams.get("to"),
      from: searchParams.get("from") || null,
      fromName: searchParams.get("fromName") || null,
      depart,
      ret,
      adults: Number(searchParams.get("adults")) || 1,
      rooms: Number(searchParams.get("rooms")) || 1,
      flight: null, // filled in when a flight is picked
    };
  });
  const pendingTabRef = useRef(null);
  const runHandoff = useCallback(
    ({ tab: nextTab, params = {}, plan }) => {
      const next = new URLSearchParams();
      const gid = searchParams.get("groupId");
      if (gid) next.set("groupId", gid);
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== "") next.set(k, String(v));
      });
      next.set("tab", nextTab);
      next.set("auto", "1");
      setSearchParams(next);
      if (plan !== undefined) setPackagePlan(plan);
      setFlightResults([]);
      setHotelResults([]);
      setExcursionResults([]);
      setSearchError(null);
      setSmartFilters(DEFAULT_FILTERS);
      setHotelFilters(DEFAULT_HOTEL_FILTERS);
      setVisibleCount(RESULTS_PER_PAGE);
      // Switch tabs once the new link is in place (effect below). Switching
      // now opened Stays with the old link's city and dates (the URL update
      // lands a render later), and it searched those instead.
      pendingTabRef.current = nextTab;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, setSearchParams]
  );
  useEffect(() => {
    if (pendingTabRef.current && tabParam === pendingTabRef.current) {
      setTab(tabParam);
      pendingTabRef.current = null;
    }
  }, [searchParams, tabParam]);

  // ── Package actions ──
  const goToPackageStays = useCallback((pickedFlight) => {
    if (!packagePlan) return;
    // Hotel nights = the night they land (before 6 AM counts as the night
    // before) to the day the flight home leaves, not the search dates: a
    // red-eye that lands the next morning shouldn't pay for an empty night.
    const f = pickedFlight?.arrivingAt ? pickedFlight : packagePlan.flight?.raw;
    const checkin = arrivalNight(f?.arrivingAt) || packagePlan.depart;
    const checkout = String(f?.returningAt || "").slice(0, 10) || packagePlan.ret;
    runHandoff({
      tab: "Stays",
      params: {
        city: packagePlan.city,
        depart: checkout > checkin ? checkin : packagePlan.depart,
        return: checkout > checkin ? checkout : packagePlan.ret,
        adults: packagePlan.adults,
        rooms: packagePlan.rooms,
      },
    });
  }, [packagePlan, runHandoff]);
  packageRef.current = { plan: packagePlan, toStays: goToPackageStays };

  const goToPackageFlights = useCallback(() => {
    if (!packagePlan) return;
    runHandoff({
      tab: "Flights",
      params: {
        from: packagePlan.from,
        fromName: packagePlan.fromName,
        to: packagePlan.code,
        toName: packagePlan.city,
        depart: packagePlan.depart,
        return: packagePlan.ret,
        adults: packagePlan.adults,
      },
    });
  }, [packagePlan, runHandoff]);

  // "Pay for flight": a fare picked a while ago may have expired (LiteAPI
  // offers last ~15 min). Ask the server to re-check first — /flights/verify
  // re-finds the same flight and gives back a fresh offer — so checkout
  // opens on a live fare instead of an "expired" screen.
  const [pkgFlightBusy, setPkgFlightBusy] = useState(false);
  const payForPackageFlight = useCallback(async () => {
    const saved = packagePlan?.flight;
    if (!saved?.raw || saved.booked) return;
    const open = (f) => {
      setSelectedFlight(f);
      setShowCheckout(true);
    };
    const left = Date.parse(saved.raw.expiresAt) - Date.now();
    if (!(left < 3 * 60 * 1000)) return open(saved.raw); // still fresh
    setPkgFlightBusy(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/flights/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          offerId: saved.raw.offerId || saved.raw.id,
          flight: saved.raw,
          search: {
            origin: saved.origin,
            destination: saved.destination,
            departureDate: packagePlan.depart,
            returnDate: packagePlan.ret,
            adults: packagePlan.adults,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const fresh = data.refreshed && data.flight ? data.flight : saved.raw;
        const newPrice = Number(fresh.totalAmount);
        if (data.refreshed) {
          setPackagePlan((p) =>
            p?.flight
              ? {
                  ...p,
                  flight: {
                    ...p.flight,
                    raw: fresh,
                    price: Number.isFinite(newPrice)
                      ? newPrice
                      : p.flight.price,
                  },
                }
              : p
          );
          antdMessage.info(
            data.priceChanged && Number.isFinite(newPrice)
              ? `We refreshed your fare with the airline. The price is now $${wholeUsd(
                  newPrice
                )} (was $${wholeUsd(saved.price)}).`
              : "We refreshed your fare with the airline. Same price."
          );
        }
        open(fresh);
      } else if (data.soldOut || res.status === 409) {
        antdMessage.warning(
          "That flight sold out with the airline. Please pick another flight."
        );
        setPackagePlan((p) => (p ? { ...p, flight: null } : p));
        goToPackageFlights();
      } else {
        // The check itself failed (airline system); checkout verifies again.
        open(saved.raw);
      }
    } catch {
      open(saved.raw);
    } finally {
      setPkgFlightBusy(false);
    }
  }, [packagePlan, goToPackageFlights]);

  const searchFormProps = {
    onDestChange: setDestCity,
    onDatesChange: handleDatesChange,
    onHandoff: runHandoff,
  };
  const isSearching = autoSearchLoading || manualSearchLoading;

  // Boarding pass stub — only real values from the search, never placeholders
  // dressed up as data. (The old destination-weather line was removed: it was
  // backed by a short hardcoded city list, so most destinations showed nothing.)
  // Flights: only what's actually in From (no made-up "EWR" when it's
  // empty). Other tabs keep the link / home airport.
  const bpFrom =
    tab === "Flights"
      ? originCity || ""
      : originCity || searchParams.get("from") || signedInHome()?.code || "";
  const bpLowestFare = (() => {
    const prices = flightResults
      .map((f) => parseFloat(f.totalAmount))
      .filter((n) => Number.isFinite(n) && n > 0);
    return prices.length ? Math.min(...prices) : null;
  })();
  const bpStatus = isSearching
    ? tab === "Stays"
      ? "Searching live hotel rates…"
      : "Searching live flights…"
    : tab === "Flights" && flightResults.length > 0
    ? `${flightDisplayCount} ${hasReturnData ? "departing flight" : "flight"}${
        flightDisplayCount !== 1 ? "s" : ""
      } found${bpLowestFare ? ` · from $${wholeUsd(bpLowestFare)}` : ""}`
    : tab === "Flights" && flightMissing.length
    ? `Next: add ${flightMissing.join(", ").replace(/, ([^,]*)$/, " and $1")}`
    : tab === "Stays" && hotelResults.length > 0
    ? `${hotelResults.length} stay${hotelResults.length !== 1 ? "s" : ""} found`
    : destCity
    ? "Ready. Hit search."
    : "Add a destination.";

  // ── Shortlist pick → open that exact flight / room / activity ──
  // Runs once per pick, as soon as fresh results are in.
  useEffect(() => {
    if (!pickedItem || isSearching) return;
    if (pickHandledRef.current === pickId) return;
    const who = pickedItem.suggestedByMe
      ? "your"
      : pickedItem.suggestedBy
      ? `${pickedItem.suggestedBy}'s`
      : "the group's";

    // Flights: same key that was saved when it was suggested.
    if (pickedItem.kind === "flight" && flightResults.length) {
      pickHandledRef.current = pickId;
      const s = pickedItem.flight || {};
      const sameMinute = (a, b) =>
        a && b && dayjs(a).isSame(dayjs(b), "minute");
      const match =
        flightResults.find((f) => flightKey(f) === pickedItem.key) ||
        flightResults.find(
          (f) =>
            f.origin === s.origin &&
            f.destination === s.destination &&
            (!s.airlineCode || f.ownerCode === s.airlineCode) &&
            sameMinute(f.departingAt, s.departAt) &&
            (!s.returnDepartAt || sameMinute(f.returningAt, s.returnDepartAt))
        );
      if (match) {
        selectFlightForCheckout(match);
        antdMessage.success(`Opening ${who} suggested flight.`);
      } else {
        const route =
          s.origin && s.destination ? `${s.origin} → ${s.destination}` : "";
        setUnavailableNotice({
          kind: "flight",
          title: "This flight isn't available anymore",
          item: [s.airline, route].filter(Boolean).join(" · "),
          when: s.departAt
            ? dayjs(s.departAt).format("ddd, MMM D · h:mm A")
            : "",
          body: `${
            who.charAt(0).toUpperCase() + who.slice(1)
          } suggested flight sold out or was taken off sale by the airline, so it can't be booked. Other flights on the same route and dates are below.`,
        });
        reportUnavailable(pickedItem);
      }
      return;
    }

    // Hotels: same hotel + same room type and board.
    if (pickedItem.kind === "hotel" && hotelResults.length) {
      pickHandledRef.current = pickId;
      const s = pickedItem.hotel || {};
      const atHotel = hotelResults.filter((r) => r.hotelId === s.hotelId);
      const match =
        atHotel.find(
          (r) =>
            r.roomName === s.roomName &&
            (r.boardName || "") === (s.boardName || "")
        ) || atHotel.find((r) => r.roomName === s.roomName);
      if (match) {
        handleBookSingleRoom(match);
        antdMessage.success(`Opening ${who} suggested room.`);
      } else {
        setUnavailableNotice({
          kind: "hotel",
          title: atHotel.length
            ? "This room isn't available anymore"
            : "This hotel is full for your dates",
          item: [s.name, s.roomName].filter(Boolean).join(" · "),
          when:
            s.checkin && s.checkout
              ? `${dayjs(s.checkin).format("MMM D")} – ${dayjs(
                  s.checkout
                ).format("MMM D")}`
              : "",
          body: atHotel.length
            ? `${
                who.charAt(0).toUpperCase() + who.slice(1)
              } suggested room is gone. Other rooms at this hotel are below.`
            : "No rooms left for these dates. Try other dates or hotels.",
        });
        reportUnavailable(pickedItem);
      }
      return;
    }

    // Activities without a provider link: move it to the top of the results.
    if (pickedItem.kind === "activity" && excursionResults.length) {
      pickHandledRef.current = pickId;
      const idx = excursionResults.findIndex(
        (ex) => activityKey(ex) === pickedItem.key
      );
      if (idx > 0) {
        setExcursionResults((prev) => [
          prev[idx],
          ...prev.filter((_, i) => i !== idx),
        ]);
      }
      if (idx === -1)
        // Activities aren't removed: they can come back for other dates.
        setUnavailableNotice({
          kind: "activity",
          title: "This activity isn't available for these dates",
          item: pickedItem.activity?.name || "",
          when: "",
          body: "Not available on your dates. More ideas below.",
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedItem, isSearching, flightResults, hotelResults, excursionResults]);

  // ── Opened from "Fly with friends" on the trip page (?sf=1) ──
  // Finds the exact flight a friend booked (same route, airline and
  // departure minute) in fresh results and opens checkout. If it's gone,
  // the big notice says so instead of quietly showing other flights.
  const sameFlight = useMemo(() => {
    if (searchParams.get("sf") !== "1") return null;
    return {
      origin: searchParams.get("from"),
      destination: searchParams.get("to"),
      departAt: searchParams.get("sfDepart"),
      returnAt: searchParams.get("sfReturn") || null,
      airline: searchParams.get("sfAirline") || null,
      withWho: searchParams.get("sfWith") || "your friend",
    };
  }, [searchParams]);
  const sameFlightHandledRef = useRef(false);
  const sameFlightSearchedRef = useRef(false);
  useEffect(() => {
    if (!sameFlight || sameFlightHandledRef.current) return;
    if (isSearching) {
      sameFlightSearchedRef.current = true;
      return;
    }
    if (!sameFlightSearchedRef.current && !flightResults.length) return;
    // A failed search shows its own error; don't call the flight sold out.
    if (autoSearchError || searchError) return;
    sameFlightHandledRef.current = true;

    const minute = (v) => (v ? String(v).slice(0, 16) : "");
    const sameAirline = (f) =>
      !sameFlight.airline ||
      !f.owner ||
      String(f.owner).toLowerCase() === sameFlight.airline.toLowerCase();
    const match = flightResults.find(
      (f) =>
        f.origin === sameFlight.origin &&
        f.destination === sameFlight.destination &&
        minute(f.departingAt) === minute(sameFlight.departAt) &&
        (!sameFlight.returnAt ||
          minute(f.returningAt) === minute(sameFlight.returnAt)) &&
        sameAirline(f)
    );
    if (match) {
      selectFlightForCheckout(match);
      antdMessage.success(`Opening the flight ${sameFlight.withWho} is on.`);
    } else {
      setUnavailableNotice({
        kind: "flight",
        title: `${sameFlight.withWho}'s flight isn't available anymore`,
        item: [
          sameFlight.airline,
          sameFlight.origin && sameFlight.destination
            ? `${sameFlight.origin} → ${sameFlight.destination}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        when: sameFlight.departAt
          ? dayjs(sameFlight.departAt).format("ddd, MMM D · h:mm A")
          : "",
        body: "Sold out. Similar flights are below.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameFlight, isSearching, flightResults, autoSearchError, searchError]);

  const searchForm = useMemo(() => {
    switch (tab) {
      case "Flights":
        return (
          <FlightsForm
            // A new from/to (e.g. "Search flights to Lisbon" in HeroPlanner)
            // remounts the form so its one-time prefill runs again.
            key={`${flightInitial?.from || ""}-${flightInitial?.to || ""}`}
            onSearch={(f, searched = {}) => {
              setFlightResults(f);
              if (f.length > 0) setResultsFocus(true);
              // Kept for this tab, so leaving Book and coming back keeps it.
              if (f.length > 0)
                saveLastSearch({ tab: "Flights", query: searched, results: f });
              // Filters are intentionally NOT reset here — anything the
              // traveler picked before searching (price, stops, time,
              // airline, XP) should apply to the results that come back.
              setVisibleCount(RESULTS_PER_PAGE);
              if (f.length > 0) {
                const cheapest = [...f].sort(
                  (a, b) =>
                    parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
                )[0];
                setPriceWatchRoute({
                  from: cheapest.origin,
                  to: cheapest.destination,
                  price: parseFloat(cheapest.totalAmount),
                  airline: cheapest.owner,
                  depart: cheapest.departingAt || null,
                  ret: cheapest.returningAt || null,
                  adults: Math.max(1, Number(searched.adults) || 1),
                  cabin: searched.cabin || "economy",
                });
              }
            }}
            onDestChange={setDestCity}
            onDatesChange={handleDatesChange}
            onOriginChange={setOriginCity}
            onReadyChange={setFlightMissing}
            onSearchStart={() => setManualSearchLoading(true)}
            onSearchEnd={() => setManualSearchLoading(false)}
            onSearchError={setSearchError}
            retryRef={flightRetryRef}
            initial={flightInitial}
          />
        );
      case "Stays":
        return (
          <StaysForm
            onSearch={(hotels) => {
              setHotelResults(hotels);
              setVisibleCount(RESULTS_PER_PAGE);
              if (hotels?.length > 0) setResultsFocus(true);
            }}
            onDestChange={setDestCity}
            onDatesChange={handleDatesChange}
            onSearchStart={() => setManualSearchLoading(true)}
            onSearchEnd={() => setManualSearchLoading(false)}
            initial={stayInitial}
          />
        );
      case "Cars":
        return (
          <CarRentalForm
            onDestChange={setDestCity}
            onSearch={setCarSearch}
            initial={carInitial}
          />
        );
      case "Saved":
        return <SavedForm />;
      case "Excursions":
        return (
          <ExcursionsForm
            onDestChange={setDestCity}
            onSearch={(excursions) => {
              setExcursionResults(excursions);
              setVisibleCount(RESULTS_PER_PAGE);
            }}
            onSearchStart={() => setManualSearchLoading(true)}
            onSearchEnd={() => setManualSearchLoading(false)}
            initial={excursionInitial}
          />
        );
      case "Events":
        return (
          <EventsForm
            onDestChange={setDestCity}
            onSearch={setEventsSearch}
            initial={excursionInitial}
          />
        );
      case "Packages":
        return <PackagesForm {...searchFormProps} />;
      case "Last-Minute":
        return <LastMinuteForm onHandoff={runHandoff} />;
      default:
        return null;
    }
    // The initial values are listed so a link's prefill reaches the form even
    // when it's ready a moment after the page (e.g. the group's hotel).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    handleDatesChange,
    flightInitial,
    stayInitial,
    excursionInitial,
    carInitial,
    runHandoff,
  ]);

  const resultsTitle =
    tab === "Stays"
      ? isSearching
        ? "Searching hotels…"
        : hotelResults.length > 0
        ? activeHotelFilterCount > 0
          ? `${visibleHotels.length} of ${hotelResults.length} Room Options`
          : `${hotelResults.length} Room Option${
              hotelResults.length !== 1 ? "s" : ""
            } Found`
        : "Results"
      : tab === "Excursions"
      ? isSearching
        ? "Searching experiences…"
        : excursionResults.length > 0
        ? `${excursionResults.length} Experience${
            excursionResults.length !== 1 ? "s" : ""
          } Found`
        : "Things to do"
      : tab === "Events"
      ? "Games, concerts & shows"
      : tab === "Cars"
      ? "Car rentals"
      : isSearching
      ? "Searching flights…"
      : hasReturnData && selectedGroup
      ? `${selectedGroup.options.length} Return flight${
          selectedGroup.options.length !== 1 ? "s" : ""
        }`
      : flightDisplayCount > 0
      ? `${flightDisplayCount} ${
          hasReturnData ? "Departing flight" : "Flight"
        }${flightDisplayCount !== 1 ? "s" : ""} Found${
          activeFilterCount > 0 ? " (filtered)" : ""
        }`
      : flightResults.length > 0
      ? "No flights match your filters"
      : "Results";

  // Checkout screens render as overlays ON TOP of the results page rather
  // than replacing it via a separate top-level return. Swapping the whole
  // return tree used to force React to fully unmount, then rebuild from
  // scratch, the entire results page (hundreds of cards, heavy
  // backdrop-filter blur on nearly every panel, re-triggered entry
  // animations) on every single "Book Now" / "Back" click — THAT
  // unmount+remount was the real source of the sluggish transitions, not
  // anything checkout-specific. Keeping the results tree mounted
  // underneath (just hidden) makes "Back" effectively instant.
  const checkoutOverlay =
    showCheckout && selectedFlight ? (
      <div
        className="sk-checkout-overlay"
        style={{
          "--sk-bg-image": `url(${heroImg})`,
          // Start below the fixed top bar, or the bar covers the
          // checkout header and "Back to results".
          paddingTop: "var(--sk-co-top, 76px)",
          boxSizing: "border-box",
        }}
      >
        <BookingCheckout
          flight={selectedFlight}
          groupId={syncGroupId}
          tripBudget={budgetOn ? tripBudget : null}
          onBudgetSaved={handleBudgetSaved}
          planBudget={soloBudget}
          // Package: mark the trip's flight as booked once it's paid.
          onBooked={() =>
            setPackagePlan((p) =>
              p?.flight ? { ...p, flight: { ...p.flight, booked: true } } : p
            )
          }
          // Key: switching to the suggested flight starts a fresh checkout.
          key={selectedFlight?.offerId || selectedFlight?.id || "flight"}
          onBack={(info) => {
            const gone = selectedFlight;
            setShowCheckout(false);
            setSelectedFlight(null);
            if (!info?.unavailable || !gone) return;
            // Sold out: take it off the list (it can't be booked) and offer
            // the closest flight in one tap, instead of trial and error.
            const isGone = (f) =>
              f === gone ||
              (info.offerId && f?.offerId === info.offerId) ||
              (gone.id && f?.id === gone.id);
            const remaining = flightResults.filter((f) => !isGone(f));
            setFlightResults(remaining);
            const alt = closestFlight(gone, remaining);
            const fmtWhen = (f) =>
              f?.departingAt
                ? dayjs(f.departingAt).format("ddd, MMM D · h:mm A")
                : "";
            setUnavailableNotice({
              kind: "flight",
              title: "That flight just sold out",
              item: [
                gone.owner,
                gone.origin && gone.destination
                  ? `${gone.origin} → ${gone.destination}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
              when: fmtWhen(gone),
              body: "That fare sold out. Your traveler details are saved.",
              alternative: alt
                ? {
                    flight: alt,
                    label: [
                      alt.owner,
                      alt.stops === 0
                        ? "Nonstop"
                        : alt.stops
                        ? `${alt.stops} stop${alt.stops > 1 ? "s" : ""}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    detail: [
                      fmtWhen(alt),
                      Number.isFinite(parseFloat(alt.totalAmount))
                        ? `$${Math.round(parseFloat(alt.totalAmount))}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }
                : null,
            });
          }}
        />
      </div>
    ) : showHotelCheckout && checkoutRooms.length > 0 ? (
      <div
        className="sk-checkout-overlay"
        style={{
          "--sk-bg-image": `url(${heroImg})`,
          // Start below the fixed top bar, or the bar covers the
          // checkout header and "Back to results".
          paddingTop: "var(--sk-co-top, 76px)",
          boxSizing: "border-box",
        }}
      >
        <HotelCheckout
          rooms={checkoutRooms}
          // `hotel` kept for backward compatibility with any code still
          // reading a single-offer prop — always the first room in the set.
          hotel={selectedHotelOffer}
          destCity={destCity}
          groupId={syncGroupId}
          tripBudget={budgetOn ? tripBudget : null}
          onBudgetSaved={handleBudgetSaved}
          planBudget={soloBudget}
          onBack={handleHotelCheckoutBack}
          onBookingComplete={handleHotelBookingComplete}
          // Package: remember the booked stay (the cart is cleared after).
          onBooked={(c) =>
            setPackagePlan((p) =>
              p
                ? {
                    ...p,
                    stay: {
                      booked: true,
                      rooms: countRooms(c?.rooms || checkoutRooms),
                      checkin: (c?.rooms || checkoutRooms)[0]?.checkin || null,
                      checkout: (c?.rooms || checkoutRooms)[0]?.checkout || null,
                      total:
                        typeof c?.totalPaid === "number"
                          ? c.totalPaid
                          : (c?.rooms || checkoutRooms).reduce(
                              (s, r) => s + (Number(r.totalAmount) || 0),
                              0
                            ),
                      name: (c?.rooms || checkoutRooms)[0]?.name || null,
                    },
                  }
                : p
            )
          }
        />
      </div>
    ) : null;

  // Filters, sort and shortcuts. Shown under the search bar, and on top of
  // the results once a search runs (the search form folds away then, and
  // the filters used to fold away with it).
  const toolsBlock = (
    <div className="sk-bp-tools">
      <SmartFilterBar
        filters={smartFilters}
        onChange={setSmartFilters}
        flightResults={flightResults}
        visible={tab === "Flights"}
      />

      <HotelFilterBar
        filters={hotelFilters}
        onChange={setHotelFilters}
        hotelResults={hotelResults}
        visible={tab === "Stays"}
      />

      <div className="sk-bp-tools-row">
        {/* Quick mode (phones): one Filters button instead of
                        the row of dropdowns. */}
        {quick && (tab === "Flights" || tab === "Stays") && (
          <button
            type="button"
            className={`sk-qf sk-quick-filters${
              quickFiltersOpen ? " is-active" : ""
            }`}
            aria-expanded={quickFiltersOpen}
            onClick={() => setQuickFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal size={13} aria-hidden="true" /> Filters
            {(tab === "Flights" ? activeFilterCount : activeHotelFilterCount) >
            0
              ? ` · ${
                  tab === "Flights" ? activeFilterCount : activeHotelFilterCount
                }`
              : ""}
          </button>
        )}
        {/* Sort + quick filters only once there are results —
                        before a search they do nothing. */}
        {tab === "Flights" && flightResults.length > 0 && (
          <Button
            className="sk-btn-orange sk-bp-sort"
            onClick={() => {
              const i = SORT_OPTIONS.findIndex((o) => o.key === sortBy);
              setSortBy(SORT_OPTIONS[(i + 1) % SORT_OPTIONS.length].key);
            }}
            title="Click to change sort"
          >
            Sort: {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
          </Button>
        )}
        {tab === "Stays" && hotelResults.length > 0 && (
          <Button
            className="sk-btn-orange sk-bp-sort"
            onClick={() => {
              const i = HOTEL_SORT_OPTIONS.findIndex(
                (o) => o.key === hotelSortBy
              );
              setHotelSortBy(
                HOTEL_SORT_OPTIONS[(i + 1) % HOTEL_SORT_OPTIONS.length].key
              );
            }}
            title="Click to change sort"
          >
            Sort: {HOTEL_SORT_OPTIONS.find((o) => o.key === hotelSortBy)?.label}
          </Button>
        )}

        {tab === "Flights" &&
          flightResults.length > 0 &&
          quickFilters.map((qf) => (
            <button
              key={qf.label}
              type="button"
              className={`sk-qf${isQuickActive(qf) ? " is-active" : ""}`}
              aria-pressed={isQuickActive(qf)}
              onClick={() => toggleFilter(qf)}
            >
              {qf.label}
            </button>
          ))}
        {tab === "Flights" && activeFilterCount > 0 && (
          <button
            type="button"
            className="sk-qf sk-qf-clear"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}

        {/* Pushes the next buttons to the right on desktop */}
        <span className="sk-bp-tools-gap" aria-hidden="true" />

        {!syncGroupId &&
          planMode === "budget" &&
          (visibleFlights.length > 0 || hotelResults.length > 0) && (
            <button
              type="button"
              className="sk-scroll-budget-btn"
              onClick={scrollToBudget}
            >
              <ChevronsDown
                size={13}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />
              Trip budget
            </button>
          )}
        <Link to="/sync-together">
          <Button className="sk-btn-sync" icon={<SyncOutlined />}>
            Sync Together
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <UnavailableNotice
        notice={unavailableNotice}
        groupId={syncGroupId}
        onClose={closeUnavailableNotice}
        onTryAlternative={(f) => {
          setUnavailableNotice(null);
          setSelectedFlight(f);
          setShowCheckout(true);
        }}
      />
      {checkoutOverlay}
      {/* Rooms in your trip — pinned to the bottom while on Stays */}
      {tab === "Stays" && !checkoutOverlay && (
        <RoomCartBar
          rooms={roomCart}
          onAdd={addRoomToCart}
          onRemove={removeRoomFromCart}
          onClear={clearRoomCart}
          onCheckout={handleCheckoutCart}
          destCity={destCity}
          max={MAX_ROOMS_PER_TRIP}
        />
      )}
      {syncGroupId && !checkoutOverlay && (
        <div
          role="status"
          style={{
            position: "relative",
            zIndex: 5,
            maxWidth: 960,
            margin: "12px auto 0",
            padding: "10px 16px",
            borderRadius: 12,
            background: "rgba(124,58,237,0.14)",
            border: "1px solid rgba(124,58,237,0.35)",
            color: "#fff",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            Group trip: tap &quot;Suggest to group&quot; to vote, or book your part.
          </span>
          <span style={{ display: "flex", gap: 12 }}>
            <Link
              to={`/sync-together/${syncGroupId}`}
              style={{ color: "#ffb347" }}
            >
              Back to the trip
            </Link>
            <button
              type="button"
              onClick={leaveSyncGroup}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
              }}
            >
              Book something else
            </button>
          </span>
        </div>
      )}
      <div
        className={`sk-booking${quick ? " sk-quick" : ""}${
          quickFiltersOpen ? " is-filters-open" : ""
        }${quickPassOpen ? " is-pass-open" : ""}`}
        style={{
          "--sk-bg-image": `url(${heroImg})`,
          // Hidden (not unmounted) while a checkout overlay is open —
          // display:none is nearly free for the browser (no layout/paint/
          // compositing of the blur-heavy cards underneath) and preserves
          // all existing state, scroll position, and DOM nodes so
          // returning from checkout doesn't rebuild anything.
          display: checkoutOverlay ? "none" : undefined,
        }}
      >
        <style>{PLAN_CSS}</style>
        {/* Phones only: Quick / Full switch */}
        {isPhone && (
          <div className="sk-viewmode" role="radiogroup" aria-label="Page view">
            {[
              ["quick", "Quick"],
              ["full", "Full"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={viewMode === key}
                className={viewMode === key ? "is-on" : ""}
                onClick={() => setViewMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {resultsFocus && (
          <div className="sk-resultsbar" role="region" aria-label="Your search">
            <button
              type="button"
              className="sk-resultsbar__back"
              onClick={() => setResultsFocus(false)}
            >
              <ArrowLeft size={15} aria-hidden="true" /> Edit search
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Route on top, what you're looking at underneath (the big
                  "39 … Found" heading is right below, so not repeated here). */}
              <div className="sk-resultsbar__title">
                {(tab === "Stays"
                  ? destCity
                  : [originCity, destCity].filter(Boolean).join(" → ")) ||
                  resultsTitle}
              </div>
              <div className="sk-resultsbar__sub">
                {[
                  tab,
                  tripDates?.[0] && tripDates?.[1]
                    ? `${dayjs(tripDates[0]).format("MMM D")} – ${dayjs(
                        tripDates[1]
                      ).format("MMM D")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>
        )}
        {resultsFocus && (tab === "Flights" || tab === "Stays") && (
          <div className="sk-results-tools">{toolsBlock}</div>
        )}
        <div
          className="sk-booking-hero sk-bp"
          // Folded away (not unmounted) while results are showing, so the
          // search form keeps everything that was typed.
          style={resultsFocus ? { display: "none" } : undefined}
        >
          {/* ── Boarding pass intro ── */}
          <div className="sk-bp-intro">
            <span className="sk-bp-eyebrow">Now boarding</span>
            <Title className="sk-hero-title">
              You&apos;re building your{" "}
              <span className="sk-hero-title-accent">dream vacation.</span>
            </Title>
            <Text className="sk-hero-sub">
              Search, set a budget, or ask Atlas.
            </Text>
          </div>

          {/* ── How do you want to plan? (one path at a time) ── */}
          {!syncGroupId && (
            <div
              className="sk-planmode"
              role="radiogroup"
              aria-label="How do you want to plan?"
            >
              {PLAN_MODES.map(({ key, Icon, title, sub }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={planMode === key}
                  className={`sk-planmode__btn${
                    planMode === key ? " is-on" : ""
                  }`}
                  onClick={() => setPlanMode(key)}
                >
                  <span className="sk-planmode__icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="sk-planmode__title">{title}</span>
                    <span
                      className="sk-planmode__sub"
                      style={{ display: "block" }}
                    >
                      {sub}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── The boarding pass ── */}
          <section
            className="sk-bp-ticket"
            aria-label="Your trip boarding pass"
            // Lift the pass above the results below it, so pop-ups that open
            // from the search bar and the filter dropdowns aren't covered.
            style={{ position: "relative", zIndex: 3 }}
          >
            <div className="sk-bp-band">
              <span className="sk-bp-airline">
                <IconFlight size={16} /> Skyrio
              </span>
              <span className="sk-bp-band-label">Boarding pass</span>
            </div>

            <div className="sk-bp-body">
              {/* Main side of the pass: who, what, where, when */}
              <div className="sk-bp-main">
                {/* ── Atlas mode: point to the chat ── */}
                {!syncGroupId && planMode === "atlas" && (
                  <div className="sk-atlas-hint">
                    <Sparkles size={16} aria-hidden="true" />
                    <span>
                      Tell Atlas where, when and your budget. It does the rest.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("skyrio:open-atlas", {
                            detail: { mode: "chat" },
                          })
                        )
                      }
                    >
                      Open Atlas
                    </button>
                  </div>
                )}

                {/* ── Who's traveling (Atlas) + HeroPlanner (budget) ──
                    Kept mounted in every mode; only shown where they help. */}
                <div
                  style={
                    !syncGroupId && planMode === "search"
                      ? { display: "none" }
                      : undefined
                  }
                >
                  <TripTypeSelector />
                </div>

                <div
                  style={
                    !syncGroupId && planMode !== "budget"
                      ? { display: "none" }
                      : undefined
                  }
                >
                  <HeroPlanner
                    initialBudget={budgetState.planned ?? 1500}
                    onDestinationSelect={(city) => setDestCity(city || "")}
                    onOriginSelect={handleHeroOrigin}
                    onBudgetChange={handleHeroBudget}
                    onSearchManually={handleSearchManually}
                  />
                </div>

                <BookingTabBar
                  value={tab}
                  onChange={(val) => {
                    setTab(val);
                    if (val !== "Flights" && val !== "Stays")
                      setPackagePlan(null);
                    setFlightResults([]);
                    setHotelResults([]);
                    setExcursionResults([]);
                    setSearchError(null);
                    setSmartFilters(DEFAULT_FILTERS);
                    setSortBy("price");
                    setHotelFilters(DEFAULT_HOTEL_FILTERS);
                    setHotelSortBy("price");
                    setVisibleCount(RESULTS_PER_PAGE);
                    // Leaving Stays clears any in-progress room cart so a
                    // half-built trip from a previous search doesn't linger
                    // silently in the background.
                    if (val !== "Stays") setRoomCart([]);
                  }}
                />
                {(() => {
                  const vertical =
                    tab === "Flights" || tab === "Packages"
                      ? "flights"
                      : tab === "Stays"
                      ? "hotels"
                      : tab === "Cars"
                      ? "cars"
                      : null;
                  const msg = vertical ? pausedMessage(siteStatus, vertical) : "";
                  return msg ? (
                    <div
                      role="status"
                      style={{
                        margin: "10px 0 0",
                        padding: "10px 14px",
                        borderRadius: 14,
                        background: "rgba(255,138,42,0.12)",
                        border: "1px solid rgba(255,179,71,0.45)",
                        color: "#fff",
                        fontSize: 13,
                        lineHeight: 1.45,
                      }}
                    >
                      {msg} You can still search and save trips.
                    </div>
                  ) : null;
                })()}

                {/* ── Search form (scroll target for "Search manually") ── */}
                <div ref={searchFormRef}>{searchForm}</div>

                {/* ── Filters, sort and shortcuts (toolsBlock, defined above) ── */}
                {!resultsFocus && toolsBlock}

                {/* Package in progress: flight first, then the stay */}
                {packagePlan && (tab === "Flights" || tab === "Stays") && (
                  <PackageTray
                    plan={packagePlan}
                    tab={tab}
                    stayRooms={tab === "Stays" ? roomCart : []}
                    flightBusy={pkgFlightBusy}
                    onNextStay={goToPackageStays}
                    onChangeFlight={goToPackageFlights}
                    onPayFlight={payForPackageFlight}
                    onPayStay={handleCheckoutCart}
                    onDone={() => setPackagePlan(null)}
                  />
                )}
                {/* Quick mode: the stub (XP, Price Watch, weather) is one tap away */}
                {quick && (
                  <button
                    type="button"
                    className="sk-quick-pass-btn"
                    aria-expanded={quickPassOpen}
                    onClick={() => setQuickPassOpen((v) => !v)}
                  >
                    <Info size={14} aria-hidden="true" />
                    {quickPassOpen
                      ? "Hide trip details"
                      : tab === "Flights"
                      ? "Trip details · XP · Price Watch"
                      : "Trip details"}
                  </button>
                )}
              </div>

              {/* Perforated tear line between pass and stub */}
              <div className="sk-bp-perf" aria-hidden="true" />

              {/* Tear-off stub: route summary, XP, price watch */}
              <aside className="sk-bp-stub" aria-label="Trip summary">
                <span className="sk-bp-label">Your pass</span>
                <div className="sk-tripState sk-bp-pass">
                  <dl className="sk-bp-fields">
                    <div className="sk-bp-field">
                      <dt>From</dt>
                      <dd>{bpFrom || "—"}</dd>
                    </div>
                    <div className="sk-bp-field">
                      <dt>To</dt>
                      <dd className={destCity ? "" : "is-empty"}>
                        {destCity || "Where to?"}
                      </dd>
                    </div>
                    <div className="sk-bp-field">
                      <dt>Nights</dt>
                      <dd className={selectedNights ? "" : "is-empty"}>
                        {selectedNights || "—"}
                      </dd>
                    </div>
                    <div className="sk-bp-field">
                      <dt>Budget</dt>
                      <dd className={budgetState.planned ? "" : "is-empty"}>
                        {budgetState.planned
                          ? `$${wholeUsd(budgetState.planned)}`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  {/* Fixed 2-line height: the text changes after a search,
                      the pass size doesn't. */}
                  <div
                    className="sk-tripAssist"
                    role="status"
                    style={{
                      alignItems: "flex-start",
                      lineHeight: 1.45,
                      minHeight: "2.9em",
                    }}
                  >
                    {bpStatus}
                  </div>

                  {prefillData && !prefillDismissed && (
                    <div className="sk-prefill-strip">
                      {!prefillEditing ? (
                        <div className="sk-prefill-collapsed">
                          <span className="sk-prefill-bolt">
                            <Zap size={12} />
                          </span>
                          <span className="sk-prefill-loaded">
                            Loaded from AI
                          </span>
                          <span className="sk-prefill-divider">·</span>
                          {destCity && (
                            <span className="sk-prefill-chip">
                              <MapPin
                                size={11}
                                style={{
                                  marginRight: 3,
                                  verticalAlign: "middle",
                                }}
                              />
                              {destCity}
                            </span>
                          )}
                          {budgetSeed && (
                            <span className="sk-prefill-chip">
                              <DollarSign
                                size={11}
                                style={{
                                  marginRight: 2,
                                  verticalAlign: "middle",
                                }}
                              />
                              {budgetSeed.toLocaleString("en-US")}
                            </span>
                          )}
                          {tripDaySeed && (
                            <span className="sk-prefill-chip">
                              <Calendar
                                size={11}
                                style={{
                                  marginRight: 3,
                                  verticalAlign: "middle",
                                }}
                              />
                              {tripDaySeed}d
                            </span>
                          )}
                          <button
                            type="button"
                            className="sk-prefill-editBtn"
                            onClick={() => setPrefillEditing(true)}
                          >
                            <EditOutlined /> Edit
                          </button>
                          <button
                            type="button"
                            className="sk-prefill-dismissBtn"
                            onClick={() => setPrefillDismissed(true)}
                            aria-label="Dismiss"
                          >
                            <CloseOutlined />
                          </button>
                        </div>
                      ) : (
                        <div className="sk-prefill-expanded">
                          <div className="sk-prefill-expandedRow">
                            <div className="sk-prefill-field sk-prefill-field--grow">
                              <label className="sk-prefill-label">Prompt</label>
                              <Input
                                className="sk-prefill-input"
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                              />
                            </div>
                            <div className="sk-prefill-field">
                              <label className="sk-prefill-label">
                                Budget ($)
                              </label>
                              <InputNumber
                                className="sk-prefill-numInput"
                                prefix="$"
                                value={editBudget}
                                min={0}
                                step={100}
                                controls={false}
                                onChange={(v) => setEditBudget(v ?? null)}
                                placeholder="2500"
                              />
                            </div>
                            <div className="sk-prefill-field">
                              <label className="sk-prefill-label">Nights</label>
                              <InputNumber
                                className="sk-prefill-numInput"
                                value={editDays}
                                min={1}
                                max={60}
                                controls={false}
                                onChange={(v) => setEditDays(v ?? null)}
                                placeholder="7"
                              />
                            </div>
                          </div>
                          <div className="sk-prefill-expandedActions">
                            <button
                              type="button"
                              className="sk-prefill-saveBtn"
                              onClick={handlePrefillSave}
                            >
                              <CheckOutlined /> Save
                            </button>
                            <button
                              type="button"
                              className="sk-prefill-cancelBtn"
                              onClick={() => setPrefillEditing(false)}
                            >
                              <CloseOutlined /> Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Weather at the destination (real forecast) ──
                    Collapsed by default so the pass doesn't grow after a search. */}
                {destCity && (
                  <div className="sk-weather-wrap">
                    <button
                      type="button"
                      className="sk-weather-toggle"
                      aria-expanded={weatherOpen}
                      onClick={() => setWeatherOpen((o) => !o)}
                    >
                      <span>Weather in {destCity}</span>
                      <span className="sk-weather-toggle-cta">
                        {weatherOpen ? "Hide" : "Show"}
                        <ChevronUp
                          size={14}
                          aria-hidden="true"
                          style={{
                            transform: weatherOpen ? "none" : "rotate(180deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </span>
                    </button>
                    {weatherOpen && (
                      <WeatherStrip
                        city={destCity}
                        start={tripDates[0]}
                        end={tripDates[1]}
                      />
                    )}
                  </div>
                )}

                {/* Events: say plainly who sells what (no XP / price watch —
                    tickets are bought on Ticketmaster, not Skyrio). */}
                {tab === "Events" && (
                  <div className="sk-events-stubnote">
                    <strong>Tickets are sold by Ticketmaster.</strong>
                    <span>Flights and hotels are booked on Skyrio.</span>
                  </div>
                )}

                {/* ── Price Watch Card — flights only (it watches a flight route) ── */}
                {tab === "Flights" && (
                  <div className="sk-price-watch-card">
                    <div className="sk-pwc-header">
                      <div className="sk-pwc-xp">
                        <Zap size={13} className="sk-pwc-xp-icon" />
                        <span className="sk-pwc-xp-label">
                          Earn up to <strong>150 XP</strong> on booking
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`sk-pwc-toggle${
                          priceWatchOn ? " is-on" : ""
                        }`}
                        onClick={handlePriceWatchToggle}
                        aria-pressed={priceWatchOn}
                        disabled={priceWatchBusy}
                        aria-busy={priceWatchBusy}
                      >
                        {priceWatchOn ? (
                          <Bell size={13} className="sk-pwc-bell" />
                        ) : (
                          <BellOff size={13} className="sk-pwc-bell" />
                        )}
                        <span className="sk-pwc-toggle-label">
                          Price Watch {priceWatchOn ? "On" : "Off"}
                        </span>
                        <span
                          className={`sk-pwc-dot${
                            priceWatchOn ? " is-on" : ""
                          }`}
                        />
                      </button>
                    </div>
                    {(priceWatchOn || priceWatchRoute) && (
                      <div className="sk-pwc-desc">
                        {priceWatchOn
                          ? `Watching ${
                              priceWatchRoute?.from ?? "your route"
                            } → ${priceWatchRoute?.to ?? "destination"}${
                              Number.isFinite(Number(priceWatchRoute?.price))
                                ? ` from $${wholeUsd(priceWatchRoute.price)}`
                                : ""
                            }. We'll alert you if it drops.`
                          : `Alert me if ${priceWatchRoute.from} → ${priceWatchRoute.to} gets cheaper.`}
                      </div>
                    )}
                  </div>
                )}

                <div className="sk-bp-barcode" aria-hidden="true" />
              </aside>
            </div>
          </section>
        </div>

        <Row gutter={[24, 24]} className="sk-results-wrap">
          {/* The budget column only shows when planning on a budget;
              otherwise results get the full width. */}
          <Col xs={24} lg={!syncGroupId && planMode === "budget" ? 16 : 24}>
            <div className="sk-resultsHeader">
              <Title level={4} className="sk-section-title">
                {resultsTitle}
              </Title>
              <div className="sk-resultsSub">
                {tab === "Stays"
                  ? isSearching
                    ? `Searching hotels in ${destCity || "your destination"}…`
                    : hotelResults.length > 0
                    ? `Cheapest first · ${destCity} · Refunds set by each hotel`
                    : "Search above to find hotels."
                  : tab === "Excursions"
                  ? isSearching
                    ? `Searching experiences in ${
                        destCity || "your destination"
                      }…`
                    : excursionResults.length > 0
                    ? `Powered by Viator · ${destCity}`
                    : "Search above to find tours & activities."
                  : tab === "Cars"
                  ? carSearch
                    ? `${carSearch.label} · pay the rental company at pickup`
                    : "Search above to find rental cars."
                  : tab === "Events"
                  ? eventsSearch
                    ? `Happening in ${eventsSearch.city} · tickets sold on Ticketmaster`
                    : "Search above to find games, concerts & shows."
                  : isSearching
                  ? `Searching ${originCity || fromCode} → ${
                      prefillData?.iata ?? destCity
                    } · live prices`
                  : hasReturnData && selectedGroup
                  ? "Pick a return time to continue"
                  : flightDisplayCount > 0
                  ? `Sorted by price · ${
                      flightResults[0]?.origin || originCity || fromCode
                    } → ${prefillData?.iata ?? destCity}${
                      activeFilterCount > 0
                        ? ` · ${activeFilterCount} filter${
                            activeFilterCount > 1 ? "s" : ""
                          } active`
                        : ""
                    }`
                  : flightResults.length > 0 && flightDisplayCount === 0
                  ? "Try fewer filters."
                  : "Search above to find flights."}
              </div>
              {tab === "Flights" &&
                !isSearching &&
                !selectedGroup &&
                flightResults.length > 0 &&
                flightDisplayCount === 0 && (
                  <button
                    type="button"
                    className="sk-clear-filters-cta"
                    onClick={() => setSmartFilters(DEFAULT_FILTERS)}
                  >
                    Clear all filters
                  </button>
                )}
              {/* A heads-up so nobody wonders how to add a hotel after the flight. */}
              {tab === "Flights" &&
                !isSearching &&
                !syncGroupId &&
                !packagePlan &&
                flightResults.length > 0 && (
                  <p className="sk-next-hint">
                    <BedDouble size={14} aria-hidden="true" /> After you book your
                    flight, we&apos;ll take you to stays, cars and things to do
                    for the same dates.
                  </p>
                )}
              {priceCheck &&
                !isSearching &&
                (tab === "Flights" || tab === "Stays") && (
                  <PriceCheckBanner
                    check={priceCheck}
                    tab={tab}
                    flights={flightResults}
                    hotels={hotelResults}
                  />
                )}
            </div>

            {/* ── Your trip budget (Sync Together) ── */}
            {syncGroupId &&
              ["Flights", "Stays", "Excursions", "Cars", "Events"].includes(
                tab
              ) && (
                <TripBudgetBar
                  groupId={syncGroupId}
                  tb={tripBudget}
                  kind={
                    tab === "Stays"
                      ? "stays"
                      : tab === "Excursions"
                      ? "activities"
                      : tab === "Cars"
                      ? "cars"
                      : tab === "Events"
                      ? "events"
                      : "flights"
                  }
                  destination={syncInfo?.destination || undefined}
                  activityIdeas={
                    (syncInfo?.shortlist || []).filter(
                      (i) =>
                        (i.kind === "activity" || i.kind === "event") &&
                        i.status !== "removed"
                    ).length
                  }
                  carIdeas={
                    (syncInfo?.shortlist || []).filter(
                      (i) => i.kind === "car" && i.status !== "removed"
                    ).length
                  }
                  onFind={(k) => {
                    const {
                      groupId: _g,
                      tab: nextTab,
                      auto: _a,
                      ...params
                    } = tripSearchParams(syncGroupId, syncInfo, k, {
                      from: searchParams.get("from") || undefined,
                    });
                    runHandoff({ tab: nextTab, params });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  overCount={
                    isSearching || !(tab === "Flights" || tab === "Stays")
                      ? 0
                      : budgetBarFit.overCount
                  }
                  noneFit={
                    !isSearching &&
                    (tab === "Flights" || tab === "Stays") &&
                    budgetBarFit.noneFit
                  }
                  showingOver={showOverBudget}
                  onToggleOver={() => setShowOverBudget((v) => !v)}
                  onSaved={handleBudgetSaved}
                />
              )}

            {isSearching && tab === "Flights" && (
              <FlightSkeleton destCity={destCity} fromCode={fromCode} />
            )}
            {isSearching && tab === "Stays" && (
              <FlightSkeleton destCity={destCity} fromCode={null} />
            )}

            {!isSearching && tab === "Flights" && autoSearchError && (
              <div className="sk-search-error">
                <IconWarning size={14} /> {autoSearchError} —{" "}
                <button
                  type="button"
                  className="sk-search-retry"
                  onClick={() => {
                    setAutoSearchError(null);
                    runAutoSearch();
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!isSearching && tab === "Flights" && searchError && (
              <div className="sk-search-error" role="alert">
                <IconWarning size={14} /> {searchError} —{" "}
                <button
                  type="button"
                  className="sk-search-retry"
                  onClick={() => flightRetryRef.current?.()}
                >
                  Try again
                </button>
              </div>
            )}

            {/* One-way results — unchanged single-flight cards, one per
                journey (there's no return leg to group by, so no
                two-step flow needed). */}
            {!isSearching &&
              tab === "Flights" &&
              !hasReturnData &&
              paginatedFlights.length > 0 &&
              paginatedFlights.map((flight) => (
                <Card
                  key={flight.id}
                  variant="borderless"
                  className={`sk-result-card${
                    selectedResult.id === flight.id ? " is-selected" : ""
                  }`}
                  onClick={() =>
                    handleSelectResult({
                      id: flight.id,
                      title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
                      total: parseFloat(flight.totalAmount),
                    })
                  }
                  style={{ cursor: "pointer", marginBottom: 14 }}
                >
                  <div className="sk-resultRow">
                    <div
                      className="sk-thumb sk-thumb--logo"
                      style={
                        flight.ownerLogo
                          ? {
                              backgroundImage: `url(${crispLogo(
                                flight.ownerLogo
                              )})`,
                              backgroundSize: "60%",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "center",
                              backgroundColor: "rgba(255,255,255,0.06)",
                            }
                          : undefined
                      }
                    />
                    <div className="sk-resultMain">
                      <div className="sk-resultTop">
                        <div>
                          <div className="sk-resultTitle">{flight.owner}</div>
                          {flight.soldBy && (
                            <div className="sk-soldBy">Ticket sold by {flight.soldBy}</div>
                          )}
                          <div className="sk-resultMeta">
                            <span className="sk-metaItem">
                              <EnvironmentOutlined /> {flight.origin} →{" "}
                              {flight.destination}
                            </span>
                            <span className="sk-metaDot">·</span>
                            <span className="sk-metaItem">
                              {describeStops(flight.stops, flight.slices?.[0])}
                            </span>
                            {flight.departingAt && (
                              <>
                                <span className="sk-metaDot">·</span>
                                <span className="sk-metaItem">
                                  {dayjs(flight.departingAt).format(
                                    "MMM D · h:mm A"
                                  )}{" "}
                                  → {dayjs(flight.arrivingAt).format("h:mm A")}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="sk-pickedWhy">
                            Best price + comfort score
                          </div>
                        </div>
                        <div className="sk-resultRight">
                          <div className="sk-priceLine">
                            <span className="sk-priceAmt">
                              ${wholeUsd(flight.totalAmount)}
                            </span>
                            <span className="sk-priceSub">
                              {flight.totalCurrency}
                            </span>
                          </div>
                          <SaveTripButton
                            size="small"
                            variant="ghost"
                            label="Save"
                            tripData={{
                              tripType: "flight",
                              title: `${flight.owner} · ${flight.origin} → ${flight.destination}`,
                              destination: flight.destination,
                              price: parseFloat(flight.totalAmount),
                              currency: flight.totalCurrency || "USD",
                              startDate: flight.departingAt
                                ? dayjs(flight.departingAt).format("YYYY-MM-DD")
                                : "",
                              metadata: {
                                flightId: flight.id,
                                stops: flight.stops,
                              },
                            }}
                            onSaveError={(msg) => antdMessage.error(msg)}
                          />
                          <button
                            type="button"
                            className={`sk-watch-btn${
                              watchingId === flight.id ? " is-watching" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWatchFlight(flight);
                            }}
                            title={
                              watchingId === flight.id
                                ? "Stop watching price"
                                : "Watch price"
                            }
                          >
                            {watchingId === flight.id ? (
                              <>
                                <Bell
                                  size={11}
                                  style={{
                                    marginRight: 3,
                                    verticalAlign: "middle",
                                  }}
                                />{" "}
                                Watching
                              </>
                            ) : (
                              <>
                                <BellOff
                                  size={11}
                                  style={{
                                    marginRight: 3,
                                    verticalAlign: "middle",
                                  }}
                                />{" "}
                                Watch
                              </>
                            )}
                          </button>
                          <Button
                            className={`sk-btn-orange sk-pick-btn${
                              selectedResult.id === flight.id
                                ? " is-picked"
                                : ""
                            }`}
                            size="small"
                            aria-pressed={selectedResult.id === flight.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectFlightForCheckout(flight);
                            }}
                          >
                            {selectedResult.id === flight.id ? (
                              <>
                                <Check size={14} aria-hidden="true" />
                                {packagePlan ? "Added" : "Selected"}
                              </>
                            ) : packagePlan ? (
                              "Add to trip"
                            ) : (
                              "Book now"
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="sk-tagRow">
                        <BudgetTag price={flight.totalAmount} />
                        <span className="sk-tag sk-tag-good">
                          {flight.stops === 0
                            ? "Nonstop"
                            : `${flight.stops} stop`}
                        </span>
                        <span className="sk-tag sk-tag-orange">
                          {flight.ownerCode}
                        </span>
                        {!budgetOn &&
                          budgetSeed &&
                          parseFloat(flight.totalAmount) <= budgetSeed && (
                            <span className="sk-tag sk-tag-good">
                              Within budget
                            </span>
                          )}
                        <span className="sk-tag sk-tag-xp">
                          <Zap
                            size={11}
                            style={{ marginRight: 3, verticalAlign: "middle" }}
                          />{" "}
                          {getFlightXP(flight)} XP
                        </span>
                      </div>
                    </div>
                  </div>
                  {syncGroupId && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 10,
                      }}
                    >
                      <SuggestBtn kind="flight" data={flight} />
                    </div>
                  )}
                </Card>
              ))}

            {/* Round-trip results, STEP 1 — one card per outbound
                flight. Clicking commits to that outbound and moves to
                step 2 (return-flight picker) below, unless there's
                only one possible return, in which case it books
                immediately, same as a one-way flight would. */}
            {!isSearching &&
              tab === "Flights" &&
              hasReturnData &&
              !selectedGroup &&
              paginatedGroups.length > 0 &&
              paginatedGroups.map((group) => {
                const outbound = group.options[0];
                const cheapest = group.cheapest;
                const multipleReturns = group.options.length > 1;

                return (
                  <Card
                    key={group.key}
                    variant="borderless"
                    className={`sk-result-card${
                      selectedResult.id === cheapest.id ? " is-selected" : ""
                    }`}
                    onClick={() =>
                      handleSelectResult({
                        id: cheapest.id,
                        title: `${outbound.owner} · ${outbound.origin} → ${outbound.destination}`,
                        total: parseFloat(cheapest.totalAmount),
                      })
                    }
                    style={{ cursor: "pointer", marginBottom: 14 }}
                  >
                    <div className="sk-resultRow">
                      <div
                        className="sk-thumb sk-thumb--logo"
                        style={
                          outbound.ownerLogo
                            ? {
                                backgroundImage: `url(${crispLogo(
                                  outbound.ownerLogo
                                )})`,
                                backgroundSize: "60%",
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                                backgroundColor: "rgba(255,255,255,0.06)",
                              }
                            : undefined
                        }
                      />
                      <div className="sk-resultMain">
                        <div className="sk-resultTop">
                          <div>
                            <div className="sk-resultTitle">
                              {outbound.owner}
                            </div>
                          {outbound.soldBy && (
                            <div className="sk-soldBy">Ticket sold by {outbound.soldBy}</div>
                          )}
                            <div className="sk-resultMeta">
                              <span className="sk-metaItem">
                                <EnvironmentOutlined /> {outbound.origin} →{" "}
                                {outbound.destination}
                              </span>
                              <span className="sk-metaDot">·</span>
                              <span className="sk-metaItem">
                                {describeStops(
                                  outbound.stops,
                                  outbound.slices?.[0]
                                )}
                              </span>
                              {outbound.departingAt && (
                                <>
                                  <span className="sk-metaDot">·</span>
                                  <span className="sk-metaItem">
                                    {dayjs(outbound.departingAt).format(
                                      "MMM D · h:mm A"
                                    )}{" "}
                                    →{" "}
                                    {dayjs(outbound.arrivingAt).format(
                                      "h:mm A"
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="sk-pickedWhy">
                              {multipleReturns
                                ? `${group.options.length} return times to choose from`
                                : "Best price + comfort score"}
                            </div>
                          </div>
                          <div className="sk-resultRight">
                            <div className="sk-priceLine">
                              {multipleReturns && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.45)",
                                    marginRight: 4,
                                  }}
                                >
                                  from
                                </span>
                              )}
                              <span className="sk-priceAmt">
                                ${wholeUsd(cheapest.totalAmount)}
                              </span>
                              <span className="sk-priceSub">
                                {cheapest.totalCurrency}
                              </span>
                            </div>
                            <SaveTripButton
                              size="small"
                              variant="ghost"
                              label="Save"
                              tripData={{
                                tripType: "flight",
                                title: `${outbound.owner} · ${outbound.origin} → ${outbound.destination}`,
                                destination: outbound.destination,
                                price: parseFloat(cheapest.totalAmount),
                                currency: cheapest.totalCurrency || "USD",
                                startDate: outbound.departingAt
                                  ? dayjs(outbound.departingAt).format(
                                      "YYYY-MM-DD"
                                    )
                                  : "",
                                metadata: {
                                  flightId: cheapest.id,
                                  stops: outbound.stops,
                                },
                              }}
                              onSaveError={(msg) => antdMessage.error(msg)}
                            />
                            <button
                              type="button"
                              className={`sk-watch-btn${
                                watchingId === cheapest.id ? " is-watching" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWatchFlight(cheapest);
                              }}
                              title={
                                watchingId === cheapest.id
                                  ? "Stop watching price"
                                  : "Watch price"
                              }
                            >
                              {watchingId === cheapest.id ? (
                                <>
                                  <Bell
                                    size={11}
                                    style={{
                                      marginRight: 3,
                                      verticalAlign: "middle",
                                    }}
                                  />{" "}
                                  Watching
                                </>
                              ) : (
                                <>
                                  <BellOff
                                    size={11}
                                    style={{
                                      marginRight: 3,
                                      verticalAlign: "middle",
                                    }}
                                  />{" "}
                                  Watch
                                </>
                              )}
                            </button>
                            <Button
                              className={`sk-btn-orange sk-pick-btn${
                                selectedResult.id === cheapest.id ||
                                selectedOutboundGroupKey === group.key
                                  ? " is-picked"
                                  : ""
                              }`}
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectResult({
                                  id: cheapest.id,
                                  title: `${outbound.owner} · ${outbound.origin} → ${outbound.destination}`,
                                  total: parseFloat(cheapest.totalAmount),
                                });
                                // FIX: previously skipped straight to
                                // checkout when a group had only one
                                // return option — inconsistent with
                                // every other round-trip result, which
                                // showed a review step. Now every
                                // round-trip flight always goes through
                                // "Choose your return flight," even if
                                // there's only one option to confirm —
                                // consistent with how the person
                                // actually books, and it's still just
                                // one extra click for the single-option
                                // case.
                                setSelectedOutboundGroupKey(group.key);
                              }}
                            >
                              {selectedResult.id === cheapest.id ||
                              selectedOutboundGroupKey === group.key ? (
                                <>
                                  <Check size={14} aria-hidden="true" />
                                  Selected
                                </>
                              ) : (
                                "Select flight"
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="sk-tagRow">
                          <BudgetTag price={cheapest.totalAmount} />
                          <span className="sk-tag sk-tag-good">
                            {outbound.stops === 0
                              ? "Nonstop"
                              : `${outbound.stops} stop`}
                          </span>
                          <span className="sk-tag sk-tag-orange">
                            {outbound.ownerCode}
                          </span>
                          {!budgetOn &&
                            budgetSeed &&
                            parseFloat(cheapest.totalAmount) <= budgetSeed && (
                              <span className="sk-tag sk-tag-good">
                                Within budget
                              </span>
                            )}
                          <span className="sk-tag sk-tag-xp">
                            <Zap
                              size={11}
                              style={{
                                marginRight: 3,
                                verticalAlign: "middle",
                              }}
                            />{" "}
                            {getFlightXP(cheapest)} XP
                          </span>
                        </div>
                      </div>
                    </div>
                    {syncGroupId && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginTop: 10,
                        }}
                      >
                        <SuggestBtn kind="flight" data={cheapest} />
                      </div>
                    )}
                  </Card>
                );
              })}

            {/* Round-trip results, STEP 2 — return-flight picker for
                the outbound flight chosen in step 1. Shown instead of
                the outbound list entirely, with a way back up top,
                the same way Google Flights/Expedia hand off from
                "pick your departing flight" to "pick your return
                flight" as two distinct screens. */}
            {!isSearching &&
              tab === "Flights" &&
              hasReturnData &&
              selectedGroup && (
                <>
                  {/* Restyled from a plain text link to a bordered
                    button — the text link was easy to miss as an
                    actual control. This is the primary way back if
                    someone changes their mind about the departing
                    flight after reaching the return-flight step. */}
                  <button
                    type="button"
                    onClick={() => setSelectedOutboundGroupKey(null)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      padding: "9px 16px",
                      marginBottom: 18,
                      transition: "border-color .2s, background .2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,138,42,0.5)";
                      e.currentTarget.style.background =
                        "rgba(255,138,42,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.15)";
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                    }}
                  >
                    <ArrowLeftOutlined /> Back to departing flights
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      marginBottom: 20,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.45)",
                          letterSpacing: ".04em",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        Departing flight selected
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {selectedGroup.options[0].owner} ·{" "}
                        {selectedGroup.options[0].origin} →{" "}
                        {selectedGroup.options[0].destination}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.55)",
                          marginTop: 2,
                        }}
                      >
                        {dayjs(selectedGroup.options[0].departingAt).format(
                          "ddd, MMM D · h:mm A"
                        )}{" "}
                        →{" "}
                        {dayjs(selectedGroup.options[0].arrivingAt).format(
                          "h:mm A"
                        )}
                        {" · "}
                        {describeStops(
                          selectedGroup.options[0].stops,
                          selectedGroup.options[0].slices?.[0]
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOutboundGroupKey(null)}
                      style={{
                        background: "none",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 10,
                        color: "rgba(255,255,255,0.75)",
                        padding: "8px 14px",
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        flexShrink: 0,
                      }}
                    >
                      Change flight
                    </button>
                  </div>

                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      marginBottom: 14,
                    }}
                  >
                    Choose your return flight
                  </div>

                  {selectedGroup.options
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.returningAt) - new Date(b.returningAt)
                    )
                    .map((opt) => {
                      const outbound = selectedGroup.options[0];
                      const returnSlice = opt.slices?.[1];
                      const retOrigin =
                        returnSlice?.origin ?? outbound.destination;
                      const retDestination =
                        returnSlice?.destination ?? outbound.origin;
                      const retStops = returnSlice?.stops ?? 0;

                      return (
                        <Card
                          key={opt.id}
                          variant="borderless"
                          className={`sk-result-card${
                            selectedResult.id === opt.id ? " is-selected" : ""
                          }`}
                          style={{ cursor: "pointer", marginBottom: 14 }}
                          onClick={() => selectFlightForCheckout(opt)}
                        >
                          <div className="sk-resultRow">
                            <div
                              className="sk-thumb sk-thumb--logo"
                              style={
                                outbound.ownerLogo
                                  ? {
                                      backgroundImage: `url(${crispLogo(
                                        outbound.ownerLogo
                                      )})`,
                                      backgroundSize: "60%",
                                      backgroundRepeat: "no-repeat",
                                      backgroundPosition: "center",
                                      backgroundColor: "rgba(255,255,255,0.06)",
                                    }
                                  : undefined
                              }
                            />
                            <div className="sk-resultMain">
                              <div className="sk-resultTop">
                                <div>
                                  <div className="sk-resultTitle">
                                    {opt.owner}
                                  </div>
                                  <div className="sk-resultMeta">
                                    <span className="sk-metaItem">
                                      <EnvironmentOutlined /> {retOrigin} →{" "}
                                      {retDestination}
                                    </span>
                                    <span className="sk-metaDot">·</span>
                                    <span className="sk-metaItem">
                                      {describeStops(retStops, returnSlice)}
                                    </span>
                                    {opt.returningAt && (
                                      <>
                                        <span className="sk-metaDot">·</span>
                                        <span className="sk-metaItem">
                                          {dayjs(opt.returningAt).format(
                                            "MMM D · h:mm A"
                                          )}
                                          {opt.returnArrivingAt &&
                                            ` → ${dayjs(
                                              opt.returnArrivingAt
                                            ).format("h:mm A")}`}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <div className="sk-pickedWhy">
                                    Total price for this trip
                                  </div>
                                </div>
                                <div className="sk-resultRight">
                                  <div className="sk-priceLine">
                                    <span className="sk-priceAmt">
                                      ${wholeUsd(opt.totalAmount)}
                                    </span>
                                    <span className="sk-priceSub">
                                      {opt.totalCurrency}
                                    </span>
                                  </div>
                                  <Button
                                    className={`sk-btn-orange sk-pick-btn${
                                      selectedResult.id === opt.id
                                        ? " is-picked"
                                        : ""
                                    }`}
                                    size="small"
                                    aria-pressed={selectedResult.id === opt.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectFlightForCheckout(opt);
                                    }}
                                  >
                                    {selectedResult.id === opt.id ? (
                                      <>
                                        <Check size={14} aria-hidden="true" />
                                        {packagePlan ? "Added" : "Selected"}
                                      </>
                                    ) : packagePlan ? (
                                      "Add to trip"
                                    ) : (
                                      "Select"
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <div className="sk-tagRow">
                                <BudgetTag price={opt.totalAmount} />
                                <span className="sk-tag sk-tag-good">
                                  {retStops === 0
                                    ? "Nonstop"
                                    : `${retStops} stop`}
                                </span>
                                {!budgetOn &&
                                  budgetSeed &&
                                  parseFloat(opt.totalAmount) <= budgetSeed && (
                                    <span className="sk-tag sk-tag-good">
                                      Within budget
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                          {syncGroupId && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginTop: 10,
                              }}
                            >
                              <SuggestBtn kind="flight" data={opt} />
                            </div>
                          )}
                        </Card>
                      );
                    })}
                </>
              )}

            {/* ── How to book more than one room ── */}
            {!isSearching &&
              tab === "Stays" &&
              paginatedHotels.length > 0 &&
              !roomsTipHidden &&
              roomCart.length === 0 && <RoomsHowTo onClose={hideRoomsTip} />}

            {/* ── Hotel result cards ── */}
            {!isSearching &&
              tab === "Stays" &&
              paginatedHotels.length > 0 &&
              paginatedHotels.map((hotel) => {
                const countInCart = roomCart.filter(
                  (r) => roomKey(r) === roomKey(hotel)
                ).length;
                const inCart = countInCart > 0;
                return (
                  <Card
                    key={roomKey(hotel)}
                    variant="borderless"
                    className={`sk-result-card${inCart ? " is-selected" : ""}`}
                    style={{ cursor: "pointer", marginBottom: 14 }}
                  >
                    <div className="sk-resultRow">
                      <div
                        className="sk-thumb"
                        style={
                          hotel.thumbnail
                            ? {
                                backgroundImage: `url(${hotel.thumbnail})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : undefined
                        }
                      />
                      <div className="sk-resultMain">
                        <div className="sk-resultTop">
                          <div>
                            <div className="sk-resultTitle">{hotel.name}</div>
                            <div className="sk-resultMeta">
                              {hotel.address && (
                                <span className="sk-metaItem">
                                  <EnvironmentOutlined /> {hotel.address}
                                </span>
                              )}
                              {hotel.stars && (
                                <>
                                  <span className="sk-metaDot">·</span>
                                  <span className="sk-metaItem">
                                    {hotel.stars}★
                                  </span>
                                </>
                              )}
                              {hotel.rating && (
                                <>
                                  <span className="sk-metaDot">·</span>
                                  <span className="sk-metaItem">
                                    {hotel.rating}/10
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="sk-pickedWhy">
                              {hotel.roomName}
                              {hotel.boardName ? ` · ${hotel.boardName}` : ""}
                            </div>
                          </div>
                          <div className="sk-resultRight">
                            <div className="sk-priceLine">
                              <span className="sk-priceAmt">
                                ${wholeUsd(hotel.totalAmount)}
                              </span>
                              <span className="sk-priceSub">
                                {hotel.totalCurrency}
                              </span>
                            </div>
                            {/* XP this stay earns (base, before plan multiplier) —
                                same flat amount the server grants for hotels. */}
                            <span
                              className="sk-tag sk-tag-xp"
                              style={{ alignSelf: "flex-end", marginTop: 4 }}
                            >
                              <Zap
                                size={11}
                                style={{
                                  marginRight: 3,
                                  verticalAlign: "middle",
                                }}
                              />{" "}
                              {STAY_BOOKING_XP} XP
                            </span>
                            {(() => {
                              const nights =
                                hotel.checkin && hotel.checkout
                                  ? dayjs(hotel.checkout).diff(
                                      dayjs(hotel.checkin),
                                      "day"
                                    )
                                  : 0;
                              const total = Number(hotel.totalAmount);
                              if (!(nights > 0) || !Number.isFinite(total))
                                return null;
                              return (
                                <div className="sk-pernight">
                                  $
                                  {Math.round(total / nights).toLocaleString(
                                    "en-US"
                                  )}
                                  /night · {nights} night
                                  {nights !== 1 ? "s" : ""} total
                                </div>
                              );
                            })()}
                            {/* Package with a flight picked: what the WHOLE
                                trip costs with this room — just the two real
                                prices added up, no bundle "discount". */}
                            {packagePlan?.flight &&
                              Number.isFinite(Number(hotel.totalAmount)) &&
                              (() => {
                                // A price for 1 room, on a trip that needs
                                // more, is that room once per room.
                                const need = Math.max(1, Number(packagePlan.rooms) || 1);
                                const times = roomsIn(hotel) === 1 ? need : 1;
                                const tp = tripPrice({
                                  flight: packagePlan.flight,
                                  stay: {
                                    total: Number(hotel.totalAmount) * times,
                                    rooms: Math.max(roomsIn(hotel), times),
                                    checkin: hotel.checkin,
                                    checkout: hotel.checkout,
                                  },
                                  travelers: packagePlan.adults,
                                });
                                return (
                                  <div className="sk-pkg-trip-total">
                                    <strong>
                                      ${wholeUsd(tp.tripTotal)} trip total
                                    </strong>
                                    <span>
                                      ${wholeUsd(tp.flightTotal)} flight + $
                                      {wholeUsd(tp.stayTotal)} stay
                                      {times > 1 ? ` (${times} rooms)` : ""}
                                      {tp.travelers > 1
                                        ? ` · $${wholeUsd(tp.perPerson)} per person`
                                        : ""}
                                    </span>
                                  </div>
                                );
                              })()}
                            <SaveTripButton
                              size="small"
                              variant="ghost"
                              label="Save"
                              tripData={{
                                tripType: "hotel",
                                title: hotel.name,
                                destination: hotel.address || destCity,
                                price: hotel.totalAmount ?? 0,
                                currency: hotel.totalCurrency || "USD",
                                startDate: hotel.checkin || "",
                                metadata: {
                                  hotelId: hotel.hotelId,
                                  offerId: hotel.offerId,
                                },
                              }}
                              onSaveError={(msg) => antdMessage.error(msg)}
                            />
                            {/* Room actions:
                                - not in trip: "Add to trip" (keep browsing)
                                - in trip: "In your trip" + − N rooms +
                                - main button always says what it'll do */}
                            <div className="sk-hotel-actions">
                              {inCart ? (
                                <div className="sk-incart">
                                  <span className="sk-incart-label">
                                    <Check size={13} aria-hidden="true" /> In
                                    your trip
                                  </span>
                                  <RoomStepper
                                    count={countInCart}
                                    perEntry={roomsIn(hotel)}
                                    label={hotel.roomName || hotel.name}
                                    onMinus={() => removeRoomFromCart(hotel)}
                                    onPlus={() => addRoomToCart(hotel)}
                                    plusDisabled={
                                      roomCart.length >= MAX_ROOMS_PER_TRIP
                                    }
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="sk-add-room-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addRoomToCart(hotel);
                                  }}
                                  title="Add this room and keep browsing"
                                >
                                  <Plus size={15} aria-hidden="true" />
                                  Add to trip
                                </button>
                              )}
                              <Button
                                className="sk-btn-orange sk-hotel-main"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (inCart) handleCheckoutCart();
                                  else handleBookSingleRoom(hotel);
                                }}
                              >
                                {inCart
                                  ? `Check out ${countRooms(roomCart)} room${
                                      countRooms(roomCart) !== 1 ? "s" : ""
                                    }`
                                  : roomCart.length
                                  ? "Add & check out"
                                  : "Book this room"}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="sk-tagRow">
                          <BudgetTag price={hotel.totalAmount} />
                          {hotel.refundableTag === "RFN" && (
                            <span
                              className="sk-tag sk-tag-good"
                              title="The hotel's policy for this rate, not Skyrio's"
                            >
                              Refundable (hotel policy)
                            </span>
                          )}
                          {hotel.refundableTag === "NRFN" && (
                            <span
                              className="sk-tag sk-tag-orange"
                              title="The hotel's policy for this rate, not Skyrio's"
                            >
                              Non-refundable (hotel policy)
                            </span>
                          )}
                          {depositOf(hotel) && (
                            <span
                              className="sk-tag sk-tag-orange"
                              title={`${depositOf(hotel).headline} Paid to the hotel at check-in, not to Skyrio. Details at checkout.`}
                            >
                              {depositOf(hotel).cash && !depositOf(hotel).card
                                ? `Cash deposit${depositOf(hotel).label ? ` ${depositOf(hotel).label}` : ""}`
                                : `Deposit at hotel${depositOf(hotel).label ? ` ${depositOf(hotel).label}` : ""}`}
                            </span>
                          )}
                          {hotel.roomCount > 1 && (
                            <span className="sk-tag sk-tag-xp">
                              <Users
                                size={11}
                                style={{
                                  marginRight: 3,
                                  verticalAlign: "middle",
                                }}
                              />
                              Price covers {hotel.roomCount} rooms
                            </span>
                          )}
                          {groupHotelId && hotel.hotelId === groupHotelId && (
                            <span className="sk-tag sk-tag-xp">
                              <Users
                                size={11}
                                style={{
                                  marginRight: 3,
                                  verticalAlign: "middle",
                                }}
                              />
                              Your group's hotel
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {syncGroupId && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 10,
                        }}
                      >
                        <SuggestBtn kind="hotel" data={hotel} />
                        {syncInfo?.isOrganizer &&
                          hotel.hotelId !== groupHotelId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                makeGroupHotel(hotel);
                              }}
                              disabled={savingGroupHotel === hotel.hotelId}
                              style={{
                                background: "rgba(124,58,237,0.14)",
                                border: "1px solid rgba(124,58,237,0.4)",
                                color: "#fff",
                                borderRadius: 10,
                                padding: "7px 12px",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              {savingGroupHotel === hotel.hotelId
                                ? "Saving…"
                                : "Make this the group's hotel"}
                            </button>
                          )}
                      </div>
                    )}
                  </Card>
                );
              })}

            {tab === "Cars" && carSearch && (
              <CarResults
                search={carSearch}
                groupId={syncGroupId || null}
                renderSuggest={
                  syncGroupId
                    ? (c) => (
                        <SuggestBtn
                          kind="car"
                          data={{ ...c, _search: carSearch }}
                        />
                      )
                    : null
                }
              />
            )}

            {tab === "Events" && eventsSearch && (
              <EventsResults
                key={JSON.stringify(eventsSearch)}
                city={eventsSearch.city}
                state={eventsSearch.state}
                startDate={eventsSearch.startDate}
                endDate={eventsSearch.endDate}
                initialCategory={eventsSearch.category}
                title=""
                onPlanTrip={handlePlanTrip}
                renderSuggest={
                  syncGroupId
                    ? (e) => <SuggestBtn kind="event" data={e} />
                    : null
                }
              />
            )}

            {tab === "Excursions" && (
              <ExcursionResults
                results={excursionResults}
                loading={isSearching}
                destination={destCity}
                renderAction={
                  syncGroupId
                    ? (ex) => <SuggestBtn kind="activity" data={ex} />
                    : undefined
                }
              />
            )}

            {!isSearching && tab === "Flights" && hasMore && (
              <div
                style={{ textAlign: "center", marginTop: 8, marginBottom: 28 }}
              >
                <button
                  type="button"
                  className="sk-view-more-btn"
                  onClick={() => setVisibleCount((c) => c + RESULTS_PER_PAGE)}
                >
                  <ArrowRight
                    size={14}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  View{" "}
                  {Math.min(
                    RESULTS_PER_PAGE,
                    flightDisplayCount - visibleCount
                  )}{" "}
                  more {hasReturnData ? "departing flights" : "flights"}
                  <span style={{ opacity: 0.4, marginLeft: 10, fontSize: 12 }}>
                    {visibleCount} of {flightDisplayCount}
                  </span>
                </button>
              </div>
            )}

            {!isSearching && tab === "Stays" && hotelHasMore && (
              <div
                style={{ textAlign: "center", marginTop: 8, marginBottom: 28 }}
              >
                <button
                  type="button"
                  className="sk-view-more-btn"
                  onClick={() => setVisibleCount((c) => c + RESULTS_PER_PAGE)}
                >
                  <ArrowRight
                    size={14}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  View{" "}
                  {Math.min(
                    RESULTS_PER_PAGE,
                    hotelFit.shown.length - visibleCount
                  )}{" "}
                  more rooms
                  <span style={{ opacity: 0.4, marginLeft: 10, fontSize: 12 }}>
                    {visibleCount} of {hotelFit.shown.length}
                  </span>
                </button>
              </div>
            )}

            {!isSearching &&
              tab === "Stays" &&
              hotelResults.length > 0 &&
              visibleHotels.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 24px",
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "rgba(255,255,255,0.8)",
                      marginBottom: 6,
                    }}
                  >
                    No rooms match these filters
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    Try a higher price or fewer filters.
                  </div>
                  <button
                    type="button"
                    className="sk-clear-filters-cta"
                    onClick={() => setHotelFilters(DEFAULT_HOTEL_FILTERS)}
                  >
                    Clear all filters
                  </button>
                </div>
              )}

            {!isSearching &&
              tab === "Flights" &&
              flightResults.length === 0 &&
              !autoSearchError &&
              !searchError && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "52px 24px",
                    color: "rgba(255,255,255,0.38)",
                    fontSize: 14,
                  }}
                >
                  <div style={{ marginBottom: 14 }}>
                    <PlaneIcon
                      size={40}
                      strokeWidth={1.25}
                      color="rgba(255,255,255,0.28)"
                    />
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 17,
                      color: "rgba(255,255,255,0.75)",
                      letterSpacing: "-0.01em",
                      marginBottom: 7,
                    }}
                  >
                    Ready when you are
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 300,
                      color: "rgba(255,255,255,0.38)",
                    }}
                  >
                    Pick where and when above.
                  </div>
                </div>
              )}

            {!isSearching && tab === "Stays" && hotelResults.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "52px 24px",
                  color: "rgba(255,255,255,0.38)",
                  fontSize: 14,
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <IconHotel size={40} />
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 17,
                    color: "rgba(255,255,255,0.75)",
                    letterSpacing: "-0.01em",
                    marginBottom: 7,
                  }}
                >
                  Ready when you are
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 300,
                    color: "rgba(255,255,255,0.38)",
                  }}
                >
                  Pick a city and dates above.
                </div>
              </div>
            )}
          </Col>

          <Col
            xs={24}
            lg={8}
            style={
              syncGroupId || planMode !== "budget"
                ? { display: "none" }
                : undefined
            }
          >
            <div ref={budgetRef}>
              <TripBudgetCard
                budget={budgetState.planned}
                initialBookingTotal={selectedResult?.total ?? 0}
                initialTripDays={selectedNights}
                initialDestination={destCity}
                onStateChange={handleBudgetChange}
              />
            </div>
          </Col>
        </Row>
      </div>
    </>
  );
}
