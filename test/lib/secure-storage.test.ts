import { describe, it, expect } from "vitest";
import { encryptString, decryptString } from "@/lib/secure-storage";

describe("secure-storage crypto", () => {
  it("roundtrips utf8 text", async () => {
    const pt = "hello🔐世界";
    const token = await encryptString(pt);
    expect(token.startsWith("v2:gcm:")).toBe(true);
    const back = await decryptString(token);
    expect(back).toBe(pt);
  });

  it("accepts legacy base64", async () => {
    const b64 = Buffer.from("legacy").toString("base64");
    const out = await decryptString(b64);
    expect(out).toBe("legacy");
  });
});