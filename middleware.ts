import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Edge middleware — only imports auth.config (no Prisma).
 * Redirect rules live in authConfig.callbacks.authorized.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/portal", "/portal/:path*"],
};
