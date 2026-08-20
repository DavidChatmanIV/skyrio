import { Outlet } from "react-router-dom";
import SkyrioDTour from "./SkyrioDTour";
import SupportRail from "../components/SupportRail";

export default function Layout() {
  return (
    <>
      {/* All page content renders here */}
      <Outlet />

      {/* First-time onboarding tour — shows once, never again */}
      <SkyrioDTour />

      {/* Merged Feedback + Need Help — single collapsed icon rail */}
      <SupportRail />
    </>
  );
}
