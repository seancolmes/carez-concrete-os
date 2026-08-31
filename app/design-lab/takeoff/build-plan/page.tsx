import { notFound } from 'next/navigation';
import { BuildPlanPrototype } from './BuildPlanPrototype';

export default function BuildPlanDesignLabPage() {
  if (process.env.VERCEL_ENV === 'production') notFound();
  return <BuildPlanPrototype />;
}
