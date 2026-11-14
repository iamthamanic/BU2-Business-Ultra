/**
 * Better Auth instance — sole AuthN source for BU2.
 * Location: apps/api/src/lib/betterAuth.ts
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { emailOTP } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import {
  baAccount,
  baSession,
  baUser,
  baVerification,
  users,
} from '../db/schema.js'
import { loadEnv } from './env.js'
import { sendMagicLinkEmail } from './brevo.js'
import { writeAudit } from './audit.js'
import { hashPassword, verifyPassword } from './password.js'

const env = loadEnv()

async function syncBu2User(ba: {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
}) {
  const existing = await db.select().from(users).where(eq(users.id, ba.id)).limit(1)
  if (existing[0]) {
    await db
      .update(users)
      .set({
        email: ba.email.toLowerCase(),
        displayName: ba.name || existing[0].displayName,
        emailVerified: ba.emailVerified,
        image: ba.image ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, ba.id))
    return
  }
  await db.insert(users).values({
    id: ba.id,
    email: ba.email.toLowerCase(),
    displayName: ba.name || null,
    emailVerified: ba.emailVerified,
    image: ba.image ?? null,
  })
}

// Cast: Better Auth plugin inference pulls zod v4 types incompatible with our zod v3 emit.
export const auth = betterAuth({
  appName: 'Business Ultra',
  baseURL: env.PUBLIC_API_URL,
  secret: env.SESSION_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: baUser,
      session: baSession,
      account: baAccount,
      verification: baVerification,
    },
  }),
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
    },
  },
  trustedOrigins: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: async (password) => hashPassword(password),
      verify: async ({ hash, password }) => verifyPassword(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendMagicLinkEmail({
        to: user.email,
        magicUrl: url,
        otp: '------',
      })
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await syncBu2User({
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: Boolean(user.emailVerified),
            image: user.image,
          })
        },
      },
      update: {
        after: async (user) => {
          await syncBu2User({
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: Boolean(user.emailVerified),
            image: user.image,
          })
        },
      },
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        const sent = await sendMagicLinkEmail({
          to: email,
          magicUrl: url,
          otp: '------',
        })
        await writeAudit({
          action: 'auth.magic_link_requested',
          meta: { email, mode: sent.mode },
        })
      },
    }),
    emailOTP({
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const envLocal = loadEnv()
        const magicUrl = `${envLocal.PUBLIC_WEB_URL}/login/verify`
        const sent = await sendMagicLinkEmail({ to: email, magicUrl, otp })
        await writeAudit({
          action: 'auth.otp_requested',
          meta: { email, type, mode: sent.mode },
        })
      },
    }),
  ],
}) as unknown as {
  api: {
    getSession: (args: { headers: Headers | Record<string, string> }) => Promise<{ user?: { id: string; email: string; name?: string; emailVerified?: boolean } } | null>
    signInEmail: (args: Record<string, unknown>) => Promise<Response>
    signOut: (args: Record<string, unknown>) => Promise<Response>
    changePassword: (args: Record<string, unknown>) => Promise<unknown>
    signInMagicLink: (args: Record<string, unknown>) => Promise<unknown>
    signInEmailOTP: (args: Record<string, unknown>) => Promise<Response>
  }
  handler: (req: Request) => Promise<Response>
}
