import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import * as path from 'path'
import * as tc from '@actions/tool-cache'
import * as cache from '@actions/cache'
import * as core from '@actions/core'
import {install} from '../src/installer.js'

vi.mock('@actions/core')
vi.mock('@actions/tool-cache')
vi.mock('@actions/cache')
vi.mock('fs/promises', () => ({chmod: vi.fn()}))

const TOOL_CACHE = '/runner/tool-cache'
const VERSION_DIR = path.join(TOOL_CACHE, 'betterleaks', '1.2.3')
const KEY = `betterleaks-1.2.3-${process.platform}-${process.arch}`
const BIN = process.platform === 'win32' ? 'betterleaks.exe' : 'betterleaks'

describe('install', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('RUNNER_TOOL_CACHE', TOOL_CACHE)
    vi.mocked(cache.isFeatureAvailable).mockReturnValue(true)
    vi.mocked(tc.downloadTool).mockResolvedValue('/tmp/archive')
    vi.mocked(tc.extractTar).mockResolvedValue('/tmp/extracted')
    vi.mocked(tc.extractZip).mockResolvedValue('/tmp/extracted')
    vi.mocked(tc.cacheDir).mockResolvedValue('/cached')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses local tool cache without touching Actions cache', async () => {
    vi.mocked(tc.find).mockReturnValue('/local')

    const bin = await install('v1.2.3', '')

    expect(bin).toBe(path.join('/local', BIN))
    expect(cache.restoreCache).not.toHaveBeenCalled()
    expect(tc.downloadTool).not.toHaveBeenCalled()
  })

  it('restores from Actions cache on local miss', async () => {
    vi.mocked(tc.find).mockReturnValueOnce('').mockReturnValueOnce('/restored')
    vi.mocked(cache.restoreCache).mockResolvedValue(KEY)

    const bin = await install('v1.2.3', '')

    expect(cache.restoreCache).toHaveBeenCalledWith([VERSION_DIR], KEY)
    expect(bin).toBe(path.join('/restored', BIN))
    expect(tc.downloadTool).not.toHaveBeenCalled()
  })

  it('downloads and saves to Actions cache on full miss', async () => {
    vi.mocked(tc.find).mockReturnValue('')
    vi.mocked(cache.restoreCache).mockResolvedValue(undefined)

    const bin = await install('v1.2.3', 'tok')

    expect(tc.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('/v1.2.3/betterleaks_1.2.3_'),
      undefined,
      'token tok'
    )
    expect(tc.cacheDir).toHaveBeenCalledWith(
      '/tmp/extracted',
      'betterleaks',
      '1.2.3',
      process.arch
    )
    expect(cache.saveCache).toHaveBeenCalledWith([VERSION_DIR], KEY)
    expect(bin).toBe(path.join('/cached', BIN))
  })

  it('warns but succeeds when cache restore and save throw', async () => {
    vi.mocked(tc.find).mockReturnValue('')
    vi.mocked(cache.restoreCache).mockRejectedValue(new Error('boom'))
    vi.mocked(cache.saveCache).mockRejectedValue(new Error('reserved'))

    const bin = await install('v1.2.3', '')

    expect(bin).toBe(path.join('/cached', BIN))
    expect(core.warning).toHaveBeenCalledWith(
      'Actions cache restore failed: boom'
    )
    expect(core.warning).toHaveBeenCalledWith(
      'Actions cache save failed: reserved'
    )
  })

  it('skips Actions cache when feature unavailable', async () => {
    vi.mocked(tc.find).mockReturnValue('')
    vi.mocked(cache.isFeatureAvailable).mockReturnValue(false)

    await install('v1.2.3', '')

    expect(cache.restoreCache).not.toHaveBeenCalled()
    expect(cache.saveCache).not.toHaveBeenCalled()
    expect(tc.downloadTool).toHaveBeenCalled()
  })
})
