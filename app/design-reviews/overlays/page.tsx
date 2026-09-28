import type { Metadata } from 'next';
import { OverlayReview } from '@/components/overlays/OverlayReview';

export const metadata: Metadata = { title: 'Pourtrace · Overlay and metrics study' };

export default function OverlayReviewPage() { return <OverlayReview />; }
