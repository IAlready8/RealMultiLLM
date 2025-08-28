import { NextResponse } from "next/server";
import { getStoredApiKey } from "@/lib/secure-storage";

export async function GET() {
  try {
    // Prefer server env var if set
    const apiKey = await getStoredApiKey("openrouter");

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      // cache: 'no-store' // Optionally disable caching
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err || "Failed to fetch models" }, { status: res.status });
    }

    const data = await res.json();
    // Pass through as-is; client will format pricing
    const json = NextResponse.json(data);
    json.headers.set("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
    return json;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
