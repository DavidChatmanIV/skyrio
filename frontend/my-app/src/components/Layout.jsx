import { Outlet } from "react-router-dom";
import SkyrioDTour from "./SkyrioDTour";
import SupportWidget from "../pages/SupportWidget";

export default function Layout() {
  return (
    <>
      {/* All page content renders here */}
      <Outlet />

      {/* First-time onboarding tour — shows once, never again */}
      <SkyrioDTour />

      {/* Floating 💬 help button — visible on every page */}
      <SupportWidget />
    </>
  );
}
