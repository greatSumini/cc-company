import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FsTicketStore } from '../../src/store/fs-ticket-store'
import {
  OptimisticLockError,
  TicketNotFoundError,
  InvalidStatusTransitionError,
} from '../../src/store/ticket-store'
import type { Ticket } from '../../src/types'

describe('FsTicketStore', () => {
  let testDir: string
  let store: FsTicketStore

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ticket-test-'))
    store = new FsTicketStore(testDir)
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  describe('[CRUD 기본]', () => {
    it('create() 기본 — ticket 생성 후 파일 존재, 필수 필드 확인', async () => {
      const ticket = await store.create({
        title: '버그 수정',
        prompt: '로그인 버그를 수정해주세요.',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      // 파일 존재 확인
      const ticketPath = path.join(testDir, '.agentinc', 'tickets', `${ticket.id}.json`)
      expect(fs.existsSync(ticketPath)).toBe(true)

      // 필수 필드 확인
      expect(ticket.title).toBe('버그 수정')
      expect(ticket.prompt).toBe('로그인 버그를 수정해주세요.')
      expect(ticket.type).toBe('task')
      expect(ticket.assignee).toBe('developer')
      expect(ticket.priority).toBe('normal')
      expect(ticket.status).toBe('ready')
      expect(ticket.createdBy).toBe('user')
      expect(ticket.version).toBe(1)
      expect(ticket.comments).toEqual([])
      expect(ticket.createdAt).toBeDefined()
    })

    it('create() ID 자동 생성 — uuid 형식 검증', async () => {
      const ticket = await store.create({
        title: 'Test',
        prompt: 'Test prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      // UUID 형식 검증 (8-4-4-4-12)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(ticket.id).toMatch(uuidRegex)
    })

    it('get() 존재하는 ticket — 정상 반환', async () => {
      const created = await store.create({
        title: '테스트',
        prompt: '테스트 프롬프트',
        type: 'task',
        assignee: 'developer',
        priority: 'high',
        status: 'ready',
        createdBy: 'user',
      })

      const fetched = await store.get(created.id)

      expect(fetched).not.toBeNull()
      expect(fetched?.id).toBe(created.id)
      expect(fetched?.title).toBe('테스트')
      expect(fetched?.priority).toBe('high')
    })

    it('get() 존재하지 않는 ticket — null 반환', async () => {
      const result = await store.get('nonexistent-id')
      expect(result).toBeNull()
    })

    it('list() 필터 없음 — 전체 목록 반환', async () => {
      await store.create({
        title: 'Ticket 1',
        prompt: 'Prompt 1',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'Ticket 2',
        prompt: 'Prompt 2',
        type: 'cc_review',
        assignee: 'designer',
        priority: 'high',
        status: 'blocked',
        createdBy: 'developer',
      })

      const tickets = await store.list()

      expect(tickets).toHaveLength(2)
    })

    it('list() status 필터 — 해당 status만 반환', async () => {
      await store.create({
        title: 'Ready Ticket',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'Blocked Ticket',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'blocked',
        createdBy: 'user',
      })

      const readyTickets = await store.list({ status: 'ready' })

      expect(readyTickets).toHaveLength(1)
      expect(readyTickets[0].title).toBe('Ready Ticket')
    })

    it('list() assignee 필터 — 해당 assignee만 반환', async () => {
      await store.create({
        title: 'Developer Ticket',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'Designer Ticket',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'designer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      const developerTickets = await store.list({ assignee: 'developer' })

      expect(developerTickets).toHaveLength(1)
      expect(developerTickets[0].title).toBe('Developer Ticket')
    })

    it('list() 복합 필터 — status + assignee 동시 적용', async () => {
      await store.create({
        title: 'Developer Ready',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'Developer Blocked',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'blocked',
        createdBy: 'user',
      })
      await store.create({
        title: 'Designer Ready',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'designer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      const filtered = await store.list({ status: 'ready', assignee: 'developer' })

      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Developer Ready')
    })

    it('list() type 필터 — 해당 type만 반환', async () => {
      await store.create({
        title: 'Task Ticket',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'CC Review Ticket',
        prompt: 'Prompt',
        type: 'cc_review',
        assignee: 'designer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'developer',
      })

      const ccReviewTickets = await store.list({ type: 'cc_review' })

      expect(ccReviewTickets).toHaveLength(1)
      expect(ccReviewTickets[0].title).toBe('CC Review Ticket')
    })

    it('list() 정렬 — priority 순 (urgent > high > normal > low), 같으면 createdAt 오름차순', async () => {
      // 순서를 섞어서 생성
      await store.create({
        title: 'Low Priority',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'low',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'Urgent Priority',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'urgent',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'Normal Priority',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })
      await store.create({
        title: 'High Priority',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'high',
        status: 'ready',
        createdBy: 'user',
      })

      const tickets = await store.list()

      expect(tickets[0].title).toBe('Urgent Priority')
      expect(tickets[1].title).toBe('High Priority')
      expect(tickets[2].title).toBe('Normal Priority')
      expect(tickets[3].title).toBe('Low Priority')
    })
  })

  describe('[update 및 낙관적 락]', () => {
    it('update() 정상 — 필드 업데이트, version 증가', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      const updated = await store.update(created.id, {
        status: 'in_progress',
        startedAt: '2026-03-22T10:00:00Z',
        expectedVersion: 1,
      })

      expect(updated.status).toBe('in_progress')
      expect(updated.startedAt).toBe('2026-03-22T10:00:00Z')
      expect(updated.version).toBe(2)
    })

    it('update() 낙관적 락 실패 — version 불일치 시 에러', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      // 첫 번째 업데이트
      await store.update(created.id, {
        status: 'in_progress',
        expectedVersion: 1,
      })

      // 두 번째 업데이트 - 잘못된 버전으로 시도
      await expect(
        store.update(created.id, {
          status: 'completed',
          expectedVersion: 1, // 이미 2로 증가됨
        })
      ).rejects.toThrow(OptimisticLockError)
    })

    it('update() 존재하지 않는 ticket — TicketNotFoundError', async () => {
      await expect(
        store.update('nonexistent', {
          status: 'completed',
          expectedVersion: 1,
        })
      ).rejects.toThrow(TicketNotFoundError)
    })
  })

  describe('[cancel]', () => {
    it('cancel() blocked 상태 — 정상 취소, cancelledAt 기록', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'blocked',
        createdBy: 'user',
      })

      const cancelled = await store.cancel(created.id, 1)

      expect(cancelled.status).toBe('cancelled')
      expect(cancelled.cancelledAt).toBeDefined()
      expect(cancelled.version).toBe(2)
    })

    it('cancel() ready 상태 — 정상 취소', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      const cancelled = await store.cancel(created.id, 1)

      expect(cancelled.status).toBe('cancelled')
    })

    it('cancel() in_progress 상태 — 에러 (취소 불가)', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      // in_progress로 변경
      await store.update(created.id, {
        status: 'in_progress',
        expectedVersion: 1,
      })

      await expect(store.cancel(created.id, 2)).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('cancel() completed 상태 — 에러 (취소 불가)', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      // completed로 변경
      await store.update(created.id, {
        status: 'completed',
        expectedVersion: 1,
      })

      await expect(store.cancel(created.id, 2)).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('cancel() 낙관적 락 실패 — version 불일치 시 에러', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      await expect(store.cancel(created.id, 99)).rejects.toThrow(OptimisticLockError)
    })
  })

  describe('[comments 및 log]', () => {
    it('addComment() — comments 배열에 추가', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      const comment = await store.addComment(created.id, {
        author: 'reviewer',
        content: '이 부분 수정이 필요합니다.',
      })

      expect(comment.id).toBeDefined()
      expect(comment.author).toBe('reviewer')
      expect(comment.content).toBe('이 부분 수정이 필요합니다.')
      expect(comment.createdAt).toBeDefined()

      // ticket에 comment가 추가되었는지 확인
      const ticket = await store.get(created.id)
      expect(ticket?.comments).toHaveLength(1)
      expect(ticket?.comments[0].content).toBe('이 부분 수정이 필요합니다.')
      expect(ticket?.version).toBe(2)
    })

    it('addComment() 존재하지 않는 ticket — TicketNotFoundError', async () => {
      await expect(
        store.addComment('nonexistent', {
          author: 'reviewer',
          content: 'comment',
        })
      ).rejects.toThrow(TicketNotFoundError)
    })

    it('saveLog() / getLog() — 로그 파일 저장/조회', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      const logContent = 'Execution log content...\nLine 2\nLine 3'
      await store.saveLog(created.id, logContent)

      const retrievedLog = await store.getLog(created.id)
      expect(retrievedLog).toBe(logContent)

      // 로그 파일 존재 확인
      const logPath = path.join(testDir, '.agentinc', 'tickets', created.id, 'execution.log')
      expect(fs.existsSync(logPath)).toBe(true)
    })

    it('getLog() 존재하지 않는 로그 — null 반환', async () => {
      const created = await store.create({
        title: 'Test',
        prompt: 'Prompt',
        type: 'task',
        assignee: 'developer',
        priority: 'normal',
        status: 'ready',
        createdBy: 'user',
      })

      const log = await store.getLog(created.id)
      expect(log).toBeNull()
    })
  })
})
