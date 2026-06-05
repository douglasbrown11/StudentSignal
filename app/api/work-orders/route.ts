import { NextResponse } from 'next/server';
import { fetchWorkOrders } from '@/lib/criticalasset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get('limit') ?? '25');

  try {
    const workOrders = await fetchWorkOrders(parsedLimit);
    return NextResponse.json({
      success: true,
      count: workOrders.length,
      workOrders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown CriticalAsset error';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
