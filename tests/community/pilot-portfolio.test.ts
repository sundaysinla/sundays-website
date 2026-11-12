import test from "node:test";
import assert from "node:assert/strict";
import * as portfolio from "../../lib/community/pilot/portfolio.ts";
import type { PortfolioTransport } from "../../lib/community/pilot/portfolio.ts";

const root = "https://maya.example.com/";
const publicAddress = { address: "93.184.216.34", family: 4 };

test("reads the submitted page and one same-site work page, preserving short, attributable excerpts", async () => {
  const requests: string[] = [];
  const transport: PortfolioTransport = {
    resolve: async () => [publicAddress],
    get: async (url, address) => {
      assert.deepEqual(address, publicAddress);
      requests.push(url.href);
      return { html: url.pathname === "/" ? `
        <nav>Irrelevant profile links <a href="https://elsewhere.example.com/about">About</a></nav>
        <main><p>I edit short documentaries &amp; film essays.</p><script>secret-script</script></main>
        <a href="/work">Selected work</a>
      ` : "<article><p>I edited an archival documentary about public libraries.</p></article>" };
    },
  };
  const result = await portfolio.readPortfolio(root + "?utm_source=luma", transport);
  assert.deepEqual(requests, [root, root + "work"]);
  assert.deepEqual(result?.excerpts, [
    { url: root, text: "I edit short documentaries & film essays." },
    { url: root + "work", text: "I edited an archival documentary about public libraries." },
  ]);
});

test("rejects private, reserved and mapped addresses, including a mixed DNS answer", async () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "100.64.0.1", "169.254.169.254", "198.18.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "2001:db8::1"]) {
    const result = await portfolio.readPortfolio(root, {
      resolve: async () => [publicAddress, { address, family: address.includes(":") ? 6 : 4 }],
      get: async () => ({ html: "<p>The private page must never be fetched.</p>" }),
    });
    assert.equal(result, null, address);
  }
});

test("checks every redirect and skips LinkedIn even when submitted via a public URL", async () => {
  const requested: string[] = [];
  const transport: PortfolioTransport = {
    resolve: async host => host === "internal.example.com" ? [{ address: "192.168.1.1", family: 4 }] : [publicAddress],
    get: async url => {
      requested.push(url.href);
      return { location: "https://internal.example.com/" };
    },
  };
  assert.equal(await portfolio.readPortfolio(root, transport), null);
  assert.deepEqual(requested, [root]);
  assert.equal(await portfolio.readPortfolio("https://www.linkedin.com./in/test", transport), null);
  assert.deepEqual(requested, [root]);
});

test("an unreadable second page leaves the first page available", async () => {
  const result = await portfolio.readPortfolio(root, {
    resolve: async () => [publicAddress],
    get: async url => {
      if (url.pathname === "/about") throw new Error("timeout");
      return { html: '<p>I build interactive installations for public libraries.</p><a href="/about">About</a>' };
    },
  });
  assert.equal(result?.excerpts[0]?.text, "I build interactive installations for public libraries.");
});

test("a tag-dense page falls back without parsing its deeply nested HTML", async () => {
  const html = "<p>I am working on documentary film.</p>" + "<x>".repeat(9_000) + "</y>".repeat(9_000);
  const result = await portfolio.readPortfolio(root, {
    resolve: async () => [publicAddress],
    get: async () => ({ html }),
  });
  assert.equal(result, null);
});

test("a single tag with excessive attributes also exceeds the parsing budget", async () => {
  const attrs = Array.from({ length: 20_000 }, (_, index) => " field" + index).join("");
  const result = await portfolio.readPortfolio(root, {
    resolve: async () => [publicAddress],
    get: async () => ({ html: '<p title="one > two"' + attrs + ">Working on a short documentary.</p>" }),
  });
  assert.equal(result, null);
});

test("a submitted query or client-side route cannot silently turn into another page", async () => {
  const transport: PortfolioTransport = {
    resolve: async () => [publicAddress],
    get: async () => ({ html: "<p>This is unrelated copy from the platform homepage.</p>" }),
  };
  assert.equal(await portfolio.readPortfolio(root + "work?artist=maya", transport), null);
  assert.equal(await portfolio.readPortfolio(root + "#/work", transport), null);
});
