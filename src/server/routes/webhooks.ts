import { Router } from 'express'
import type { PullRequestReviewCommentEvent, PullRequestReviewEvent } from '../../types/github-events.js'

export const webhooksRouter = Router()

/**
 * POST /webhooks/github
 *
 * GitHub webhook 이벤트 수신 엔드포인트.
 * X-GitHub-Event 헤더로 이벤트 타입 구분.
 *
 * 지원 이벤트:
 * - pull_request_review_comment: PR review comment 생성/수정/삭제
 * - pull_request_review: PR review 제출/수정/기각
 */
webhooksRouter.post('/github', async (req, res, next) => {
  try {
    const eventType = req.headers['x-github-event'] as string | undefined
    const deliveryId = req.headers['x-github-delivery'] as string | undefined

    console.log(`[webhooks] Received GitHub event: ${eventType} (delivery: ${deliveryId})`)

    if (!eventType) {
      return res.status(400).json({ error: 'Missing X-GitHub-Event header' })
    }

    // prEventService 미설정 시 503 반환
    if (!req.prEventService) {
      return res.status(503).json({ error: 'Webhook service not configured' })
    }

    // 이벤트 타입별 처리
    switch (eventType) {
      case 'pull_request_review_comment': {
        const payload = req.body as PullRequestReviewCommentEvent
        // action: created만 처리 (edited, deleted는 무시)
        if (payload.action === 'created') {
          await req.prEventService.handleReviewComment(payload)
        }
        break
      }

      case 'pull_request_review': {
        const payload = req.body as PullRequestReviewEvent
        // action: submitted + state: approved만 처리
        if (payload.action === 'submitted' && payload.review?.state === 'approved') {
          await req.prEventService.handleReviewApproved(payload)
        }
        break
      }

      case 'ping': {
        // GitHub webhook 설정 시 보내는 ping 이벤트
        console.log('[webhooks] Received ping event')
        break
      }

      default:
        console.log(`[webhooks] Ignoring unsupported event: ${eventType}`)
    }

    // GitHub은 2xx 응답을 기대
    res.status(200).json({ received: true })
  } catch (error) {
    next(error)
  }
})
