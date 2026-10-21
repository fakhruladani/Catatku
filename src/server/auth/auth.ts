import "server-only";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { basePrisma } from "@/server/db/base-client";
import { USERNAME_MAX, USERNAME_MIN, USERNAME_RE } from "@/lib/username";

// Parameter argon2id (OWASP: m=19 MiB, t=2, p=1). Dipakai juga oleh fitur admin (buat/reset password).
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const hashPassword = (password: string) => argonHash(password, ARGON_OPTS);
export const verifyPassword = (hash: string, password: string) => argonVerify(hash, password);

const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * Model akun:
 * - Login dengan USERNAME + password (plugin username).
 * - Pendaftaran mandiri DIMATIKAN. Akun hanya dibuat oleh admin (src/features/admin).
 * - Tidak ada alur email (verifikasi / lupa password); password lupa di-reset oleh admin.
 */
export const auth = betterAuth({
  appName: "Catatku",
  baseURL: process.env.BETTER_AUTH_URL ?? appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: prismaAdapter(basePrisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },

  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "USER", input: false },
    },
  },

  // Endpoint bawaan yang tidak dipakai aplikasi ditutup (mengecilkan permukaan serangan).
  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/verify-email",
    "/change-email",
    "/update-user",
    "/delete-user",
    "/sign-in/social",
    "/link-social",
    "/unlink-account",
    "/is-username-available",
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 hari
    updateAge: 60 * 60 * 24,
    // cookieCache OFF: akun yang dihapus / password yang di-reset admin langsung tidak berlaku.
  },

  rateLimit: {
    enabled: process.env.NODE_ENV === "production" || process.env.RATE_LIMIT === "true",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
  },

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await basePrisma.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } });
        },
      },
    },
  },

  plugins: [
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (u) => USERNAME_RE.test(u.toLowerCase()),
      immutableUsername: true,
      displayUsername: false,
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
