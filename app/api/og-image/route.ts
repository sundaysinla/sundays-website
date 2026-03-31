import { NextRequest, NextResponse } from "next/server";

export const revalidate = 86400;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    const image = await scrapeProfileImage(parsed);
    return NextResponse.json(
      { image },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } }
    );
  } catch {
    return NextResponse.json({ image: null });
  }
}

async function scrapeProfileImage(url: URL): Promise<string | null> {
  const platformAvatar = getPlatformAvatar(url);
  if (platformAvatar) return platformAvatar;

  try {
    const res = await fetch(url.href, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return fallbackFavicon(url);

    const html = await res.text();

    const ogImage = extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image");
    if (ogImage) return resolveUrl(ogImage, url);

    const appleTouchIcon = extractLink(html, "apple-touch-icon");
    if (appleTouchIcon) return resolveUrl(appleTouchIcon, url);
  } catch {
    // fall through
  }

  return fallbackFavicon(url);
}

function getPlatformAvatar(url: URL): string | null {
  const host = url.hostname.replace("www.", "");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const username = pathParts[0];
  if (!username) return null;

  if (host === "x.com" || host === "twitter.com") {
    return `https://unavatar.io/twitter/${username}`;
  }
  if (host === "instagram.com") {
    return `https://unavatar.io/instagram/${username}`;
  }
  if (host === "github.com") {
    return `https://github.com/${username}.png?size=128`;
  }
  if (host === "linkedin.com") {
    return `https://unavatar.io/${url.href}`;
  }
  return null;
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractLink(html: string, rel: string): string | null {
  const re = new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]+href=["']([^"']+)["']`, "i");
  const match = html.match(re);
  return match?.[1] ?? null;
}

function resolveUrl(src: string, base: URL): string {
  try {
    return new URL(src, base.origin).href;
  } catch {
    return src;
  }
}

function fallbackFavicon(url: URL): string {
  return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
}
