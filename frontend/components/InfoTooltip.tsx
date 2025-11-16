'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  content: string;
  maxWidth?: string;
}

interface TooltipPortalProps {
  content: string;
  targetRect: DOMRect | null;
  maxWidth: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const TooltipPortal = ({
  content,
  targetRect,
  maxWidth,
  onMouseEnter,
  onMouseLeave,
}: TooltipPortalProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, opacity: 0 });

  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return;

    const tooltipEl = tooltipRef.current;
    const spacing = 12;
    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const measure = () => {
      if (!tooltipEl || !targetRect) return;

      const { width, height } = tooltipEl.getBoundingClientRect();
      let top = 0;
      let left = 0;

      // 1) Bottom
      if (targetRect.bottom + height + spacing < viewportHeight - margin) {
        top = targetRect.bottom + spacing + window.scrollY;
        left =
          targetRect.left +
          targetRect.width / 2 -
          width / 2 +
          window.scrollX;
      }
      // 2) Top
      else if (targetRect.top - height - spacing > margin) {
        top = targetRect.top - height - spacing + window.scrollY;
        left =
          targetRect.left +
          targetRect.width / 2 -
          width / 2 +
          window.scrollX;
      }
      // 3) Right
      else if (targetRect.right + width + spacing < viewportWidth - margin) {
        top =
          targetRect.top +
          targetRect.height / 2 -
          height / 2 +
          window.scrollY;
        left = targetRect.right + spacing + window.scrollX;
      }
      // 4) Left
      else {
        top =
          targetRect.top +
          targetRect.height / 2 -
          height / 2 +
          window.scrollY;
        left = targetRect.left - width - spacing + window.scrollX;
      }

      if (left < margin + window.scrollX) {
        left = margin + window.scrollX;
      }
      if (left + width > viewportWidth - margin + window.scrollX) {
        left = viewportWidth - width - margin + window.scrollX;
      }

      setCoords({ top, left, opacity: 1 });
    };

    measure();
    const handleWindowChange = () => measure();

    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('resize', handleWindowChange);
    return () => {
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('resize', handleWindowChange);
    };
  }, [targetRect, maxWidth, content]);

  if (!targetRect) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[9999] px-5 py-4 text-sm leading-relaxed text-white bg-gray-900 rounded-lg shadow-2xl transition-opacity duration-150"
      style={{
        ...coords,
        width: maxWidth,
        maxWidth: `calc(100vw - ${2 * 16}px)`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative z-10 whitespace-pre-line">{content}</div>
    </div>,
    document.body
  );
};

export default function InfoTooltip({
  content,
  maxWidth = '480px',
}: InfoTooltipProps) {
  const [isClient, setIsClient] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const updateTargetRect = useCallback(() => {
    if (iconRef.current) {
      setTargetRect(iconRef.current.getBoundingClientRect());
    }
  }, []);

  const showTooltip = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    updateTargetRect();
    setIsVisible(true);
  }, [updateTargetRect]);

  const hideTooltip = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 120);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    updateTargetRect();
  }, [isVisible, updateTargetRect]);

  return (
    <div
      className="inline-block"
      ref={iconRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      <div
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-xs text-gray-400 border border-gray-300 rounded-full cursor-help hover:text-blue-500 hover:border-blue-500 transition-colors"
        tabIndex={0}
        role="tooltip"
        aria-label="Information"
      >
        i
      </div>

      {isClient && isVisible && (
        <TooltipPortal
          content={content}
          targetRect={targetRect}
          maxWidth={maxWidth}
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
        />
      )}
    </div>
  );
}

