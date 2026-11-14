/**
 * Schema ownership barrel — re-exports all tables.
 * Prefer importing from `../db/schema.js` (stable path via schema.ts).
 * Export order avoids TDZ issues for cross-file FK refs.
 */
export * from './identity.js'
export * from './tools.js'
export * from './crm.js'
export * from './orders.js'
export * from './integrations.js'
export * from './projects.js'
export * from './inbox.js'
export * from './marketing.js'
export * from './finance.js'
