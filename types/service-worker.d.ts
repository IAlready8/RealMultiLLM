/* 3-STEP PLAN
 * 1) Augment Window with __PWA__ shared namespace for SW interactions. // ✅
 * 2) Provide minimal ServiceWorker types to keep TS strict mode happy. // ✅
 * 3) Keep file zero-runtime, ambient declarations only. // ✅
 *
 * Optimization/Scalability Notes:
 * - Optimization: Ambient-only, no code emission.
 * - Scalability: Centralizes PWA typings; additional fields can be added safely.
 * - Barrier Identification: If TypeScript lib.dom.d.ts changes, this remains compatible.
 */

export {};

declare global {
  interface Window {
    __PWA__?: {
      skipWaiting: () => void;
      registration: ServiceWorkerRegistration | null;
      lastEvent: "idle" | "update-available" | "update-applied";
    };
  }
}
