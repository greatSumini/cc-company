import { describe, it, expect, vi } from 'vitest'
import * as crypto from 'crypto'
import { verifyGitHubSignature } from '../../src/server/middleware/webhook-signature.js'
import type { Request, Response, NextFunction } from 'express'

describe('verifyGitHubSignature', () => {
  const secret = 'test-secret'

  function createMockReq(body: object, signature?: string): Partial<Request> {
    return {
      body,
      headers: signature ? { 'x-hub-signature-256': signature } : {},
    }
  }

  function createValidSignature(body: object, secret: string): string {
    const payload = JSON.stringify(body)
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return `sha256=${hmac}`
  }

  it('TC 4.1: 유효한 signature → next() 호출', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = { test: 'data' }
    const signature = createValidSignature(body, secret)

    const req = createMockReq(body, signature) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('TC 4.2: 잘못된 signature → 401', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = { test: 'data' }

    const req = createMockReq(body, 'sha256=invalid') as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('TC 4.3: signature 헤더 없음 → 401', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = { test: 'data' }

    const req = createMockReq(body) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('TC 4.4: secret 미설정 → 검증 스킵, next() 호출', () => {
    const middleware = verifyGitHubSignature(undefined)
    const body = { test: 'data' }

    const req = createMockReq(body) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('TC 4.5: 빈 body → 정상 검증', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = {}
    const signature = createValidSignature(body, secret)

    const req = createMockReq(body, signature) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})
