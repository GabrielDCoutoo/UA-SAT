import React, { useEffect, useState, useMemo } from 'react'
import { Navigation, Thermometer, Battery, Gauge, Wind, Radio } from 'lucide-react'

export default function BalloonTracker({ data = [], theme = 'dark' }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!Array.isArray(data)) return
    const balloonPackets = data.filter(p => p && (p.isMyBalloon === true || p.satellite === 'BALAO-01'))
    if (balloonPackets.length === 0) return
    setHistory(prev => {
      const combined = [...prev, ...balloonPackets]
      const last50 = combined.slice(-50)
      return last50
    })
  }, [data])

  const lastPacket = history.length > 0 ? history[history.length - 1] : null

  const stats = useMemo(() => {
    if (history.length === 0) return { maxAltitude: 0, minTemp: 0, avgRSSI: 0, avgSNR: 0, totalPackets: 0, flightDurationMinutes: 0 }
    const altitudes = history.map(h => (h?.balloonData?.altitude ?? 0))
    const temps = history.map(h => (h?.balloonData?.temperature ?? 0))
    const rssis = history.map(h => (typeof h.rssi === 'number' ? h.rssi : null)).filter(v => v !== null)
    const snrs = history.map(h => (typeof h.snr === 'number' ? h.snr : null)).filter(v => v !== null)
    const maxAltitude = Math.max(...altitudes)
    const minTemp = Math.min(...temps)
    const avgRSSI = rssis.length ? (rssis.reduce((s, v) => s + v, 0) / rssis.length) : 0
    const avgSNR = snrs.length ? (snrs.reduce((s, v) => s + v, 0) / snrs.length) : 0
    const totalPackets = history.length
    const firstTs = new Date(history[0].timestamp).getTime()
    const lastTs = new Date(history[history.length - 1].timestamp).getTime()
    const flightDurationMinutes = Number.isFinite(firstTs) && Number.isFinite(lastTs) ? Math.max(0, (lastTs - firstTs) / 60000) : 0
    return { maxAltitude, minTemp, avgRSSI, avgSNR, totalPackets, flightDurationMinutes }
  }, [history])

  const recentRows = useMemo(() => history.slice(-10).reverse(), [history])
  const fmt = (v, decimals = 2) => (typeof v === 'number' ? v.toFixed(decimals) : '-')
  const fmtLatLng = (v) => (typeof v === 'number' ? v.toFixed(6) : '-')
  const batteryPct = (() => {
    const v = lastPacket?.balloonData?.battery ?? 0
    const pct = Math.max(0, Math.min(100, (v / 4.2) * 100))
    return pct
  })()

  const themeBg = theme === 'light' ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'

  if (!lastPacket) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${themeBg}`}>
        <Radio size={48} className="text-gray-400" />
        <h3 className="mt-4 text-lg font-semibold">Aguardando Dados do Balão</h3>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-xl">Conecte a ground station e aguarde a transmissão do balão...</p>
      </div>
    )
  }

  const lastUpdate = new Date(lastPacket.timestamp)

  return (
    <div className={`p-4 space-y-4 ${themeBg}`}>
      <div className="flex items-center justify-between bg-gray-800/50 rounded p-3">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse block" />
          <div>
            <div className="text-green-300 font-semibold">Balão Ativo</div>
            <div className="text-sm text-gray-400">Última atualização: {lastUpdate.toLocaleTimeString()}</div>
          </div>
        </div>
        <div className="text-sm text-gray-400">Pacotes: {stats.totalPackets}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded p-4 flex flex-col">
          <div className="flex items-center gap-3">
            <Navigation className="text-blue-400" />
            <div className="text-sm text-gray-300">GPS Position</div>
          </div>
          <div className="mt-4 flex-1">
            <div className="text-xs text-gray-400">Latitude</div>
            <div className="font-mono">{fmtLatLng(lastPacket.balloonData?.latitude)}</div>
            <div className="text-xs text-gray-400 mt-2">Longitude</div>
            <div className="font-mono">{fmtLatLng(lastPacket.balloonData?.longitude)}</div>
          </div>
          <div className="mt-4 text-2xl font-bold">{fmt(lastPacket.balloonData?.altitude ?? 0, 0)} m</div>
        </div>

        <div className="bg-gray-800 rounded p-4 flex flex-col">
          <div className="flex items-center gap-3">
            <Thermometer className="text-red-400" />
            <div className="text-sm text-gray-300">Temperature</div>
          </div>
          <div className="mt-4 flex-1 flex items-end">
            <div className="text-4xl font-bold">{fmt(lastPacket.balloonData?.temperature ?? 0, 1)}°C</div>
          </div>
          <div className="mt-2 text-sm text-gray-400">Min (history): {fmt(stats.minTemp, 1)}°C</div>
        </div>

        <div className="bg-gray-800 rounded p-4 flex flex-col">
          <div className="flex items-center gap-3">
            <Battery className="text-green-400" />
            <div className="text-sm text-gray-300">Battery</div>
          </div>
          <div className="mt-4 flex-1 flex items-end">
            <div className="text-4xl font-bold">{fmt(lastPacket.balloonData?.battery ?? 0, 2)} V</div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-700 h-3 rounded overflow-hidden">
              <div className="h-3 bg-green-400" style={{ width: `${batteryPct}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-1">{batteryPct.toFixed(0)}%</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded p-4 flex flex-col">
          <div className="flex items-center gap-3">
            <Gauge className="text-cyan-400" />
            <div className="text-sm text-gray-300">Pressure</div>
          </div>
          <div className="mt-4 flex-1 flex items-end">
            <div className="text-4xl font-bold">{fmt(lastPacket.balloonData?.pressure ?? 0, 0)} hPa</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded p-4">
        <div className="flex items-center gap-3 mb-4">
          <Wind className="text-purple-400" />
          <div className="text-sm text-gray-300">Signal Quality</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-400">RSSI (avg)</div>
            <div className="font-bold">{fmt(stats.avgRSSI, 1)} dBm</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">SNR (avg)</div>
            <div className="font-bold">{fmt(stats.avgSNR, 1)} dB</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Frequency</div>
            <div className="font-bold">{fmt((lastPacket.frequency ?? 0) / 1e6, 3)} MHz</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Station</div>
            <div className="font-bold">{lastPacket.station ?? '-'}</div>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-gray-800 rounded p-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-400">Max Altitude</div>
            <div className="font-bold">{fmt(stats.maxAltitude, 0)} m</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Min Temperature</div>
            <div className="font-bold">{fmt(stats.minTemp, 1)} °C</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Total Packets</div>
            <div className="font-bold">{stats.totalPackets}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Flight Duration</div>
            <div className="font-bold">{fmt(stats.flightDurationMinutes, 1)} min</div>
          </div>
        </div>
      )}

      <div>
        <div className="text-sm text-gray-300 mb-2">Recent History</div>
        <div className="space-y-2 max-h-64 overflow-auto">
          {recentRows.map((r, idx) => (
            <div key={idx} className="bg-gray-700 rounded p-3">
              <div className="flex justify-between text-sm">
                <div>{new Date(r.timestamp).toLocaleTimeString()}</div>
                <div className="font-mono">{fmt(r.balloonData?.altitude ?? 0, 0)} m</div>
              </div>
              <div className="flex justify-between text-xs text-gray-300 mt-1">
                <div>Temp: {fmt(r.balloonData?.temperature ?? 0, 1)}°C</div>
                <div>RSSI: {fmt(r.rssi ?? 0, 1)} dBm</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
