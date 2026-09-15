'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import styles from './Takeoff3DViewport.module.css';

export function Takeoff3DUnavailable({ onRetry }: { onRetry: () => void }) {
  return <div className={styles.message} role="alert">
    <strong>3D unavailable</strong>
    <span>Your 2D Takeoff and quantities remain available.</span>
    <Button variant="outline" size="sm" onClick={onRetry}>Retry 3D</Button>
  </div>;
}

export class Takeoff3DErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <Takeoff3DUnavailable onRetry={this.props.onRetry} /> : this.props.children;
  }
}
