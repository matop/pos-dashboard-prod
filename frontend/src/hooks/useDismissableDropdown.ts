import { useEffect, useState, type RefObject } from 'react';

interface DropdownPos { top: number; left: number; width: number }

interface UseDismissableDropdownReturn {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
  dropdownPos: DropdownPos;
}

/**
 * Encapsulates click-outside dismiss, scroll-dismiss, and portal position
 * recalculation for a button-triggered dropdown rendered via createPortal.
 */
export function useDismissableDropdown(
  buttonRef:   RefObject<HTMLButtonElement | null>,
  dropdownRef: RefObject<HTMLDivElement | null>,
  minWidth = 288,
): UseDismissableDropdownReturn {
  const [isOpen, setIsOpen]       = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: minWidth });

  // Recalculate position whenever the dropdown opens
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: Math.max(minWidth, rect.width),
    });
  }, [isOpen, buttonRef, minWidth]);

  // Click-outside dismiss — covers both the trigger button and the portal
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [buttonRef, dropdownRef]);

  // Scroll-dismiss — ignore scrolls that originate inside the dropdown itself
  useEffect(() => {
    if (!isOpen) return;
    function onScroll(e: Event) {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    }
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isOpen, dropdownRef]);

  return {
    isOpen,
    open:   () => setIsOpen(true),
    close:  () => setIsOpen(false),
    toggle: () => setIsOpen(v => !v),
    dropdownPos,
  };
}
