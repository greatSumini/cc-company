import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type {
  Ticket,
  TicketFilter,
  UpdateTicketInput,
  Comment,
  CreateCommentInput,
  TicketPriority,
} from '../types/index.js'
import {
  ITicketStore,
  OptimisticLockError,
  TicketNotFoundError,
  InvalidStatusTransitionError,
} from './ticket-store.js'

const PRIORITY_ORDER: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

export class FsTicketStore implements ITicketStore {
  constructor(private basePath: string) {}

  private get ticketsDir(): string {
    return path.join(this.basePath, '.agentinc', 'tickets')
  }

  private ticketPath(id: string): string {
    return path.join(this.ticketsDir, `${id}.json`)
  }

  private ticketLogDir(id: string): string {
    return path.join(this.ticketsDir, id)
  }

  private ticketLogPath(id: string): string {
    return path.join(this.ticketLogDir(id), 'execution.log')
  }

  private ensureTicketsDir(): void {
    if (!fs.existsSync(this.ticketsDir)) {
      fs.mkdirSync(this.ticketsDir, { recursive: true })
    }
  }

  async create(
    input: Omit<Ticket, 'id' | 'version' | 'comments' | 'createdAt'>
  ): Promise<Ticket> {
    this.ensureTicketsDir()

    const ticket: Ticket = {
      ...input,
      id: crypto.randomUUID(),
      version: 1,
      comments: [],
      createdAt: new Date().toISOString(),
    }

    fs.writeFileSync(this.ticketPath(ticket.id), JSON.stringify(ticket, null, 2))
    return ticket
  }

  async get(id: string): Promise<Ticket | null> {
    const ticketPath = this.ticketPath(id)
    if (!fs.existsSync(ticketPath)) {
      return null
    }
    return JSON.parse(fs.readFileSync(ticketPath, 'utf-8'))
  }

  async list(filter?: TicketFilter): Promise<Ticket[]> {
    if (!fs.existsSync(this.ticketsDir)) {
      return []
    }

    const files = fs.readdirSync(this.ticketsDir)
    const tickets: Ticket[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(this.ticketsDir, file)
      const ticket: Ticket = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      tickets.push(ticket)
    }

    // Apply filters (AND condition)
    let filtered = tickets
    if (filter) {
      if (filter.status !== undefined) {
        filtered = filtered.filter((t) => t.status === filter.status)
      }
      if (filter.assignee !== undefined) {
        filtered = filtered.filter((t) => t.assignee === filter.assignee)
      }
      if (filter.type !== undefined) {
        filtered = filtered.filter((t) => t.type === filter.type)
      }
    }

    // Sort by priority (urgent > high > normal > low), then by createdAt ascending
    filtered.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.createdAt.localeCompare(b.createdAt)
    })

    return filtered
  }

  async update(id: string, input: UpdateTicketInput): Promise<Ticket> {
    const ticket = await this.get(id)
    if (!ticket) {
      throw new TicketNotFoundError(id)
    }

    if (ticket.version !== input.expectedVersion) {
      throw new OptimisticLockError()
    }

    const updated: Ticket = {
      ...ticket,
      ...(input.status !== undefined && { status: input.status }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
      ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
      ...(input.cancelledAt !== undefined && { cancelledAt: input.cancelledAt }),
      ...(input.result !== undefined && { result: input.result }),
      ...(input.ccReviewTicketIds !== undefined && { ccReviewTicketIds: input.ccReviewTicketIds }),
      version: ticket.version + 1,
    }

    fs.writeFileSync(this.ticketPath(id), JSON.stringify(updated, null, 2))
    return updated
  }

  async cancel(id: string, expectedVersion: number): Promise<Ticket> {
    const ticket = await this.get(id)
    if (!ticket) {
      throw new TicketNotFoundError(id)
    }

    // cancel은 blocked, ready 상태에서만 가능
    if (ticket.status !== 'blocked' && ticket.status !== 'ready') {
      throw new InvalidStatusTransitionError(ticket.status, 'cancelled')
    }

    if (ticket.version !== expectedVersion) {
      throw new OptimisticLockError()
    }

    const updated: Ticket = {
      ...ticket,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      version: ticket.version + 1,
    }

    fs.writeFileSync(this.ticketPath(id), JSON.stringify(updated, null, 2))
    return updated
  }

  async addComment(ticketId: string, input: CreateCommentInput): Promise<Comment> {
    const ticket = await this.get(ticketId)
    if (!ticket) {
      throw new TicketNotFoundError(ticketId)
    }

    const comment: Comment = {
      id: crypto.randomUUID(),
      author: input.author,
      content: input.content,
      createdAt: new Date().toISOString(),
    }

    const updated: Ticket = {
      ...ticket,
      comments: [...ticket.comments, comment],
      version: ticket.version + 1,
    }

    fs.writeFileSync(this.ticketPath(ticketId), JSON.stringify(updated, null, 2))
    return comment
  }

  async saveLog(ticketId: string, log: string): Promise<void> {
    const logDir = this.ticketLogDir(ticketId)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    fs.writeFileSync(this.ticketLogPath(ticketId), log)
  }

  async getLog(ticketId: string): Promise<string | null> {
    const logPath = this.ticketLogPath(ticketId)
    if (!fs.existsSync(logPath)) {
      return null
    }
    return fs.readFileSync(logPath, 'utf-8')
  }
}
