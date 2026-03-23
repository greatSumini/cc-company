import type {
  Ticket,
  UpdateTicketInput,
  TicketFilter,
  Comment,
  CreateCommentInput,
} from '../types/index.js'

export interface ITicketStore {
  // CRUD
  // metadata는 optional이므로 input에 포함 가능
  create(
    input: Omit<Ticket, 'id' | 'version' | 'comments' | 'createdAt'>
  ): Promise<Ticket>
  get(id: string): Promise<Ticket | null>
  list(filter?: TicketFilter): Promise<Ticket[]>
  update(id: string, input: UpdateTicketInput): Promise<Ticket>

  // 취소
  cancel(id: string, expectedVersion: number): Promise<Ticket>

  // 코멘트
  addComment(ticketId: string, input: CreateCommentInput): Promise<Comment>

  // 실행 로그
  saveLog(ticketId: string, log: string): Promise<void>
  getLog(ticketId: string): Promise<string | null>
}

export class OptimisticLockError extends Error {
  constructor(message = 'Version mismatch') {
    super(message)
    this.name = 'OptimisticLockError'
  }
}

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Ticket not found: ${id}`)
    this.name = 'TicketNotFoundError'
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid status transition: ${from} -> ${to}`)
    this.name = 'InvalidStatusTransitionError'
  }
}

export class DelegationPermissionError extends Error {
  constructor(agentName: string) {
    super(`Agent '${agentName}' does not have delegation permission`)
    this.name = 'DelegationPermissionError'
  }
}
