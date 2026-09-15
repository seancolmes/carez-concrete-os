'use client';

import { useRef } from 'react';
import type { Takeoff3DCameraMemory } from '@/lib/takeoff/3d/camera';

// Called by the workstation so toggling back to 2D does not lose camera memory.
export function useTakeoff3DCamera() {
  return useRef(new Map<string, Takeoff3DCameraMemory>());
}
