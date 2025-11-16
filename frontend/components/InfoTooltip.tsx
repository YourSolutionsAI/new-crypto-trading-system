'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  content: string;
  maxWidth?: string;
}

export default function InfoTooltip({ 
  content, 
  maxWidth = '500px' 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isVisible || !iconRef.current) return;

    const updatePosition = () => {
      if (!iconRef.current) return;
      
      const rect = iconRef.current.getBoundingClientRect();
      const tooltipWidth = parseInt(maxWidth);
      
      // Position oberhalb des Icons, zentriert
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      const top = rect.top - 10; // 10px spacing oberhalb
      
      // Prevent overflow left
      if (left < 10) left = 10;
      
      // Prevent overflow right
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      
      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, maxWidth]);

  const tooltip = isVisible && mounted ? createPortal(
    <div
      className="fixed z-[99999] px-5 py-4 text-sm leading-relaxed text-white bg-gray-900 rounded-lg shadow-2xl whitespace-pre-line"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: maxWidth,
        maxWidth: '90vw',
        transform: 'translateY(-100%)',
        pointerEvents: 'none',
      }}
    >
      {content}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <span
        ref={iconRef}
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-xs text-gray-400 border border-gray-300 rounded-full cursor-help hover:text-blue-500 hover:border-blue-500 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
      >
        i
      </span>
      {tooltip}
    </>
  );
}
