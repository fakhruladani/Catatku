import "server-only";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { basePrisma } from "@/server/db/base-client";
import { resetPasswordEmail, sendEmail, verificationEmail } from "@/server/email";
import { provisionNewUser } from "@/server/provision";

export const emailVerificationEnabled = process.env.EMAIL_VERIFICATION !== "false";

// Parameter argon2id (OWASP 2024: m=19 MiB, t=2, p=1)
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "Catatku",
  baseURL: process.env.BETTER_AUTH_URL ?? appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: prismaAdapter(basePrisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: emailVerificationEnabled,
    autoSignIn: !emailVerificationEnabled,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    password: {
      hash: (password) => argonHash(password, ARGON_OPTS),
      verify: ({ hash, password }) => argonVerify(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(resetPasswordEmail(user.email, user.name, url));
    },
  },

  emailVerification: {
    sendOnSignUp: emailVerificationEnabled,
    sendOnSignIn: emailVerificationEnabled,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(verificationEmail(user.email, user.name, url));
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 hari
    updateAge: 60 * 60 * 24, // perpanjang tiap 1 hari aktivitas
    // cookieCache sengaja OFF: sesi yang dicabut (logout semua perangkat) langsung tidak berlaku.
  },

  rateLimit: {
    enabled: process.env.NODE_ENV === "production" || process.env.RATE_LIMIT === "true",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await provisionNewUser(user.id);
        },
      },
    },
  },

  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
