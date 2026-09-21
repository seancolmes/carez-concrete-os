'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, type ComponentRef, type RefObject } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { SPATIAL_TRANSITION_MS, useReducedSpatialMotion } from '@/components/carez/spatial-motion';
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
  const reducedMotion = useReducedSpatialMotion();
  const transition = useRef<{ from: Takeoff3DCameraMemory; to: Takeoff3DCameraMemory; elapsed: number } | null>(null);
  const readCamera = useCallback((): Takeoff3DCameraMemory | null => {
    const orbit = controls.current;
    return orbit ? {
      azimuth: orbit.getAzimuthalAngle(), polar: orbit.getPolarAngle(), zoom: camera.zoom,
      target: [orbit.target.x, orbit.target.y, orbit.target.z],
    } : null;
  }, [camera]);

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
    orbit.enableDamping = !reducedMotion;
    memory.set(sheetId, sane);
  }, [camera, width, height, memory, sheetId, reducedMotion]);

  const navigate = useCallback((value: Takeoff3DCameraMemory) => {
    const from = readCamera();
    const to = sanitizeCameraMemory(value, [width / 2, 0, height / 2]);
    if (!from || reducedMotion) { transition.current = null; apply(to); return; }
    // Shortest rotation; a new command starts from the current rendered camera.
    to.azimuth = from.azimuth + Math.atan2(Math.sin(to.azimuth - from.azimuth), Math.cos(to.azimuth - from.azimuth));
    transition.current = { from, to, elapsed: 0 };
  }, [readCamera, width, height, reducedMotion, apply]);

  useFrame((_, delta) => {
    const move = transition.current;
    if (!move) return;
    move.elapsed += delta * 1000;
    const progress = reducedMotion ? 1 : Math.min(1, move.elapsed / SPATIAL_TRANSITION_MS);
    const t = 1 - Math.pow(1 - progress, 3);
    const mix = (a: number, b: number) => a + (b - a) * t;
    apply({
      azimuth: mix(move.from.azimuth, move.to.azimuth),
      polar: mix(move.from.polar, move.to.polar),
      zoom: mix(move.from.zoom, move.to.zoom),
      target: [0, 1, 2].map(index => mix(move.from.target[index], move.to.target[index])) as [number, number, number],
    });
    if (progress === 1) transition.current = null;
  });

  useLayoutEffect(() => {
    if (previousSheetId.current === sheetId) return;
    transition.current = null;
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
      home: () => navigate(homeCameraMemory(width, height, size.width, size.height)),
      top: () => navigate(topCameraMemory(width, height, size.width, size.height)),
      focusSelected: (target, focusWidth, focusHeight) => {
        const orbit = controls.current;
        if (!orbit) return;
        const fit = homeCameraMemory(focusWidth, focusHeight, size.width, size.height);
        navigate({ ...fit, target, azimuth: orbit.getAzimuthalAngle(), polar: orbit.getPolarAngle() });
      },
    };
    return () => { actions.current = null; };
  }, [actions, navigate, width, height, size.width, size.height]);

  useEffect(() => () => { transition.current = null; }, []);

  const save = () => {
    const orbit = controls.current;
    if (!orbit) return;
    memory.set(sheetId, sanitizeCameraMemory({
      azimuth: orbit.getAzimuthalAngle(), polar: orbit.getPolarAngle(), zoom: camera.zoom,
      target: [orbit.target.x, orbit.target.y, orbit.target.z],
    }, [width / 2, 0, height / 2]));
  };

  return <OrbitControls ref={controls} makeDefault minPolarAngle={MIN_POLAR} maxPolarAngle={MAX_POLAR}
    minZoom={0.05} maxZoom={40} screenSpacePanning={false} enableDamping={!reducedMotion} dampingFactor={0.08}
    onStart={() => { transition.current = null; }} onChange={save} onEnd={save} />;
}
