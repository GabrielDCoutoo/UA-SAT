// Page header with IT logo — Tailwind version
import React from 'react';

const Header = ({ title, subtitle, children }) => (
  <div className="flex items-start justify-between mb-6 py-4">
    <div className="flex-1">
      {title    && <h1 className="text-[28px] font-bold text-white m-0 leading-tight">{title}</h1>}
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      {children}
    </div>
    <div className="flex items-start pl-6 pt-0.5 border-l border-gray-700 ml-6 flex-shrink-0">
      <img
        src="/logos/it_logo.webp"
        alt="Instituto de Telecomunicações"
        className="h-14 w-auto object-contain brightness-0 invert opacity-85 hover:opacity-100 hover:scale-105 transition-all duration-300"
      />
    </div>
  </div>
);

export default Header;
