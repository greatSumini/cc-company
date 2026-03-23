import { Request, Response, NextFunction } from 'express'

export interface AuthContext {
  isAuthenticated: boolean
  userId?: string
  permissions?: string[]
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

/**
 * 인증 미들웨어 (현재는 항상 인증된 것으로 처리)
 * 향후 원격 호스팅 시 실제 인증 로직 추가 예정
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 현재: 항상 인증된 것으로 처리
  req.auth = { isAuthenticated: true }
  next()
}
