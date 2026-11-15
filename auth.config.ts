import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-compatible Auth.js config (no Prisma, no email provider).
 * Email/Resend requires an adapter — that lives only in auth.ts.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/portal/login",
    verifyRequest: "/portal/login?verify=1",
    error: "/portal/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname, search } = request.nextUrl;
      const isLogin = pathname === "/portal/login";
      const isLoggedIn = !!auth?.user;

      if (isLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/portal", request.nextUrl));
        }
        return true;
      }

      if (pathname.startsWith("/portal")) {
        if (isLoggedIn) return true;
        const login = new URL("/portal/login", request.nextUrl);
        login.searchParams.set("callbackUrl", `${pathname}${search}`);
        return Response.redirect(login);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
        if (user.image) token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) || session.user.id;
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
