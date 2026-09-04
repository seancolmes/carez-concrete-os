export const CAREZ_MOTION_MS = {
  micro: 140,
  overlay: 180,
  layout: 210,
} as const;

export const carezMotion = {
  micro: 'transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none',
  overlay: 'transition-[opacity,transform] duration-[180ms] ease-out motion-reduce:transition-none motion-reduce:transform-none',
  layout: 'transition-[width,height,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none',
} as const;
