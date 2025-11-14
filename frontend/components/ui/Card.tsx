// Card Component

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className = '', title }: CardProps) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

