/**
 * settings domain helpers.
 * Location: apps/api/src/modules/settings/service.ts
 */
import { z } from 'zod'
import { SecretProviderSchema } from '@bu2/shared'

export const UpsertSecretSchema = z.object({
  provider: SecretProviderSchema,
  apiKey: z.string().min(8).max(4000),
})

export const LinkMetricoolSchema = z.object({
  blogId: z.string().min(1).max(80),
  label: z.string().max(160).optional(),
})
