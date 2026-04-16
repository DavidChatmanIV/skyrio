import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notification } from "antd";
import { useAuth } from "../context/AuthContext";
import BoardingPassToast from "../components/BoardingPassToast";

export default function Logout() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const [phase, setPhase] = useState("departing"); // "departing" | "gone"

  // Snapshot name BEFORE logout clears the user
  const nameRef = useRef(
    user?.name ||
      user?.username ||
      (user?.email ? user.email.split("@")[0] : "Explorer")
  );

  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    logout();

    notification.open({
      message: null,
      description: (
        <BoardingPassToast
          name={nameRef.current}
          routeFrom="Skyrio"
          routeTo="Sign-in"
        />
      ),
      placement: "topRight",
      duration: 2.2,
      style: { background: "transparent", boxShadow: "none", padding: 0 },
    });

    // Phase transition for the departure screen
    const fadeTimer = setTimeout(() => setPhase("gone"), 1800);

    const navTimer = setTimeout(() => {
      nav("/login", { replace: true });
    }, 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [logout, nav]);

  return (
    <div className="sk-departurePage" data-phase={phase}>
      <div className="sk-departureGlow" />

      <div className="sk-departureCard">
        <div className="sk-depPlane">✈︎</div>

        <div className="sk-depKicker">BOARDING PASS</div>
        <div className="sk-depTitle">Safe travels, {nameRef.current}</div>
        <div className="sk-depSub">Journey paused — board again anytime.</div>

        <div className="sk-depFlightRow">
          <div className="sk-depStop">
            <div className="sk-depLabel">DEPARTING</div>
            <div className="sk-depValue">Skyrio</div>
          </div>
          <div className="sk-depLine">
            <span className="sk-depDot" />
            <span className="sk-depDash" />
            <span className="sk-depPlaneSmall">✈</span>
            <span className="sk-depDash" />
            <span className="sk-depDot" />
          </div>
          <div className="sk-depStop sk-depRight">
            <div className="sk-depLabel">ARRIVING</div>
            <div className="sk-depValue">Sign-in</div>
          </div>
        </div>

        <div className="sk-depStatus">
          {phase === "departing" ? "Departing…" : "Redirecting"}
        </div>

        <div className="sk-depBarcode">
          {Array.from({ length: 22 }).map((_, i) => (
            <span key={i} className="sk-bar" />
          ))}
        </div>
      </div>
    </div>
  );
}