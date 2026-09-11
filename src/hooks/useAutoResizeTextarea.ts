/**
 * Hook: useAutoResizeTextarea
 *
 * Smooth auto-expanding textarea for clean developer chat UX.
 */

import { useEffect, useRef } from 'react';

export function useAutoResizeTextarea(value: string, maxHeight = 160) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(44, newHeight)}px`;
  }, [value, maxHeight]);

  return textareaRef;
}
