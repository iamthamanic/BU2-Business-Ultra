/**
 * Env loader unit tests — no real secrets; uses temp key bags only.
 * Location: apps/api/src/lib/env.test.ts
 */
import { describe, expect, it } from 'vitest'
import { applyDotenvText, loadDotenvFromRoot, resetEnvCacheForTests } from './env.js'

describe('applyDotenvText', () => {
  it('does not override already-set process keys', () => {
    const bag: NodeJS.ProcessEnv = { FOO: 'from-process' }
    applyDotenvText('FOO=from-file\nBAR=only-file\n', bag)
    expect(bag.FOO).toBe('from-process')
    expect(bag.BAR).toBe('only-file')
  })

  it('skips comments and blank lines; strips quotes', () => {
    const bag: NodeJS.ProcessEnv = {}
    applyDotenvText(
      [
        '# comment',
        '',
        'A=plain',
        'B="quoted"',
        "C='single'",
      ].join('\n'),
      bag,
    )
    expect(bag.A).toBe('plain')
    expect(bag.B).toBe('quoted')
    expect(bag.C).toBe('single')
  })

  it('first apply wins when simulating .env.local then .env', () => {
    const bag: NodeJS.ProcessEnv = {}
    applyDotenvText('SESSION_SECRET=from-local\n', bag)
    applyDotenvText('SESSION_SECRET=from-env\nAPI_PORT=8742\n', bag)
    expect(bag.SESSION_SECRET).toBe('from-local')
    expect(bag.API_PORT).toBe('8742')
  })
})

describe('loadDotenvFromRoot', () => {
  it('skips file load in production (process env only)', () => {
    resetEnvCacheForTests()
    const before = process.env.SESSION_SECRET
    // Must not throw; production path returns without reading files.
    expect(() => loadDotenvFromRoot({ forceReload: true, nodeEnv: 'production' })).not.toThrow()
    expect(process.env.SESSION_SECRET).toBe(before)
    resetEnvCacheForTests()
  })
})

describe('resetEnvCacheForTests', () => {
  it('is callable without throwing', () => {
    expect(() => resetEnvCacheForTests()).not.toThrow()
  })
})
