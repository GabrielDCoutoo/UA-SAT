import React from 'react';

const sizes  = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' };
const colors = {
  blue:   'border-blue-500',
  purple: 'border-purple-500',
  green:  'border-green-500',
  orange: 'border-orange-500',
  cyan:   'border-cyan-500',
  gray:   'border-gray-500',
};

export const Spinner = ({ size = 'md', color = 'blue', className = '' }) => (
  <div
    className={`animate-spin rounded-full border-b-2
      ${sizes[size] ?? sizes.md}
      ${colors[color] ?? colors.blue}
      ${className}`}
  />
);
