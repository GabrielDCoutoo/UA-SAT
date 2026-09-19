import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import SatNOGSScheduledPasses from './pages/SatNOGSScheduledPasses';
import UASATMission from './pages/UASATMission';
import TelemetryCharts from './pages/TelemetryCharts';
import Dashboard from './pages/Dashboard';
import TinyGSGlobal from './pages/TinyGSGlobal';
import TinyGSMyStation from './pages/TinyGSMyStation';
import SatNOGSObservations from './pages/SatNOGSObservations';
import SatNOGSScheduled from './pages/SatNOGSScheduled';
import SatNOGSStationsMap from './pages/SatNOGSStationsMap';
import UABalloonTracker from './pages/UABalloonTracker';
import UABalloonLiveStream from './pages/UABalloonLiveStream';
import TinyGSGlobalMap from './pages/TinyGSGlobalMap';
import BackupData from './pages/BackupData';
import UAVBackscatter from './pages/UAVBackscatter';
import SensorData from './pages/SensorData';
import UplinkGroundStation from './pages/UplinkGroundStation';
import GNSSLogger from './pages/GNSSLogger';
import FuturePasses from './pages/FuturePasses';
import AuthGate from './components/auth/AuthGate';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Login só aparece quando uma ação de escrita o exige (ver src/auth.js) */}
        <AuthGate />
        {/* Mobile hamburger — only visible below md breakpoint */}
        <button
          className="fixed top-4 left-4 z-[1001] md:hidden bg-blue-700 hover:bg-blue-600 p-2 rounded-lg text-white transition-colors"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content — offset by sidebar on desktop */}
        <div className="md:ml-64 min-h-screen">
          <Routes>
            <Route path="/"                        element={<Dashboard />} />
            <Route path="/tinygs/global"           element={<TinyGSGlobal />} />
            <Route path="/tinygs/my-station"       element={<TinyGSMyStation />} />
            <Route path="/tinygs/satellites"       element={<TinyGSGlobalMap />} />
            <Route path="/satnogs/observations"    element={<SatNOGSObservations />} />
            <Route path="/satnogs/scheduled"       element={<SatNOGSScheduledPasses />} />
            <Route path="/satnogs/stations"        element={<SatNOGSStationsMap />} />
            <Route path="/satnogs/passes"          element={<FuturePasses />} />
            <Route path="/uasat/balloon"           element={<UABalloonTracker />} />
            <Route path="/uasat/balloon-live"      element={<UABalloonLiveStream />} />
            <Route path="/uasat/mission"           element={<UASATMission />} />
            <Route path="/uasat/telemetry-charts"  element={<TelemetryCharts />} />
            <Route path="/uav/backscatter"         element={<UAVBackscatter />} />
            <Route path="/uav/sensor-data"         element={<SensorData />} />
            <Route path="/settings"                element={<UplinkGroundStation />} />
            <Route path="/backup"                  element={<BackupData />} />
            <Route path="/gnss"                    element={<GNSSLogger />} />
            <Route path="*"                        element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
