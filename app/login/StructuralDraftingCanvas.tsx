'use client';

import { useEffect, useRef } from 'react';
import styles from './StructuralDraftingCanvas.module.css';
import {
  buildStructuralDrafts,
  sampleDraftFrame,
  type DraftPoint,
  type StructuralDraft,
} from './structuralDraftingScene';

const MAX_DEVICE_PIXEL_RATIO = 2;

function lineLength(points: readonly DraftPoint[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
  }
  return length;
}

function traceLine(context: CanvasRenderingContext2D, points: readonly DraftPoint[], progress: number) {
  if (points.length < 2 || progress <= 0) return;
  const targetLength = lineLength(points) * progress;
  let drawnLength = 0;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);

  for (let index = 1; index < points.length; index += 1) {
    const [fromX, fromY] = points[index - 1];
    const [toX, toY] = points[index];
    const segmentLength = Math.hypot(toX - fromX, toY - fromY);
    if (drawnLength + segmentLength <= targetLength) {
      context.lineTo(toX, toY);
      drawnLength += segmentLength;
      continue;
    }
    const remaining = Math.max(0, targetLength - drawnLength);
    const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
    context.lineTo(fromX + (toX - fromX) * ratio, fromY + (toY - fromY) * ratio);
    break;
  }
  context.stroke();
}

function drawDraft(
  context: CanvasRenderingContext2D,
  draft: StructuralDraft,
  progress: number,
  opacity: number,
  lineColor: string,
  labelColor: string,
) {
  context.save();
  context.globalAlpha = opacity;
  context.strokeStyle = lineColor;
  context.lineWidth = draft.kind === 'slab' || draft.kind === 'footing' ? 1.15 : 0.8;
  context.setLineDash(draft.kind === 'crosshair' ? [5, 8] : []);
  context.lineCap = 'square';
  context.lineJoin = 'miter';
  draft.lines.forEach((line) => traceLine(context, line, progress));

  if (draft.label && draft.labelAt && progress > 0.72) {
    context.globalAlpha = opacity * Math.min(1, (progress - 0.72) / 0.28);
    context.fillStyle = labelColor;
    context.font = '10px monospace';
    context.letterSpacing = '0.04em';
    context.fillText(draft.label, draft.labelAt[0], draft.labelAt[1]);
  }
  context.restore();
}

export function StructuralDraftingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let drafts = buildStructuralDrafts(canvas.clientWidth, canvas.clientHeight);
    let animationFrame = 0;
    let visible = true;
    let startedAt = performance.now();

    const colors = () => {
      const computed = window.getComputedStyle(canvas);
      return {
        line: computed.getPropertyValue('--carez-draft-line').trim() || 'rgba(8, 145, 178, 0.2)',
        label: computed.getPropertyValue('--carez-draft-label').trim() || 'rgba(103, 232, 249, 0.38)',
      };
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drafts = buildStructuralDrafts(width, height);
    };

    const render = (now: number) => {
      if (!visible || document.hidden) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const palette = colors();
      context.clearRect(0, 0, width, height);

      if (reducedMotion.matches) {
        drafts.forEach((draft) => drawDraft(context, draft, 1, 0.34, palette.line, palette.label));
        return;
      }

      sampleDraftFrame(drafts, now - startedAt).forEach(({ draft, progress, opacity }) => {
        drawDraft(context, draft, progress, opacity * 0.68, palette.line, palette.label);
      });
      animationFrame = window.requestAnimationFrame(render);
    };

    const restart = () => {
      window.cancelAnimationFrame(animationFrame);
      startedAt = performance.now();
      animationFrame = window.requestAnimationFrame(render);
    };

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) restart();
      else window.cancelAnimationFrame(animationFrame);
    });
    const resizeObserver = new ResizeObserver(() => {
      resize();
      restart();
    });
    const handleVisibility = () => {
      if (!document.hidden && visible) restart();
      else window.cancelAnimationFrame(animationFrame);
    };
    const handleMotionPreference = () => restart();

    resize();
    visibilityObserver.observe(canvas);
    resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    reducedMotion.addEventListener('change', handleMotionPreference);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener('change', handleMotionPreference);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true"/>;
}
