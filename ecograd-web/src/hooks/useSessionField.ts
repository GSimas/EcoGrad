import { useCallback, type SetStateAction } from 'react';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

/** Values belong to this tab's session, independent of mounted pages. */
export function useSessionField<T>(key: string, initial: T) {
  const saved = useEcoGradStore((s) => s.ui[key]);
  const value = saved === undefined ? initial : saved as T;
  const set = useCallback((next: SetStateAction<T>) => {
    useEcoGradStore.setState((s) => {
      const previous = s.ui[key] === undefined ? initial : s.ui[key] as T;
      return { ui: { ...s.ui, [key]: typeof next === 'function' ? (next as (v: T) => T)(previous) : next } };
    });
  }, [key, initial]);
  return [value, set] as const;
}
