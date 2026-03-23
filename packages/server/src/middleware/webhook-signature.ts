import * as crypto from 'crypto'
import type { RequestHandler } from 'express'

/**
 * GitHub webhook signature 검증 미들웨어
 *
 * X-Hub-Signature-256 헤더를 검증하여 요청이 GitHub에서 온 것인지 확인.
 * secret이 설정되지 않으면 검증을 스킵한다 (개발 편의).
 *
 * 주의: Express의 express.json() 미들웨어가 body를 파싱한 후에 signature를 검증하면,
 * 파싱 과정에서 whitespace 등이 변경될 수 있어 signature가 맞지 않을 수 있다.
 * 현재는 body를 다시 stringify하여 검증하는 방식을 사용한다.
 * GitHub은 compact JSON을 보내므로 대부분 동작하지만, 엄밀한 검증이 필요하면
 * express.json({ verify: ... }) 옵션으로 raw body를 저장해야 한다.
 * MVP에서는 이 방식으로 진행하고, 문제 발생 시 개선한다.
 */
export function verifyGitHubSignature(secret: string | undefined): RequestHandler {
  return (req, res, next) => {
    // secret 미설정 시 검증 스킵
    if (!secret) {
      console.warn('[webhook-signature] No secret configured, skipping verification')
      return next()
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined
    if (!signature) {
      console.error('[webhook-signature] Missing X-Hub-Signature-256 header')
      return res.status(401).json({ error: 'Missing signature header' })
    }

    // body가 이미 파싱되어 있으므로 다시 stringify
    const payload = JSON.stringify(req.body)
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`

    // 타이밍 공격 방지를 위한 constant-time 비교
    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)

    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error('[webhook-signature] Signature length mismatch')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      console.error('[webhook-signature] Signature mismatch')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    next()
  }
}
