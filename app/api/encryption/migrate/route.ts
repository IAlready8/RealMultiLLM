import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEncryptionIntegration } from "@/lib/encryption-integration";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

interface MigrationRequest {
  dryRun?: boolean;
  forceAll?: boolean;
  providers?: string[];
}

interface MigrationResult {
  success: boolean;
  migrated: number;
  errors: number;
  details: {
    totalKeys: number;
    alreadyEncrypted: number;
    skipped: number;
    errorDetails: string[];
  };
  dryRun: boolean;
  timestamp: string;
}

/**
 * POST /api/encryption/migrate
 * 
 * Safely migrate existing plaintext API keys to encrypted format
 * Requires admin authentication for security
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has admin privileges
    // In a real app, you'd check against a role or permission system
    const isAdmin = session.user.email && (
      session.user.email.endsWith('@yourdomain.com') || // Replace with your admin domain
      process.env.ADMIN_EMAILS?.split(',').includes(session.user.email)
    );

    if (!isAdmin && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    const body: MigrationRequest = await request.json();
    const { dryRun = true, forceAll = false, providers = [] } = body;

    const integration = getEncryptionIntegration(prisma);
    
    // Get current encryption statistics
    const stats = await integration.getEncryptionStats();
    
    let migrationResult: MigrationResult = {
      success: false,
      migrated: 0,
      errors: 0,
      details: {
        totalKeys: stats.totalKeys,
        alreadyEncrypted: stats.encryptedKeys,
        skipped: 0,
        errorDetails: [],
      },
      dryRun,
      timestamp: new Date().toISOString(),
    };

    // Dry run mode - just return statistics
    if (dryRun) {
      const validation = await integration.validateEncryptedKeys();
      
      migrationResult = {
        ...migrationResult,
        success: true,
        details: {
          ...migrationResult.details,
          errorDetails: validation.invalid,
        },
      };

      return NextResponse.json({
        message: "Dry run completed",
        result: migrationResult,
        recommendations: generateRecommendations(stats, validation),
      });
    }

    // Actual migration
    if (stats.legacyKeys === 0 && !forceAll) {
      return NextResponse.json({
        message: "No migration needed - all keys are already encrypted",
        result: migrationResult,
      });
    }

    // Perform migration
    try {
      // If specific providers are requested, migrate only those
      if (providers.length > 0) {
        migrationResult = await migrateSpecificProviders(integration, providers);
      } else {
        // Migrate all legacy keys
        const { migrated, errors } = await integration.migrateToEncrypted();
        migrationResult.migrated = migrated;
        migrationResult.errors = errors;
        migrationResult.success = errors === 0;
      }

      // Validate all keys after migration
      const postMigrationValidation = await integration.validateEncryptedKeys();
      migrationResult.details.errorDetails = postMigrationValidation.invalid;

      // Log successful migration
      console.log(`Migration completed: ${migrationResult.migrated} keys migrated, ${migrationResult.errors} errors`);

      return NextResponse.json({
        message: migrationResult.success 
          ? "Migration completed successfully"
          : "Migration completed with some errors",
        result: migrationResult,
        postMigrationStats: await integration.getEncryptionStats(),
      });

    } catch (migrationError) {
      console.error("Migration failed:", migrationError);
      
      return NextResponse.json({
        message: "Migration failed",
        result: {
          ...migrationResult,
          success: false,
          details: {
            ...migrationResult.details,
            errorDetails: [migrationError instanceof Error ? migrationError.message : String(migrationError)],
          },
        },
        error: migrationError instanceof Error ? migrationError.message : String(migrationError),
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Encryption migration endpoint error:", error);
    
    return NextResponse.json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/encryption/migrate
 * 
 * Get migration status and recommendations
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Verify authentication for status check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const integration = getEncryptionIntegration(prisma);
    
    // Get current encryption statistics
    const stats = await integration.getEncryptionStats();
    const validation = await integration.validateEncryptedKeys();

    const migrationNeeded = stats.legacyKeys > 0;
    const hasErrors = validation.invalid.length > 0;

    return NextResponse.json({
      migrationNeeded,
      hasErrors,
      stats,
      validation,
      recommendations: generateRecommendations(stats, validation),
    });

  } catch (error) {
    console.error("Migration status endpoint error:", error);
    
    return NextResponse.json({
      error: "Failed to get migration status",
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

async function migrateSpecificProviders(
  integration: ReturnType<typeof getEncryptionIntegration>,
  providers: string[]
): Promise<MigrationResult> {
  let totalMigrated = 0;
  let totalErrors = 0;
  const errorDetails: string[] = [];

  for (const provider of providers) {
    try {
      // Get all configs for this provider
      const configs = await prisma.providerConfig.findMany({
        where: {
          provider,
          apiKey: {
            not: null,
          },
          // Only migrate non-encrypted keys
          NOT: {
            apiKey: {
              startsWith: 'v3:AES-256-GCM:',
            },
          },
        },
      });

      for (const config of configs) {
        try {
          if (config.apiKey && !config.apiKey.startsWith('v3:AES-256-GCM:')) {
            // Encrypt the key
            const { encryptApiKey } = await import("@/lib/crypto");
            const encryptedValue = await encryptApiKey(config.apiKey);
            
            await prisma.providerConfig.update({
              where: { id: config.id },
              data: {
                apiKey: encryptedValue,
                updatedAt: new Date(),
              },
            });
            
            totalMigrated++;
          }
        } catch (error: any) {
          totalErrors++;
          errorDetails.push(`${provider} (${config.id}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error: any) {
      totalErrors++;
      errorDetails.push(`Provider ${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    success: totalErrors === 0,
    migrated: totalMigrated,
    errors: totalErrors,
    details: {
      totalKeys: totalMigrated + totalErrors,
      alreadyEncrypted: 0,
      skipped: 0,
      errorDetails,
    },
    dryRun: false,
    timestamp: new Date().toISOString(),
  };
}

function generateRecommendations(
  stats: Awaited<ReturnType<ReturnType<typeof getEncryptionIntegration>['getEncryptionStats']>>,
  validation: Awaited<ReturnType<ReturnType<typeof getEncryptionIntegration>['validateEncryptedKeys']>>
): string[] {
  const recommendations: string[] = [];

  if (stats.legacyKeys > 0) {
    recommendations.push(
      `⚠️ ${stats.legacyKeys} API keys are using legacy encryption. Run migration to upgrade to AES-256-GCM.`
    );
  }

  if (validation.invalid.length > 0) {
    recommendations.push(
      `❌ ${validation.invalid.length} encrypted keys failed validation. These may be corrupted or use invalid formats.`
    );
  }

  if (stats.totalKeys === 0) {
    recommendations.push(
      "ℹ️ No API keys found in database. Encryption is ready for new keys."
    );
  }

  if (stats.legacyKeys === 0 && validation.invalid.length === 0) {
    recommendations.push(
      "✅ All API keys are properly encrypted with AES-256-GCM. No migration needed."
    );
  }

  // Provider-specific recommendations
  for (const [provider, data] of Object.entries(stats.providerBreakdown)) {
    if (data.total > data.encrypted) {
      recommendations.push(
        `🔑 Provider ${provider}: ${data.total - data.encrypted} out of ${data.total} keys need migration.`
      );
    }
  }

  if (process.env.ENCRYPTION_MASTER_KEY === 'default-encryption-key-12345678901234567890123456789012') {
    recommendations.push(
      "🚨 SECURITY WARNING: Using default encryption key. Set ENCRYPTION_MASTER_KEY to a secure value before production deployment."
    );
  }

  return recommendations;
}