import { Outlet } from "react-router-dom";
import SkyrioDTour from "./SkyrioDTour";
import SupportWidget from "../pages/SupportWidget";
import FeedbackWidget from "../components/FeedbackWidget";

export default function Layout() {
  return (
    <>
      {/* All page content renders here */}
      <Outlet />

      {/* First-time onboarding tour — shows once, never again */}
      <SkyrioDTour />

      {/* Floating 💬 help button — visible on every page */}
      <SupportWidget />

      {/* Floating feedback tab — visible on every page */}
      <FeedbackWidget />
    </>
  );
}
