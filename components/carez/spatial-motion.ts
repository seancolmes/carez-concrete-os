'use client';

import { useSyncExternalStore } from 'react';

export const SPATIAL_TRANSITION_MS = 200;
const query = '(prefers-reduced-motion: reduce)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => true;

/** Spatial transitions are presentation only and never gate an action. */
export function useReducedSpatialMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
