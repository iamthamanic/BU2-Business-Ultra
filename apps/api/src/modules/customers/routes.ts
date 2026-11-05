/**
 * Customers module HTTP entry — wires CRUD / notes / engagement.
 * Domain helpers: ./service.ts
 * Location: apps/api/src/modules/customers/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import { registerCustomerCrudRoutes } from './customerCrudRoutes.js'
import { registerEngagementRoutes } from './engagementRoutes.js'
import { registerNoteRoutes } from './noteRoutes.js'

export async function customerRoutes(app: FastifyInstance) {
  await registerCustomerCrudRoutes(app)
  await registerNoteRoutes(app)
  await registerEngagementRoutes(app)
}
