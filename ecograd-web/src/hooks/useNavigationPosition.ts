import { useLayoutEffect, useRef } from 'react';
import { checkpointPosition, registerPosition, useNavigation } from '@/services/navigation';
import type { Position } from '@/lib/navigation';
const interactive = 'button, a, input, select, textarea, [role="tab"], summary';
function focusDescription(root: HTMLElement): Position['focus'] {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active) || !active.matches(interactive)) return undefined;
  const tag = active.tagName, label = active.getAttribute('aria-label') ?? '';
  // Input values, messages and generated text never enter this locator.
  const text = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ? '' : (active.textContent ?? '').trim().slice(0, 240);
  const matches = [...root.querySelectorAll(interactive)].filter((el) => el.tagName === tag && (el.getAttribute('aria-label') ?? '') === label
    && (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ? '' : (el.textContent ?? '').trim().slice(0, 240)) === text);
  return { tag, label, text, ordinal: matches.indexOf(active) };
}
export function useNavigationPosition() {
  const ref = useRef<HTMLElement>(null);
  const revision = useNavigation((s) => s.revision);
  const restore = useNavigation((s) => s.restore);
  const page = useNavigation((s) => s.page);
  useLayoutEffect(() => registerPosition(() => ({ top: ref.current?.scrollTop ?? 0, focus: ref.current ? focusDescription(ref.current) : undefined })), []);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let stopped = false;
    let frame = 0;
    const apply = () => {
      if (stopped) return;
      root.scrollTop = restore?.top ?? 0;
    };
    // Layout can grow once charts/fonts mount. Retry only while the reader has not interacted.
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(apply); });
    for (const child of root.children) observer.observe(child);
    const stop = () => { stopped = true; observer.disconnect(); cancelAnimationFrame(frame); };
    root.addEventListener('wheel', stop, { passive: true });
    root.addEventListener('touchstart', stop, { passive: true });
    root.addEventListener('pointerdown', stop, { passive: true });
    root.addEventListener('keydown', stop);
    const f = restore?.focus;
    const target = f ? [...root.querySelectorAll<HTMLElement>(interactive)].filter((el) => el.tagName === f.tag && (el.getAttribute('aria-label') ?? '') === f.label
      && (['INPUT', 'TEXTAREA', 'SELECT'].includes(f.tag) ? '' : (el.textContent ?? '').trim().slice(0, 240)) === f.text)[f.ordinal] : null;
    (target ?? root).focus({ preventScroll: true });
    apply();
    const timeout = window.setTimeout(stop, 1500);
    return () => { stop(); clearTimeout(timeout); root.removeEventListener('wheel', stop); root.removeEventListener('touchstart', stop); root.removeEventListener('pointerdown', stop); root.removeEventListener('keydown', stop); };
  }, [revision, page]);
  useLayoutEffect(() => {
    const root = ref.current;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => { clearTimeout(timer); timer = setTimeout(checkpointPosition, 120); };
    const flush = () => { clearTimeout(timer); checkpointPosition(); };
    root?.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', flush);
    return () => { clearTimeout(timer); root?.removeEventListener('scroll', save); window.removeEventListener('pagehide', flush); };
  }, [page]);
  return ref;
}
