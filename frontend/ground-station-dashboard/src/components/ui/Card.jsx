import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`} {...props}>
    {children}
  </div>
);

// Full Tailwind class strings — no dynamic interpolation to avoid purging
const gradients = {
  blue:   'bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30',
  purple: 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30',
  orange: 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30',
  green:  'bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30',
  red:    'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30',
  yellow: 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30',
  cyan:   'bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30',
  violet: 'bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30',
};

const textColors = {
  blue:   'text-blue-400',   purple: 'text-purple-400',
  orange: 'text-orange-400', green:  'text-green-400',
  red:    'text-red-400',    yellow: 'text-yellow-400',
  cyan:   'text-cyan-400',   violet: 'text-violet-400',
  gray:   'text-gray-400',
};

const badgeColors = {
  blue:   'text-blue-300 bg-blue-500/20',     purple: 'text-purple-300 bg-purple-500/20',
  orange: 'text-orange-300 bg-orange-500/20', green:  'text-green-300 bg-green-500/20',
  red:    'text-red-300 bg-red-500/20',       yellow: 'text-yellow-300 bg-yellow-500/20',
  cyan:   'text-cyan-300 bg-cyan-500/20',     violet: 'text-violet-300 bg-violet-500/20',
};

export const GradientCard = ({ color = 'blue', className = '', children, ...props }) => (
  <div className={`${gradients[color] ?? gradients.blue} rounded-lg ${className}`} {...props}>
    {children}
  </div>
);

export const StatCard = ({ icon, label, value, color = 'blue', badge, caption }) => (
  <GradientCard color={color} className="p-4">
    <div className="flex items-center justify-between mb-2">
      {icon}
      {badge && (
        <span className={`text-xs px-2 py-1 rounded ${badgeColors[color] ?? badgeColors.blue}`}>
          {badge}
        </span>
      )}
    </div>
    <div className={`text-3xl font-bold ${textColors[color] ?? 'text-gray-400'}`}>{value}</div>
    <div className="text-sm text-gray-400 mt-1">{label}</div>
    {caption && <div className="text-xs text-gray-500 mt-1">{caption}</div>}
  </GradientCard>
);
