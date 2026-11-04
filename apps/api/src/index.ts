import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv } from './lib/env.js'
import { registerAuth } from './plugins/auth.js'
import { authRoutes } from './modules/auth/routes.js'
import { businessRoutes } from './modules/business/routes.js'
import { catalogRoutes } from './modules/catalog/routes.js'
import { productRoutes } from './modules/products/routes.js'
import { customerRoutes } from './modules/customers/routes.js'
import { projectRoutes } from './modules/projects/routes.js'
import { settingsRoutes } from './modules/settings/routes.js'
import { marketingRoutes } from './modules/marketing/routes.js'
import { adsRoutes } from './modules/ads/routes.js'
import { cmbRoutes } from './modules/cmb/routes.js'
import { checkmapRoutes } from './modules/checkmap/routes.js'
import { personasRoutes } from './modules/personas/routes.js'
import { tagsRoutes } from './modules/tags/routes.js'
import { sortanizeRoutes } from './modules/sortanize/routes.js'
import { openseoRoutes } from './modules/openseo/routes.js'
import { adminRoutes } from './modules/admin/routes.js'
import { integrationRoutes } from './modules/integrations/routes.js'
import { oauthIntegrationRoutes } from './modules/integrations/oauthRoutes.js'
import { inboxRoutes } from './modules/inbox/routes.js'
import { ensureMockAdapterRegistered } from './lib/integrations/core/mockAdapter.js'
import { ensureTelegramAdapterRegistered } from './lib/integrations/telegram/adapter.js'
import { ensureUnipileAdapterRegistered } from './lib/integrations/unipile/adapter.js'

async function main() {
  const env = loadEnv()
  const uploadsDir = resolve(env.UPLOADS_DIR)
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

  const app = Fastify({
    logger: true,
    trustProxy: true,
  })

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  })
  await app.register(cookie, { secret: env.SESSION_SECRET })
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } })
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  })

  await registerAuth(app)
  ensureMockAdapterRegistered()
  ensureTelegramAdapterRegistered()
  ensureUnipileAdapterRegistered()

  app.get('/api/health', async () => ({
    ok: true,
    service: 'bu2-api',
    version: '2.0.0',
  }))

  await authRoutes(app)
  await businessRoutes(app)
  await catalogRoutes(app)
  await productRoutes(app)
  await customerRoutes(app)
  await projectRoutes(app)
  await settingsRoutes(app)
  await marketingRoutes(app)
  await adsRoutes(app)
  await cmbRoutes(app)
  await checkmapRoutes(app)
  await personasRoutes(app)
  await tagsRoutes(app)
  await integrationRoutes(app)
  await oauthIntegrationRoutes(app)
  await inboxRoutes(app)
  await sortanizeRoutes(app)
  await openseoRoutes(app)
  await adminRoutes(app)

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number; issues?: unknown }
    const status = e.statusCode ?? 500
    if (status >= 500) app.log.error(e)
    else app.log.info(e)
    reply.code(status).send({
      error: e.message || 'error',
      ...(e.issues ? { issues: e.issues } : {}),
    })
  })

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
  console.info(`[bu2-api] listening on http://127.0.0.1:${env.API_PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
