/**
 * Projects module HTTP entry — wires CRUD / tasks / recurrence.
 * Domain helpers: ./service.ts
 * Location: apps/api/src/modules/projects/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import { registerProjectCrudRoutes } from './projectRoutes.js'
import { registerTaskRoutes } from './taskRoutes.js'
import { registerRecurrenceRoutes } from './recurrenceRoutes.js'

export async function projectRoutes(app: FastifyInstance) {
  await registerProjectCrudRoutes(app)
  await registerTaskRoutes(app)
  await registerRecurrenceRoutes(app)
}
