// app/api/monitoring/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getAllMetrics, resetMetrics } from '@/lib/monitoring';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    // In a production environment, you might want to restrict this to admins only
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all metrics
    const metrics = getAllMetrics();
    
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    // In a production environment, you might want to restrict this to admins only
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Reset all metrics
    resetMetrics();
    
    return NextResponse.json({ message: 'Metrics reset successfully' });
  } catch (error) {
    console.error('Error resetting metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}