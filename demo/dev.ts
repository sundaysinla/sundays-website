/**
 * Runs the portal for a live demo: Next on 127.0.0.1:4020 against the local
 * demo database, plus a control panel on :4021 that signs you in as any of
 * the demo personas in one click and can reset the data mid-demo.
 *
 * Sign-in is minted, not faked: the panel encrypts an Auth.js JWT with the
 * app's own encode() and the real AUTH_SECRET and sets it as the session
 * cookie. Cookies ignore ports, so a cookie set by :4021 is sent to :4020.
 * No auth bypass is added to the portal.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { encode } from "next-auth/jwt";
import { appUrl, demoEnv, panelPort, portalDir, portalEnv } from "./env.ts";

const COOKIE = "authjs.session-token";
const port = new URL(appUrl).port || "4020";
const host = new URL(appUrl).hostname;
const panelUrl = `http://${host}:${panelPort}`;

type Persona = { key: string; id: string; name: string; email: string; role: string; blurb: string; links: [string, string][] };

const personas: Persona[] = [
  {
    key: "jordan", id: "demo-jordan", name: "Jordan Chen", email: "jordan.chen@example.com", role: "Member",
    blurb: "Checked in today, rode in Devin's confirmed car, has met 9 people across four Sundays.",
    links: [["Home", "/portal"], ["I met", "/portal/met"], ["Profile + met-graph", "/portal/profile"], ["Carpool", "/portal/carpool"], ["RSVP", "/portal/rsvp"]],
  },
  {
    key: "maya", id: "demo-maya", name: "Maya Okonkwo", email: "maya.okonkwo@example.com", role: "Driver",
    blurb: "Drove three people from Palms; sees stop order, addresses and phones.",
    links: [["Carpool", "/portal/carpool"], ["Profile", "/portal/profile"]],
  },
  {
    key: "lena", id: "demo-lena", name: "Lena Park", email: "lena.park@example.com", role: "Uber booker",
    blurb: "Orders the shared Uber from USC Village for four.",
    links: [["Carpool", "/portal/carpool"]],
  },
  {
    key: "richard", id: "demo-richard", name: "Richard Zhang", email: "host@sundays.example", role: "Host",
    blurb: "Admin. Carpool board and the door list.",
    links: [["Carpool board", "/portal/admin"], ["Check-in", "/portal/admin/checkin"], ["I met", "/portal/met"]],
  },
];

async function sessionCookie(p: Persona) {
  const secret = process.env.AUTH_SECRET || portalEnv.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not found in .env.local");
  const maxAge = 12 * 3600;
  const value = await encode({ token: { sub: p.id, name: p.name, email: p.email }, secret, salt: COOKIE, maxAge });
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function panel(flash?: string) {
  const cards = personas
    .map(
      (p) => `
      <li class="card">
        <div class="who"><span class="role">${esc(p.role)}</span><h2>${esc(p.name)}</h2><p>${esc(p.blurb)}</p></div>
        <div class="links">${p.links.map(([label, to]) => `<a href="/as/${p.key}?to=${encodeURIComponent(to)}">${esc(label)}</a>`).join("")}</div>
      </li>`
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sundays demo panel</title>
<style>
  :root { --paper:#FCFAF7; --ink:#010101; --blue:#3600CF; --blue2:#C3B3F1; --lime:#CBFF36; }
  * { box-sizing:border-box } body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.45 "Times New Roman", Times, serif; }
  main { max-width:880px; margin:0 auto; padding:40px 16px 64px; }
  .eyebrow, .role, .links a, button, .flash { font:11px/1 ui-sans-serif, system-ui, sans-serif; text-transform:uppercase; letter-spacing:.06em; }
  .eyebrow { color:var(--blue); } h1 { font-weight:300; font-size:40px; margin:8px 0 4px; text-transform:lowercase; }
  ul { list-style:none; padding:0; margin:24px 0; display:grid; gap:12px; }
  .card { border:1px solid rgba(1,1,1,.15); border-radius:20px; padding:18px 20px; display:grid; gap:12px; background:#fff; }
  .card h2 { margin:6px 0 2px; font-weight:400; font-size:22px; } .card p { margin:0; color:rgba(1,1,1,.7); }
  .role { color:var(--blue); } .links { display:flex; flex-wrap:wrap; gap:8px; }
  .links a { color:var(--ink); text-decoration:none; border:1px solid rgba(1,1,1,.2); border-radius:14px; padding:8px 12px; }
  .links a:first-child { background:var(--ink); color:var(--paper); border-color:var(--ink); }
  .links a:hover { background:var(--blue2); color:var(--ink); }
  ol { padding-left:20px; } ol li { margin:6px 0; } code { font-size:14px; }
  button { background:var(--lime); border:1px solid var(--ink); border-radius:14px; padding:10px 14px; cursor:pointer; }
  .flash { background:var(--lime); display:inline-block; padding:8px 12px; border-radius:12px; }
  .muted { color:rgba(1,1,1,.55); font-size:14px; }
</style></head><body><main>
<p class="eyebrow">Sundays portal · live demo</p>
<h1>who are we today?</h1>
<p class="muted">Fictional cast on a local database. Nothing here emails, texts, or touches Luma or Neon. Each link signs you in as that person and opens the page.</p>
${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
<ul>${cards}</ul>
<h2 style="font-weight:400">run of show</h2>
<ol>
  <li><b>Jordan → Home.</b> Lime "you're checked in" card. <b>Open the room</b>: everyone checked in today; tap two people, add a note.</li>
  <li><b>Jordan → Profile.</b> The met-graph: nine people over four Sundays, with the notes.</li>
  <li><b>Jordan → Carpool.</b> Confirmed ride in Devin's car: stop 3 of 3, route on the map, the car's group chat.</li>
  <li><b>Richard → Check-in.</b> 24 here, 9 still to arrive. Check someone in (Olivia), add a walk-in.</li>
  <li><b>Richard → Carpool board.</b> Four riders waiting. <b>Suggest placements</b> puts Isla in Priya's last seat; <b>Uber the rest</b> groups Tomás, Sam and Ada at De Neve. <b>Confirm</b> both.</li>
  <li><b>Maya / Lena → Carpool.</b> What a driver and an Uber booker see.</li>
</ol>
<form method="post" action="/reset"><button type="submit">Reset demo data</button> <span class="muted">puts everything back to the start (takes a few seconds)</span></form>
<p class="muted">Portal: <a href="${appUrl}/portal">${appUrl}</a></p>
</main></body></html>`;
}

createServer(async (req, res) => {
  try {
    const u = new URL(req.url ?? "/", panelUrl);
    const as = u.pathname.match(/^\/as\/([a-z]+)$/);
    if (as) {
      const p = personas.find((x) => x.key === as[1]);
      if (!p) return void res.writeHead(404).end("No such persona");
      const to = u.searchParams.get("to") ?? "/portal";
      res.writeHead(302, { "Set-Cookie": await sessionCookie(p), Location: `${appUrl}${to.startsWith("/") ? to : "/portal"}` });
      return void res.end();
    }
    if (u.pathname === "/reset" && req.method === "POST") {
      const { runSeed } = await import("./seed.ts");
      await runSeed();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return void res.end(panel("Demo data reset"));
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(panel());
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end(String(e instanceof Error ? e.stack : e));
  }
}).listen(panelPort, host, () => console.log(`demo panel → ${panelUrl}`));

const pause = (seconds: number) => spawnSync("sleep", [String(seconds)]);
const dockerUp = () => spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;

// Docker Desktop may be closed; open it and wait for the daemon.
if (!dockerUp() && process.platform === "darwin") {
  console.log("starting Docker Desktop…");
  spawnSync("open", ["-a", "Docker"]);
  for (let i = 0; i < 120 && !dockerUp(); i++) pause(1);
}
// The database container may have been stopped since the last run; start it (a no-op if it's up).
const db = spawnSync("docker", ["start", "sundays-live-demo-pg"], { encoding: "utf8" });
if (db.status !== 0) {
  console.error(
    dockerUp()
      ? "The demo database container is gone. Run: npm run demo:db && npm run demo:seed"
      : "Docker isn't running. Open Docker Desktop and try again."
  );
  process.exit(1);
}
for (let i = 0; i < 60 && spawnSync("docker", ["exec", "sundays-live-demo-pg", "pg_isready", "-q", "-U", "demo", "-d", "sundays_demo"]).status !== 0; i++) pause(0.5);

// Seeded on another day (or hours ago)? Check-in, "I met" and the carpool board
// only show a Sunday that's under way, so move the demo up to now.
const seed = await import("./seed.ts");
if (await seed.demoIsStale()) {
  console.log("demo data is from another day; re-seeding so the demo Sunday is under way…");
  await seed.runSeed();
}

const env = { ...process.env, ...demoEnv, PORT: port };
console.log(`portal     → ${appUrl}   db → ${demoEnv.DATABASE_URL}`);
console.log("mail/sms/luma keys blanked for this run");
console.log(`\n  Sign in from the panel, not the portal's login page: ${panelUrl}\n`);
// Google sign-in can't work on 127.0.0.1, so the panel is the way in; open it for you.
if (process.platform === "darwin" && !process.env.DEMO_NO_OPEN) setTimeout(() => spawn("open", [panelUrl]), 1500);

const child = spawn("npx", ["next", "dev", "-p", port, "-H", host], { cwd: portalDir, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill(sig));
