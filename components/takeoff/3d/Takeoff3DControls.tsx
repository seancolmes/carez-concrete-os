'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, type ComponentRef, type RefObject } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { cameraPositionForMemory, homeCameraMemory, topCameraMemory, sanitizeCameraMemory, shouldInitializeCamera, MIN_POLAR, MAX_POLAR, type Takeoff3DCameraMemory } from '@/lib/takeoff/3d/camera';

export type Takeoff3DCameraActions = {
  home: () => void;
  top: () => void;
  focusSelected: (target: [number, number, number], width: number, height: number) => void;
};

export function Takeoff3DControls({ sheetId, width, height, memory, actions }: {
  sheetId: string; width: number; height: number;
  memory: Map<string, Takeoff3DCameraMemory>;
  actions: RefObject<Takeoff3DCameraActions | null>;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree(state => state.camera) as OrthographicCamera;
  const size = useThree(state => state.size);
  const previousSheetId = useRef<string | null>(null);

  const apply = useCallback((value: Takeoff3DCameraMemory) => {
    const orbit = controls.current;
    if (!orbit) return;
    const sane = sanitizeCameraMemory(value, [width / 2, 0, height / 2]);
    // Flush residual damping before explicit navigation or restoring another sheet.
    orbit.enableDamping = false;
    orbit.update();
    camera.position.set(...cameraPositionForMemory(sane, width, height));
    camera.zoom = sane.zoom;
    camera.updateProjectionMatrix();
    orbit.target.set(...sane.target);
    orbit.update();
    orbit.enableDamping = true;
    memory.set(sheetId, sane);
  }, [camera, width, height, memory, sheetId]);

  useLayoutEffect(() => {
    if (previousSheetId.current === sheetId) return;
    const saved = memory.get(sheetId);
    if (shouldInitializeCamera(previousSheetId.current, sheetId, Boolean(saved))) {
      apply(homeCameraMemory(width, height, size.width, size.height));
    } else if (saved) {
      apply(saved);
    }
    previousSheetId.current = sheetId;
  }, [sheetId, width, height, size.width, size.height, memory, apply]);

  useEffect(() => {
    actions.current = {
      home: () => apply(homeCameraMemory(width, height, size.width, size.height)),
      top: () => apply(topCameraMemory(width, height, size.width, size.height)),
      focusSelected: (target, focusWidth, focusHeight) => {
        const orbit = controls.current;
        if (!orbit) return;
        const fit = homeCameraMemory(focusWidth, focusHeight, size.width, size.height);
        apply({ ...fit, target, azimuth: orbit.getAzimuthalAngle(), polar: orbit.getPolarAngle() });
      },
    };
    return () => { actions.current = null; };
  }, [actions, apply, width, height, size.width, size.height]);

  const save = () => {
    const orbit = controls.current;
    if (!orbit) return;
    memory.set(sheetId, sanitizeCameraMemory({
      azimuth: orbit.getAzimuthalAngle(), polar: orbit.getPolarAngle(), zoom: camera.zoom,
      target: [orbit.target.x, orbit.target.y, orbit.target.z],
    }, [width / 2, 0, height / 2]));
  };

  return <OrbitControls ref={controls} makeDefault minPolarAngle={MIN_POLAR} maxPolarAngle={MAX_POLAR}
    minZoom={0.05} maxZoom={40} screenSpacePanning={false} enableDamping dampingFactor={0.08} onEnd={save} />;
}
