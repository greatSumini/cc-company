import { Request, Response, NextFunction } from 'express'
import {
  OptimisticLockError,
  TicketNotFoundError,
  InvalidStatusTransitionError,
  DelegationPermissionError,
} from '@agentinc/core'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[Server Error]', err.message)

  if (res.headersSent) {
    return next(err)
  }

  if (err instanceof OptimisticLockError) {
    res.status(409).json({ error: err.message })
    return
  }

  if (err instanceof TicketNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }

  if (err instanceof InvalidStatusTransitionError) {
    res.status(400).json({ error: err.message })
    return
  }

  if (err instanceof DelegationPermissionError) {
    res.status(403).json({ error: err.message })
    return
  }

  // 기타 에러
  res.status(500).json({ error: 'Internal server error' })
}
