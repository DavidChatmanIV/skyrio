import React from "react";
import Navbar from "./components/Navbar";
import SaveTripButton from "./components/SaveTripButton";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-4">Welcome To Skyrio✈️</h1>
        <SaveTripButton />
        {/* Other components like search bar, trip planner, etc. go here */}
      </main>
    </div>
  );
}

export default App;
