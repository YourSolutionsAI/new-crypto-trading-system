'use client';

import { useState } from 'react';

interface InfoTooltipProps {
  content: string;
  maxWidth?: string;
}

/**
 * Einfacher Tooltip - funktioniert IMMER
 */
export default function InfoTooltip({ 
  content, 
  maxWidth = '500px' 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative inline-block ml-1">
      {/* Icon */}
      <span
        className="inline-flex items-center justify-center w-4 h-4 text-xs text-gray-400 border border-gray-300 rounded-full cursor-help hover:text-blue-500 hover:border-blue-500 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
      >
        i
      </span>

      {/* Tooltip */}
      {isVisible && (
        <span
          className="absolute z-[9999] px-5 py-4 text-sm leading-relaxed text-white bg-gray-900 rounded-lg shadow-2xl whitespace-pre-line pointer-events-none"
          style={{
            width: maxWidth,
            maxWidth: '90vw',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
