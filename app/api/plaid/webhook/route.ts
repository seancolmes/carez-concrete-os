import { NextResponse } from 'next/server';

// Plaid transaction changes are synchronized by the authenticated Carez sync pulse.
// This receiver intentionally acknowledges notifications without exposing a privileged
// unauthenticated database path. A verified background webhook worker can replace it later.
export async function POST(){return NextResponse.json({received:true});}
