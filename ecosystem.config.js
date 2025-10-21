/**
 * 3-STEP PLAN:
 * 1) Provide optional PM2 for local prod runs
 * 2) Use Next standalone output if available
 * 3) Keep memory footprint low with cluster mode optional
 * Note: PM2 is optional; no heavy deps required to run locally.
 * // ✅
 */
module.exports = {
  apps: [
    {
      name: "realmultillm",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        PORT: 3000,
      },
    },
  ],
};
