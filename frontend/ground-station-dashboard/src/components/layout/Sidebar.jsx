// Sidebar — full Tailwind, mobile-collapsible
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Radio, Satellite, Activity, ChevronDown, ChevronRight,
  Globe, MapPin, Calendar, Telescope, Rocket, Settings,
  Database, Video, LineChart, Info, X, Cpu, Clock,
} from 'lucide-react';

const menuItems = [
  { id: 'home', title: 'Dashboard', icon: Home, path: '/', single: true },
  {
    id: 'tinygs', title: 'TinyGS Network', icon: Radio,
    items: [
      { title: 'Global Packets',  path: '/tinygs/global',     icon: Globe },
      { title: 'My Station',      path: '/tinygs/my-station',  icon: MapPin },
      { title: 'Satellites',      path: '/tinygs/satellites',  icon: Satellite },
    ],
  },
  {
    id: 'satnogs', title: 'SatNOGS', icon: Telescope,
    items: [
      { title: 'Observations',     path: '/satnogs/observations', icon: Activity },
      { title: 'Scheduled Passes', path: '/satnogs/scheduled',    icon: Calendar },
      { title: 'Stations Map',      path: '/satnogs/stations',     icon: Globe },
      { title: 'Future Passes',    path: '/satnogs/passes',       icon: Clock },
    ],
  },
  {
    id: 'uasat', title: 'UASAT Mission', icon: Rocket,
    items: [
      { title: 'Balloon Tracker',  path: '/uasat/balloon',          icon: Activity },
      // { title: 'Live Stream',   path: '/uasat/balloon-live',     icon: Video },   // hidden from nav
      { title: 'Ground Station',   path: '/uasat/station',          icon: MapPin },
      { title: 'Mission Data',     path: '/uasat/mission',          icon: Info },
      { title: 'Telemetry Charts', path: '/uasat/telemetry-charts', icon: LineChart },
      // { title: 'Backup Data',   path: '/backup',                 icon: Database }, // hidden from nav
    ],
  },
  {
    id: 'uav', title: 'UAV Backscatter', iconSrc: '/logos/drone_icon1.webp',
    items: [
      { title: 'Sensor Data', path: '/uav/backscatter', icon: Activity },
    ],
  },
  {
    id: 'tools', title: 'Tools & Sensors', icon: Cpu,
    items: [
      { title: 'GNSS Logger', path: '/gnss', icon: Satellite },
    ],
  },
  { id: 'settings', title: 'Settings', icon: Settings, path: '/settings', single: true },
];

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(['tinygs', 'satnogs', 'uasat', 'uav', 'tools']);

  const toggle = id =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const isActive       = path  => location.pathname === path;
  const isParentActive = paths => paths.some(p => location.pathname.startsWith(p));

  // Base classes shared by all nav items
  const itemBase = 'flex items-center gap-3 border-l-4 px-6 py-3 w-full text-left cursor-pointer transition-colors text-white';
  const subBase  = 'flex items-center gap-3 border-l-4 pl-12 pr-6 py-2.5 text-sm w-full text-left cursor-pointer transition-colors';

  return (
    <>
      {/* Dark overlay on mobile when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[999] md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`w-64 h-screen bg-blue-700 flex flex-col fixed left-0 top-0 z-[1000]
          shadow-[2px_0_10px_rgba(0,0,0,0.15)] transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Header */}
        <div className="px-6 py-6 border-b border-blue-600 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio size={32} />
              <div>
                <h1 className="text-xl font-bold leading-tight">Ground Station</h1>
                <p className="text-xs text-blue-200 mt-0.5">UA Aveiro</p>
              </div>
            </div>
            {/* Close button — only on mobile */}
            <button
              onClick={onClose}
              className="md:hidden text-blue-200 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map(item => (
            <div key={item.id}>
              {item.single ? (
                <Link
                  to={item.path}
                  onClick={onClose}
                  className={`${itemBase} ${
                    isActive(item.path)
                      ? 'border-white bg-blue-600'
                      : 'border-transparent hover:bg-blue-600'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.title}</span>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggle(item.id)}
                    className={`${itemBase} justify-between ${
                      isParentActive(item.items.map(i => i.path))
                        ? 'border-transparent bg-blue-600'
                        : 'border-transparent hover:bg-blue-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.iconSrc ? (
                        <img
                          src={item.iconSrc}
                          alt=""
                          className="h-5 w-5 object-contain brightness-0 invert"
                        />
                      ) : (
                        <item.icon size={20} />
                      )}
                      <span className="font-medium">{item.title}</span>
                    </div>
                    {expanded.includes(item.id)
                      ? <ChevronDown size={16} />
                      : <ChevronRight size={16} />
                    }
                  </button>

                  {expanded.includes(item.id) && (
                    <div className="bg-blue-800">
                      {item.items.map(sub => (
                        <Link
                          key={sub.path + sub.title}
                          to={sub.path}
                          onClick={onClose}
                          className={`${subBase} ${
                            isActive(sub.path)
                              ? 'border-white bg-blue-600 text-white font-semibold'
                              : 'border-transparent text-blue-200 hover:bg-blue-600 hover:text-white'
                          }`}
                        >
                          <sub.icon size={16} />
                          <span>{sub.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="bg-blue-800 px-4 py-4 border-t border-blue-600 text-xs text-blue-200 flex-shrink-0">
          <p className="font-semibold text-white text-[11px] mb-1">STATION ID: 4518</p>
          <p className="text-[11px] mb-0.5">Aveiro, Portugal</p>
          <p className="text-blue-300 text-[10px]">v1.0.0</p>
          <div className="flex items-center justify-around gap-3 mt-3 pt-3 border-t border-blue-600">
            <img
              src="/logos/UA.png"
              alt="Universidade de Aveiro"
              className="h-10 w-auto object-contain brightness-0 invert opacity-90 hover:opacity-100 transition-opacity"
            />
            <img
              src="/logos/it_logo.webp"
              alt="Instituto de Telecomunicações"
              className="h-10 w-auto object-contain brightness-0 invert opacity-90 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
