'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, ReactNode } from 'react';

interface PageTransitionShellProps {
  children: ReactNode;
}

export function PageTransitionShell({ children }: PageTransitionShellProps) {
  return (
    <div className="w-full">
      {children}
    </div>
  );
}
