import { resolve } from "node:path";
import { z } from "zod";
import { CommunityError, errorResponse, jsonResponse, requestJson } from "../http.ts";
import { cookieValue, HOST_COOKIE, HOST_TTL_MS, memberContext, MEMBER_COOKIE, newHostSession, pilotEnabled, pilotOrigin, safeEqual, setCookie, validHostSession } from "./access.ts";
import { cardSchema, CONSENT_QUESTION, eventIdSchema, LINK_QUESTION, LumaIntake } from "./intake.ts";
import { sampleSnapshot } from "./sample.ts";
import { MEMBER_TTL_MS, PilotStore } from "./store.ts";

export type PilotOptions = { env?: Record<string, string | undefined>; store?: PilotStore; fetcher?: typeof fetch };

const action = <T extends string>(name: T) => z.object({ action: z.literal(name) }).strict();
const context = z.string().regex(/^[a-f0-9]{24}$/);
const input = z.discriminatedUnion("action", [
  action("host-login").extend({ key: z.string().max(256) }),
  action("host-view"), action("host-logout"), action("host-inspect"),
  action("host-sync").extend({ source: z.enum(["luma", "sample"]) }),
  action("host-issue").extend({ eventId: eventIdSchema, guestId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }),
  action("claim").extend({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
  action("card"), action("hide").extend({ context }), action("withdraw").extend({ context }),
  action("share").extend({ context, card: cardSchema }),
  action("discover").extend({ context, query: z.string().trim().max(240).default("") }),
]);

export async function handlePilot(request: Request, options: PilotOptions = {}): Promise<Response> {
  const env = options.env ?? process.env;
  const origin = pilotOrigin(request);
  if (!pilotEnabled(env) || !origin) return jsonResponse({ error: "This pilot is unavailable." }, 404);
  try {
    const parsed = input.safeParse(await requestJson(request, origin));
    if (!parsed.success) throw new CommunityError("Check the form and try again.");
    const data = parsed.data;
    const now = Date.now();
    const secret = env.COMMUNITY_PILOT_HOST_KEY!;
    if (data.action === "host-login") {
      if (!safeEqual(data.key, secret)) throw new CommunityError("That host key didn’t match.", 401);
      return setCookie(jsonResponse({ signedIn: true }), request, HOST_COOKIE, newHostSession(secret, now), HOST_TTL_MS);
    }
    if (data.action.startsWith("host-") && !validHostSession(cookieValue(request, HOST_COOKIE), secret, now)) {
      throw new CommunityError("Sign in as a host.", 401);
    }
    const store = options.store ?? new PilotStore(resolve(env.COMMUNITY_PILOT_DB_PATH || ".sundays-pilot/pilot.sqlite"));
    const liveId = env.COMMUNITY_PILOT_LUMA_EVENT_ID;
    const liveConfigured = !!env.LUMA_API_KEY && !!liveId && eventIdSchema.safeParse(liveId).success;
    const admin = () => jsonResponse({
      events: store.hostEvents(), liveConfigured,
      form: { consent: CONSENT_QUESTION, link: LINK_QUESTION },
    });
    const live = () => {
      if (!liveConfigured) throw new CommunityError("Set the local Luma key and event ID first.", 409);
      return new LumaIntake(env.LUMA_API_KEY!, options.fetcher);
    };
    const session = cookieValue(request, MEMBER_COOKIE);
    if ("context" in data && (!session || !safeEqual(data.context, memberContext(session)))) {
      throw new CommunityError("This tab’s claim session changed. Open your own card again.", 401);
    }
    switch (data.action) {
      case "host-view": return admin();
      case "host-logout": return setCookie(jsonResponse({ signedIn: false }), request, HOST_COOKIE, "", 0);
      case "host-inspect": {
        const event = await live().event(liveId!);
        if (!event.consentQuestion) store.block(event.id, now);
        return jsonResponse({ event });
      }
      case "host-sync": {
        if (data.source === "sample") store.sync(sampleSnapshot(now));
        else {
          const adapter = live();
          try { store.sync(await adapter.snapshot(liveId!)); }
          catch (error) {
            if (error instanceof CommunityError && error.message.startsWith("Add the optional intro-card opt-in")) store.block(liveId!, now);
            throw error;
          }
        }
        return admin();
      }
      case "host-issue": {
        const token = store.issue(data.eventId, data.guestId, now);
        return jsonResponse({ claimPath: "/meet/pilot/card#" + token });
      }
      case "claim": {
        const value = store.claim(data.token, now);
        return setCookie(jsonResponse(store.view(value, now)), request, MEMBER_COOKIE, value, MEMBER_TTL_MS);
      }
      case "card": return jsonResponse(store.view(session, now));
      case "share": {
        store.share(session, data.card, now);
        return jsonResponse(store.view(session, now));
      }
      case "hide": {
        store.hide(session, now);
        return jsonResponse(store.view(session, now));
      }
      case "withdraw": {
        store.withdraw(session, now);
        return setCookie(jsonResponse({ withdrawn: true }), request, MEMBER_COOKIE, "", 0);
      }
      case "discover": return jsonResponse(store.introductions(session, data.query, now));
    }
  } catch (error) { return errorResponse(error); }
}
