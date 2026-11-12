import { resolve } from "node:path";
import { z } from "zod";
import { CommunityError, errorResponse, jsonResponse, requestJson } from "../http.ts";
import { cookieValue, HOST_COOKIE, HOST_TTL_MS, memberContext, MEMBER_COOKIE, newHostSession, pilotEnabled, pilotOrigin, safeEqual, setCookie, validHostSession } from "./access.ts";
import { eventIdSchema, LINK_QUESTION, LumaIntake, ProjectQuestionMissing } from "./intake.ts";
import { readPortfolio, type Portfolio } from "./portfolio.ts";
import { samplePortfolio, sampleSnapshot } from "./sample.ts";
import { MEMBER_TTL_MS, PilotStore } from "./store.ts";

export type PilotOptions = {
  env?: Record<string, string | undefined>; store?: PilotStore; fetcher?: typeof fetch;
  portfolioReader?: (link: string) => Promise<Portfolio | null>;
};
const preparing = new Map<string, Promise<void>>();

const action = <T extends string>(name: T) => z.object({ action: z.literal(name) }).strict();
const context = z.string().regex(/^[a-f0-9]{24}$/);
const input = z.discriminatedUnion("action", [
  action("host-login").extend({ key: z.string().max(256) }),
  action("host-view"), action("host-logout"), action("host-inspect"),
  action("host-sync").extend({ source: z.enum(["luma", "sample"]) }),
  action("host-issue").extend({ eventId: eventIdSchema, guestId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }),
  action("claim").extend({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
  action("card"), action("prepare").extend({ context }), action("hide").extend({ context }), action("withdraw").extend({ context }),
  action("share").extend({ context, revision: z.string().regex(/^[a-zA-Z0-9_-]{43}$/), includePortfolio: z.boolean() }),
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
      form: { link: LINK_QUESTION },
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
        if (!event.projectQuestion) store.block(event.id, now);
        return jsonResponse({ event });
      }
      case "host-sync": {
        if (data.source === "sample") store.sync(sampleSnapshot(now));
        else {
          const adapter = live();
          try { store.sync(await adapter.snapshot(liveId!)); }
          catch (error) {
            if (error instanceof ProjectQuestionMissing) store.block(liveId!, now);
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
      case "prepare": {
        const target = store.preparation(session, now);
        if (!target.prepared) {
          let task = preparing.get(session);
          if (!task) {
            task = (async () => {
              const source = target.guest.source;
              if (target.event.source === "luma" && target.event.id !== liveId) {
                throw new CommunityError("Ask a host to refresh this event.", 409);
              }
              const card = source.kind === "sample" ? source.card : await live().cardSource(target.event, target.guest);
              store.assertPreparation(session, target, Date.now());
              const portfolio = source.kind === "sample" ? samplePortfolio(card.link) :
                card.link ? await (options.portfolioReader ?? readPortfolio)(card.link).catch(() => null) : null;
              store.savePreparation(session, target, {
                project: card.project, portfolio, portfolioUnavailable: card.portfolioSubmitted && !portfolio,
              }, Date.now());
            })().finally(() => preparing.delete(session));
            preparing.set(session, task);
          }
          await task;
        }
        return jsonResponse(store.view(session, Date.now()));
      }
      case "share": {
        store.share(session, data.revision, data.includePortfolio, now);
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
