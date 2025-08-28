
// lib/crypto.ts
import { isServer, b64encode, b64decode, utf8encode, utf8decode } from "./runtime";

// 32 bytes key from any string seed
export async function deriveKey(seed: string): Promise<Uint8Array> {
  // SHA-256(seed) -> 32 bytes
  if (isServer) {
    const { createHash } = await import("crypto");
    const h = createHash("sha256").update(seed, "utf8").digest();
    return new Uint8Array(h);
  } else {
    const buf = await crypto.subtle.digest("SHA-256", utf8encode(seed));
    return new Uint8Array(buf);
  }
}

export function randomBytes(n: number): Uint8Array {
  if (isServer) {
    const { randomBytes } = require("crypto") as typeof import("crypto");
    return new Uint8Array(randomBytes(n));
  } else {
    const out = new Uint8Array(n);
    crypto.getRandomValues(out);
    return out;
  }
}

export async function aesGcmEncrypt(keyRaw: Uint8Array, plaintext: string): Promise<string> {
  const iv = randomBytes(12);
  if (isServer) {
    const { createCipheriv } = await import("crypto");
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyRaw), Buffer.from(iv));
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = new Uint8Array(iv.length + ct.length + tag.length);
    payload.set(iv, 0);
    payload.set(ct, iv.length);
    payload.set(tag, iv.length + ct.length);
    return `v2:gcm:${b64encode(payload)}`;
  } else {
    const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["encrypt"]);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8encode(plaintext));
    const tagAppended = new Uint8Array(ct); // WebCrypto includes tag
    const payload = new Uint8Array(iv.length + tagAppended.length);
    payload.set(iv, 0);
    payload.set(tagAppended, iv.length);
    return `v2:gcm:${b64encode(payload)}`;
  }
}

export async function aesGcmDecrypt(keyRaw: Uint8Array, token: string): Promise<string> {
  if (!token.startsWith("v2:gcm:")) throw new Error("not-gcm");
  const payload = b64decode(token.slice("v2:gcm:".length));
  const iv = payload.slice(0, 12);
  const data = payload.slice(12);
  if (isServer) {
    const { createDecipheriv } = await import("crypto");
    // Node expects tag separated; last 16 bytes are GCM tag
    if (data.length < 17) throw new Error("cipher-too-short");
    const tag = data.slice(data.length - 16);
    const ct = data.slice(0, data.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyRaw), Buffer.from(iv));
    decipher.setAuthTag(Buffer.from(tag));
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } else {
    const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return utf8decode(new Uint8Array(pt));
  }
}
