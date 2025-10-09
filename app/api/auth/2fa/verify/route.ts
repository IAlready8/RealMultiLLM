import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validate2FACode } from '@/lib/auth/totp';

/**
 * 2FA Verification API
 * Validates TOTP or backup codes during sign-in
 */

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const result = await validate2FACode(session.user.id, code);

    if (!result.valid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      method: result.method,
      message: result.method === 'backup'
        ? 'Backup code used successfully. Generate new backup codes soon.'
        : '2FA verification successful',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify 2FA code';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
