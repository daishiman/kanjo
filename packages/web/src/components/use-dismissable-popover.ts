import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

/**
 * 小さなポップオーバーの共通閉じる契約。
 * 開いている間だけ Escape と外側クリックを監視し、リスナーを増やさない。
 */
export function useDismissablePopover<T extends HTMLElement>(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  const host = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (host.current && !host.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open, setOpen]);

  return host;
}
