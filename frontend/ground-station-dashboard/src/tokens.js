// Design tokens — single source of truth for Recharts colors and chart config

export const CHART_COLORS = {
  frame0:  '#3b82f6',  // blue-500
  frame1:  '#a855f7',  // purple-500
  retrans: '#f97316',  // orange-500
  green:   '#22c55e',  // green-500
  cyan:    '#22d3ee',  // cyan-400
  grid:    '#374151',  // gray-700
  axis:    '#6b7280',  // gray-500
  tick:    '#9ca3af',  // gray-400
};

export const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    fontSize: 12,
  },
  labelStyle: { color: '#9ca3af' },
  itemStyle:  { color: '#e5e7eb' },
};

export const AXIS_PROPS = {
  stroke:   '#6b7280',
  tick:     { fill: '#9ca3af', fontSize: 10 },
  tickLine: false,
};
