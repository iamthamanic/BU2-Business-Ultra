import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mediaApiPath, parseMediaUrlPath, resolveBusinessMediaFile } from './mediaPaths.js'

describe('mediaPaths', () => {
  it('builds api media paths', () => {
    expect(mediaApiPath('biz1', 'logo', 'a.png')).toBe('/api/media/biz1/logo/a.png')
  })

  it('parses legacy and api urls', () => {
    expect(parseMediaUrlPath('/uploads/biz1/logo/a.png')).toEqual({
      businessId: 'biz1',
      relative: 'logo/a.png',
    })
    expect(parseMediaUrlPath('/api/media/biz1/inbox/x.jpg')).toEqual({
      businessId: 'biz1',
      relative: 'inbox/x.jpg',
    })
  })

  it('rejects path traversal', () => {
    const root = mkdtempSync(join(tmpdir(), 'bu2-media-'))
    mkdirSync(join(root, 'biz1'), { recursive: true })
    writeFileSync(join(root, 'biz1', 'ok.txt'), 'x')
    expect(resolveBusinessMediaFile(root, 'biz1', '../biz1/ok.txt')).toBeNull()
    expect(resolveBusinessMediaFile(root, 'biz1', 'ok.txt')).toBe(join(root, 'biz1', 'ok.txt'))
    expect(resolveBusinessMediaFile(root, '../evil', 'x')).toBeNull()
  })
})
