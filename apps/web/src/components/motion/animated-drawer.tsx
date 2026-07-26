'use client';

import { useLenis } from 'lenis/react';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';

interface AnimatedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  side?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function AnimatedDrawer({
  isOpen,
  onClose,
  children,
  title,
  side = 'right',
  className = '',
}: AnimatedDrawerProps) {
  const lenis = useLenis();
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      lenis?.stop();
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Wait for fade-out/slide-out transition (300ms)
      lenis?.start();
      return () => clearTimeout(timer);
    }
  }, [isOpen, lenis]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !shouldRender) return null;

  const baseClasses = "absolute bg-surface shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden";
  
  const sideStyles = {
    right: `${baseClasses} right-0 top-0 bottom-0 h-full w-[85vw] max-w-md ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`,
    left: `${baseClasses} left-0 top-0 bottom-0 h-full w-[85vw] max-w-md ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`,
    bottom: `${baseClasses} bottom-0 left-0 right-0 w-full h-[70vh] ${
      isOpen ? 'translate-y-0' : 'translate-y-full'
    }`,
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-content/40 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        data-lenis-prevent
        className={`${sideStyles[side]} ${className}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4 shrink-0">
          {title && <h2 className="text-base font-semibold text-content">{title}</h2>}
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-content-soft hover:bg-surface-muted transition-colors duration-150"
          >
            <Icon.Close size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </aside>
    </div>,
    document.body
  );
}
