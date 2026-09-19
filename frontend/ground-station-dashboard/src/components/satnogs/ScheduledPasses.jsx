// frontend/src/components/satnogs/ScheduledPasses.jsx
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Satellite, Radio, TrendingUp, MapPin } from 'lucide-react';

export const ScheduledPasses = ({ passes = [], theme = 'dark' }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateCountdown = (targetDate) => {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target - now;

    if (diff <= 0) return 'Starting...';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const isPassSoon = (startTime) => {
    const diff = new Date(startTime) - new Date();
    return diff > 0 && diff < 15 * 60 * 1000; // Less than 15 minutes
  };

  const isPassNow = (startTime, endTime) => {
    const now = new Date();
    return now >= new Date(startTime) && now <= new Date(endTime);
  };

  const formatDuration = (start, end) => {
    const duration = Math.floor((new Date(end) - new Date(start)) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };

  if (passes.length === 0) {
    return (
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="text-green-500" size={24} />
          <h3 className="text-xl font-bold">Scheduled Passes</h3>
        </div>
        <div className="text-center py-8">
          <Calendar className="text-gray-600 mx-auto mb-3" size={48} />
          <p className="text-gray-400">No passes scheduled</p>
          <p className="text-sm text-gray-500 mt-2">
            Check back later or schedule observations manually
          </p>
        </div>
      </div>
    );
  }

  // Sort by start time
  const sortedPasses = [...passes].sort((a, b) => 
    new Date(a.start_time) - new Date(b.start_time)
  );

  return (
    <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="text-green-500" size={24} />
          <div>
            <h3 className="text-xl font-bold">Scheduled Passes</h3>
            <p className="text-sm text-gray-400">{passes.length} upcoming</p>
          </div>
        </div>
      </div>

      {/* Passes List */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {sortedPasses.map((pass, index) => {
          const isNow = isPassNow(pass.start_time, pass.end_time);
          const isSoon = isPassSoon(pass.start_time);

          return (
            <div
              key={pass.pass_id || index}
              className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 transition-all ${
                isNow ? 'ring-2 ring-green-500 animate-pulse' : isSoon ? 'ring-2 ring-yellow-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Left: Satellite Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Satellite className={isNow ? 'text-green-500' : 'text-blue-500'} size={20} />
                    <span className="font-bold text-lg">{pass.satellite_name}</span>
                    {isNow && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold uppercase animate-pulse">
                        LIVE NOW
                      </span>
                    )}
                    {isSoon && !isNow && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold uppercase">
                        SOON
                      </span>
                    )}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <div>
                        <div className="text-gray-400">Start</div>
                        <div className="font-mono">
                          {new Date(pass.start_time).toLocaleTimeString('pt-PT', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-gray-400" />
                      <div>
                        <div className="text-gray-400">Max El.</div>
                        <div className="font-mono">{pass.max_elevation}°</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Radio size={14} className="text-gray-400" />
                      <div>
                        <div className="text-gray-400">Frequency</div>
                        <div className="font-mono text-xs">
                          {(pass.frequency / 1e6).toFixed(3)} MHz
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span>Duration: {formatDuration(pass.start_time, pass.end_time)}</span>
                    <span>Mode: {pass.mode}</span>
                    {pass.azimuth_start && (
                      <span>AOS: {pass.azimuth_start}° | LOS: {pass.azimuth_end}°</span>
                    )}
                  </div>
                </div>

                {/* Right: Countdown */}
                <div className="text-right ml-4">
                  <div className={`text-3xl font-bold font-mono ${
                    isNow ? 'text-green-500' : isSoon ? 'text-yellow-500' : 'text-blue-500'
                  }`}>
                    {isNow ? '●' : calculateCountdown(pass.start_time)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {isNow ? 'In Progress' : 'Until Start'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(pass.start_time).toLocaleDateString('pt-PT')}
                  </div>
                </div>
              </div>

              {/* Progress Bar (for active passes) */}
              {isNow && (
                <div className="mt-3">
                  <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-green-500 h-full transition-all duration-1000"
                      style={{
                        width: `${((new Date() - new Date(pass.start_time)) / 
                          (new Date(pass.end_time) - new Date(pass.start_time))) * 100}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Started</span>
                    <span>
                      Ends at {new Date(pass.end_time).toLocaleTimeString('pt-PT', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span>Live Now</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
          <span>Starting Soon (&lt;15min)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <span>Scheduled</span>
        </div>
      </div>
    </div>
  );
};

export default ScheduledPasses;
