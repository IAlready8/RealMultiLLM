-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableModels" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" DATETIME,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "monthlyUsage" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cost_tracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "monthlyCost" REAL NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apiKeyId" TEXT NOT NULL,
    CONSTRAINT "cost_tracking_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "cost" REAL,
    "latency" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "apiKeyId" TEXT NOT NULL,
    CONSTRAINT "api_usage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_provider_idx" ON "api_keys"("provider");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE INDEX "api_keys_lastUsed_idx" ON "api_keys"("lastUsed");

-- CreateIndex
CREATE INDEX "api_keys_createdAt_idx" ON "api_keys"("createdAt");

-- CreateIndex
CREATE INDEX "api_keys_usageCount_idx" ON "api_keys"("usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "cost_tracking_apiKeyId_key" ON "cost_tracking"("apiKeyId");

-- CreateIndex
CREATE INDEX "cost_tracking_apiKeyId_idx" ON "cost_tracking"("apiKeyId");

-- CreateIndex
CREATE INDEX "cost_tracking_totalCost_idx" ON "cost_tracking"("totalCost");

-- CreateIndex
CREATE INDEX "cost_tracking_monthlyCost_idx" ON "cost_tracking"("monthlyCost");

-- CreateIndex
CREATE INDEX "cost_tracking_requestCount_idx" ON "cost_tracking"("requestCount");

-- CreateIndex
CREATE INDEX "api_usage_apiKeyId_idx" ON "api_usage"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_usage_timestamp_idx" ON "api_usage"("timestamp");

-- CreateIndex
CREATE INDEX "api_usage_model_idx" ON "api_usage"("model");

-- CreateIndex
CREATE INDEX "api_usage_success_idx" ON "api_usage"("success");

-- CreateIndex
CREATE INDEX "api_usage_cost_idx" ON "api_usage"("cost");

-- CreateIndex
CREATE INDEX "api_usage_latency_idx" ON "api_usage"("latency");
