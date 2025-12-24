import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

declare global {
  var activeProcesses: Map<string, any>;
}

export async function GET() {
  const activeProcesses = global.activeProcesses || new Map();
  const activeIds = Array.from(activeProcesses.keys());
  
  return NextResponse.json({ 
    activeProcesses: activeIds,
    count: activeIds.length 
  });
}
