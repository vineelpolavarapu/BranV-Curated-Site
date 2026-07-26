'use client';

import { useLenis } from 'lenis/react';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function AnimatedModal({
  isOpen,
  onClose,
  children,
  title,
  className = '',
}: AnimatedModalProps) {
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
      }, 300); // Match transition duration (300ms)
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-content/40 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        data-lenis-prevent
        className={`relative bg-surface shadow-2xl rounded-xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] w-full max-w-lg overflow-hidden ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        } ${className}`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4 shrink-0">
          {title && <h2 className="text-base font-semibold text-content">{title}</h2>}
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-content-soft hover:bg-surface-muted transition-colors duration-150"
          >
            <Icon.Close size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
