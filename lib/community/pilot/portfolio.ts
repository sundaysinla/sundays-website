import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { cleanLink, publicText } from "./intake.ts";

export type Address = { address: string; family: number };
export type PortfolioTransport = {
  resolve(host: string): Promise<Address[]>;
  get(url: URL, address: Address, signal: AbortSignal): Promise<{ html: string } | { location: string } | null>;
};
export type Portfolio = { url: string; excerpts: { url: string; text: string }[] };

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["168.63.129.16", 32],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blocked.addSubnet(address, prefix, "ipv6");
}
const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");

function publicAddress({ address, family }: Address): boolean {
  if (family === 4) return isIP(address) === 4 && !blocked.check(address, "ipv4");
  return family === 6 && isIP(address) === 6 && !address.includes("%") &&
    globalIpv6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

function withDeadline<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    void pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

const maxPageBytes = 768 * 1024;
const maxMarkupDelimiters = 4_000;
const maxTagChars = 8_192;
const transport: PortfolioTransport = {
  resolve: host => lookup(host, { all: true }),
  get: (url, address, signal) => new Promise((resolve, reject) => {
    const req = request(url, {
      agent: false,
      family: address.family,
      // Pin the validated address while HTTPS still authenticates the original hostname.
      lookup: (_host, options, done) => options.all
        ? done(null, [address])
        : done(null, address.address, address.family),
      signal,
      headers: { Accept: "text/html", "Accept-Encoding": "identity", "User-Agent": "Sundays in LA portfolio preview" },
    }, async res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
        resolve(res.headers.location ? { location: res.headers.location } : null);
        res.destroy();
        return;
      }
      if (res.statusCode !== 200 || !/^text\/html(?:\s*;|$)/i.test(res.headers["content-type"] ?? "") ||
          (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") ||
          Number(res.headers["content-length"] ?? 0) > maxPageBytes) {
        resolve(null);
        res.destroy();
        return;
      }
      try {
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of res) {
          total += chunk.length;
          if (total > maxPageBytes) { resolve(null); return; }
          chunks.push(chunk);
        }
        resolve({ html: Buffer.concat(chunks).toString("utf8") });
      } catch (error) { reject(error); }
    });
    req.on("error", reject);
    req.end();
  }),
};

function withinParsingBudget(html: string): boolean {
  if (html.length > maxPageBytes) return false;
  // Deeply nested or malformed markup can take much longer to parse than to download.
  let count = 0;
  let tagStart = -1;
  let quote = "";
  for (let index = 0; index < html.length; index++) {
    const char = html[index];
    if (char === "<" && ++count > maxMarkupDelimiters) return false;
    if (tagStart < 0) {
      if (char === "<" && /[a-z/?]/i.test(html[index + 1] ?? "")) tagStart = index;
      continue;
    }
    if (index - tagStart > maxTagChars) return false;
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === ">") tagStart = -1;
  }
  return true;
}

async function readPage(input: string, client: PortfolioTransport, deadline: AbortSignal, origin?: string) {
  const signal = AbortSignal.any([deadline, AbortSignal.timeout(3_500)]);
  let link = cleanLink(input);
  for (let hops = 0; link && hops <= 2; hops++) {
    signal.throwIfAborted();
    const url = new URL(link);
    if (origin && url.origin !== origin) return null;
    const addresses = await withDeadline(client.resolve(url.hostname), signal);
    if (!addresses.length || !addresses.every(publicAddress)) return null;
    const address = addresses.find(a => a.family === 4) ?? addresses[0];
    const response = await withDeadline(client.get(url, address, signal), signal);
    if (!response) return null;
    if ("html" in response) return withinParsingBudget(response.html) ? { url, html: response.html } : null;
    link = cleanLink(new URL(response.location, url).href);
  }
  return null;
}

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const nonContent = new Set(["script", "style", "noscript", "template", "svg", "iframe", "form", "button"]);
const attr = (element: Element, name: string) => element.attrs.find(a => a.name === name)?.value;
function* elements(root: Node, skip = nonContent): Generator<Node> {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if ("tagName" in node && (skip.has(node.tagName) || attr(node, "hidden") !== undefined || attr(node, "aria-hidden") === "true")) continue;
    yield node;
    if ("childNodes" in node) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
    }
  }
}

function text(node: Node, skip: Set<string>): string {
  let output = "";
  for (const child of elements(node, skip)) {
    if ("value" in child && child.nodeName === "#text") output += child.value + " ";
    if (output.length >= 2_000) break;
  }
  return publicText(output, 240);
}

function extract(html: string, url: URL) {
  const doc = parse(html);
  const tags = [...elements(doc)].filter((node): node is Element => "tagName" in node);
  const scope = tags.find(node => node.tagName === "article") ?? tags.find(node => node.tagName === "main") ??
    tags.find(node => node.tagName === "body") ?? doc;
  const skip = new Set([...nonContent, "nav", "footer", "aside", "header"]);
  let excerpt = "";
  for (const node of elements(scope, skip)) {
    if (!("tagName" in node) || node.tagName !== "p") continue;
    excerpt = text(node, skip);
    if (excerpt.length >= 30) break;
    excerpt = "";
  }
  if (!excerpt) {
    const meta = tags.find(node => node.tagName === "meta" && attr(node, "name")?.toLowerCase() === "description");
    excerpt = (meta && publicText(attr(meta, "content") ?? "", 240)) || text(scope, skip);
  }
  if (url.hostname === "github.com" && /repositories available.*follow .*code on github/i.test(excerpt)) excerpt = "";
  const about = tags.flatMap(node => {
    if (node.tagName !== "a") return [];
    const href = attr(node, "href");
    if (!href) return [];
    try {
      const candidate = new URL(href, url);
      if (candidate.origin !== url.origin || !cleanLink(candidate.href) || candidate.pathname === url.pathname ||
          !/\/(about|work|selected-work|projects|portfolio)\/?$/i.test(candidate.pathname)) return [];
      return [candidate.href];
    } catch { return []; }
  })[0];
  return { excerpt: excerpt.length >= 24 ? excerpt : "", about };
}

export async function readPortfolio(input: string, client: PortfolioTransport = transport): Promise<Portfolio | null> {
  const deadline = AbortSignal.timeout(6_000);
  const page = await readPage(input, client, deadline).catch(() => null);
  if (!page) return null;
  const first = extract(page.html, page.url);
  const excerpts = first.excerpt ? [{ url: page.url.href, text: first.excerpt }] : [];
  if (first.about) {
    const extra = await readPage(first.about, client, deadline, page.url.origin).catch(() => null);
    if (extra) {
      const { excerpt } = extract(extra.html, extra.url);
      if (excerpt && !excerpts.some(e => e.text === excerpt)) excerpts.push({ url: extra.url.href, text: excerpt });
    }
  }
  return { url: page.url.href, excerpts };
}
