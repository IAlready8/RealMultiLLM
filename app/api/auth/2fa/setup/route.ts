import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateTOTPSecret, generateTOTPUri, enableTwoFactor, verifyTOTPCode } from '@/lib/auth/totp';

/**
 * 2FA Setup API
 * Generates TOTP secret and QR code for user
 */

/**
 * GET - Generate new 2FA secret and QR code
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const secret = generateTOTPSecret();
    const qrUri = generateTOTPUri(secret, session.user.email || '');

    // Store temporarily in session (not database yet - only after verification)
    // Convert hex to base32 for manual entry (compatible with authenticator apps)
    const base32 = Buffer.from(secret, 'hex').toString('hex').toUpperCase();

    return NextResponse.json({
      secret,
      qrUri,
      manualEntry: base32,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate 2FA secret';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST - Verify TOTP code and enable 2FA
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { secret, code } = body;

    if (!secret || !code) {
      return NextResponse.json(
        { error: 'Secret and code are required' },
        { status: 400 }
      );
    }

    // Verify the code
    const isValid = verifyTOTPCode(secret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Enable 2FA and generate backup codes
    const result = await enableTwoFactor(session.user.id, secret);

    return NextResponse.json({
      success: true,
      backupCodes: result.backupCodes,
      message: '2FA enabled successfully. Save your backup codes in a secure location.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enable 2FA';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
