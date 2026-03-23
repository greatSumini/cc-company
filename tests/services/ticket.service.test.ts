import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { TicketService } from '../../src/services/ticket.service'
import { FsTicketStore } from '../../src/store/fs-ticket-store'
import { FsStore } from '../../src/store/fs-store'
import { DelegationPermissionError, InvalidStatusTransitionError } from '../../src/store/ticket-store'

describe('TicketService', () => {
  let testDir: string
  let ticketStore: FsTicketStore
  let agentStore: FsStore
  let service: TicketService

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ticket-svc-test-'))

    // .cc-company 디렉토리 구조 생성 (FsStore는 .cc-company 없이 동작)
    const ccCompanyDir = path.join(testDir, '.cc-company')
    fs.mkdirSync(ccCompanyDir, { recursive: true })

    // FsTicketStore는 basePath를 받아 .cc-company/tickets/에 저장
    ticketStore = new FsTicketStore(testDir)

    // FsStore는 rootPath를 받아 agents/ 등에 접근
    // .cc-company 내부 구조 생성
    fs.mkdirSync(path.join(ccCompanyDir, 'agents'), { recursive: true })
    fs.writeFileSync(
      path.join(ccCompanyDir, 'config.json'),
      JSON.stringify({ version: '1.0.0' })
    )
    agentStore = new FsStore(ccCompanyDir)

    service = new TicketService(ticketStore, agentStore)

    // 테스트용 agent 생성
    fs.mkdirSync(path.join(ccCompanyDir, 'agents', 'developer'), { recursive: true })
    fs.writeFileSync(
      path.join(ccCompanyDir, 'agents', 'developer', 'agent.json'),
      JSON.stringify({ name: 'developer', description: 'test', can_delegate: true })
    )
    fs.writeFileSync(path.join(ccCompanyDir, 'agents', 'developer', 'prompt.md'), '')

    fs.mkdirSync(path.join(ccCompanyDir, 'agents', 'designer'), { recursive: true })
    fs.writeFileSync(
      path.join(ccCompanyDir, 'agents', 'designer', 'agent.json'),
      JSON.stringify({ name: 'designer', description: 'test', can_delegate: false })
    )
    fs.writeFileSync(path.join(ccCompanyDir, 'agents', 'designer', 'prompt.md'), '')

    fs.mkdirSync(path.join(ccCompanyDir, 'agents', 'hr'), { recursive: true })
    fs.writeFileSync(
      path.join(ccCompanyDir, 'agents', 'hr', 'agent.json'),
      JSON.stringify({ name: 'hr', description: 'test', can_delegate: false })
    )
    fs.writeFileSync(path.join(ccCompanyDir, 'agents', 'hr', 'prompt.md'), '')
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  describe('[createTicket]', () => {
    it('cc 없음 — task ticket 생성, status=ready', async () => {
      const ticket = await service.createTicket({
        title: 'Test Ticket',
        prompt: 'Please fix the bug',
        assignee: 'developer',
        createdBy: 'user',
      })

      expect(ticket.type).toBe('task')
      expect(ticket.status).toBe('ready')
      expect(ticket.title).toBe('Test Ticket')
      expect(ticket.prompt).toBe('Please fix the bug')
      expect(ticket.assignee).toBe('developer')
      expect(ticket.createdBy).toBe('user')
      expect(ticket.ccReviewTicketIds).toEqual([])
    })

    it('cc 있음 — task(blocked) + cc_review(ready) 생성', async () => {
      const ticket = await service.createTicket({
        title: 'Feature Request',
        prompt: 'Add a new feature',
        assignee: 'developer',
        cc: ['designer'],
        createdBy: 'user',
      })

      expect(ticket.type).toBe('task')
      expect(ticket.status).toBe('blocked')
      expect(ticket.ccReviewTicketIds).toHaveLength(1)

      // cc_review ticket 확인
      const ccReviewId = ticket.ccReviewTicketIds![0]
      const ccReview = await service.getTicket(ccReviewId)
      expect(ccReview).not.toBeNull()
      expect(ccReview!.type).toBe('cc_review')
      expect(ccReview!.status).toBe('ready')
      expect(ccReview!.assignee).toBe('designer')
      expect(ccReview!.parentTicketId).toBe(ticket.id)
      expect(ccReview!.title).toBe('[CC Review] Feature Request')
    })

    it('cc_review priority — parent priority와 동일', async () => {
      const ticket = await service.createTicket({
        title: 'Urgent Task',
        prompt: 'Fix immediately',
        assignee: 'developer',
        cc: ['designer'],
        priority: 'urgent',
        createdBy: 'user',
      })

      expect(ticket.priority).toBe('urgent')

      const ccReviewId = ticket.ccReviewTicketIds![0]
      const ccReview = await service.getTicket(ccReviewId)
      expect(ccReview!.priority).toBe('urgent')
    })

    it('위임 (agent → agent) — can_delegate=true 확인', async () => {
      // developer는 can_delegate: true
      const ticket = await service.createTicket({
        title: 'Delegated Task',
        prompt: 'Do this',
        assignee: 'designer',
        createdBy: 'developer', // agent name
      })

      expect(ticket.assignee).toBe('designer')
      expect(ticket.createdBy).toBe('developer')
    })

    it('위임 권한 없음 — can_delegate=false 시 에러', async () => {
      // designer는 can_delegate: false
      await expect(
        service.createTicket({
          title: 'Delegated Task',
          prompt: 'Do this',
          assignee: 'developer',
          createdBy: 'designer', // agent without delegation permission
        })
      ).rejects.toThrow(DelegationPermissionError)
    })
  })

  describe('[priority 및 cancel]', () => {
    it('updatePriority() task — 연결된 cc_review도 함께 변경', async () => {
      const ticket = await service.createTicket({
        title: 'Task with CC',
        prompt: 'Do something',
        assignee: 'developer',
        cc: ['designer'],
        priority: 'normal',
        createdBy: 'user',
      })

      // 최신 ticket 조회하여 현재 version 확인
      const latestTicket = await service.getTicket(ticket.id)

      // priority 업데이트
      await service.updateTicketPriority(ticket.id, 'high', latestTicket!.version)

      // task ticket priority 확인
      const updatedTicket = await service.getTicket(ticket.id)
      expect(updatedTicket!.priority).toBe('high')

      // cc_review ticket priority 확인
      const ccReview = await service.getTicket(ticket.ccReviewTicketIds![0])
      expect(ccReview!.priority).toBe('high')
    })

    it('cancelTicket() task with cc_review — 연결된 cc_review도 함께 취소', async () => {
      const ticket = await service.createTicket({
        title: 'Task to Cancel',
        prompt: 'This will be cancelled',
        assignee: 'developer',
        cc: ['designer'],
        createdBy: 'user',
      })

      // 최신 ticket 조회 (version 확인)
      const latestTicket = await service.getTicket(ticket.id)

      // cancel
      await service.cancelTicket(ticket.id, latestTicket!.version)

      // task ticket 취소 확인
      const cancelledTicket = await service.getTicket(ticket.id)
      expect(cancelledTicket!.status).toBe('cancelled')
      expect(cancelledTicket!.cancelledAt).toBeDefined()

      // cc_review ticket 취소 확인
      const ccReview = await service.getTicket(ticket.ccReviewTicketIds![0])
      expect(ccReview!.status).toBe('cancelled')
    })

    it('cancelTicket() task with in_progress cc_review — 에러', async () => {
      const ticket = await service.createTicket({
        title: 'Task with Active Review',
        prompt: 'This has an in_progress review',
        assignee: 'developer',
        cc: ['designer'],
        createdBy: 'user',
      })

      // cc_review를 in_progress로 변경
      const ccReviewId = ticket.ccReviewTicketIds![0]
      let ccReview = await service.getTicket(ccReviewId)
      await service.updateTicketStatus(ccReviewId, 'in_progress', ccReview!.version)

      // parent ticket cancel 시도 — 에러 예상
      const latestTicket = await service.getTicket(ticket.id)
      await expect(
        service.cancelTicket(ticket.id, latestTicket!.version)
      ).rejects.toThrow('Cannot cancel: cc_review')
    })
  })

  describe('[cc completion]', () => {
    it('checkCcCompletion() 일부 완료 — parent 상태 유지 (blocked)', async () => {
      // 2명의 cc가 있는 ticket 생성
      const ticket = await service.createTicket({
        title: 'Multi CC Task',
        prompt: 'Needs multiple reviews',
        assignee: 'developer',
        cc: ['designer', 'hr'],
        createdBy: 'user',
      })

      let ccReview1 = await service.getTicket(ticket.ccReviewTicketIds![0])

      // 첫 번째 cc_review만 완료 (ready → in_progress → completed)
      ccReview1 = await service.updateTicketStatus(ccReview1!.id, 'in_progress', ccReview1!.version)
      await service.updateTicketStatus(ccReview1.id, 'completed', ccReview1.version)

      // checkCcCompletion 호출
      const latestParent = await service.getTicket(ticket.id)
      await service.checkCcCompletion(latestParent!.id)

      // parent는 여전히 blocked
      const parentAfterCheck = await service.getTicket(ticket.id)
      expect(parentAfterCheck!.status).toBe('blocked')
    })

    it('checkCcCompletion() 전체 완료 — parent status → ready, comments 복사', async () => {
      const ticket = await service.createTicket({
        title: 'Review Task',
        prompt: 'Needs review',
        assignee: 'developer',
        cc: ['designer'],
        createdBy: 'user',
      })

      const ccReviewId = ticket.ccReviewTicketIds![0]
      let ccReview = await service.getTicket(ccReviewId)

      // cc_review에 comment 추가
      await service.addComment(ccReviewId, {
        author: 'designer',
        content: 'Looks good to me!',
      })

      // cc_review 완료 (ready → in_progress → completed)
      ccReview = await service.getTicket(ccReviewId)
      ccReview = await service.updateTicketStatus(ccReview!.id, 'in_progress', ccReview!.version)
      await service.updateTicketStatus(ccReview.id, 'completed', ccReview.version)

      // checkCcCompletion 호출
      await service.checkCcCompletion(ticket.id)

      // parent status → ready
      const parentAfterCheck = await service.getTicket(ticket.id)
      expect(parentAfterCheck!.status).toBe('ready')

      // parent에 comment가 복사되었는지 확인
      // addComment에서 이미 복사하므로, parent에도 comment가 있어야 함
      expect(parentAfterCheck!.comments.length).toBeGreaterThan(0)
      expect(parentAfterCheck!.comments.some((c) => c.content === 'Looks good to me!')).toBe(true)
    })

    it('addComment() cc_review — parent ticket에도 comment 복사', async () => {
      const ticket = await service.createTicket({
        title: 'Comment Test',
        prompt: 'Test comment copy',
        assignee: 'developer',
        cc: ['designer'],
        createdBy: 'user',
      })

      const ccReviewId = ticket.ccReviewTicketIds![0]

      // cc_review에 comment 추가
      await service.addComment(ccReviewId, {
        author: 'designer',
        content: 'Review comment',
      })

      // parent ticket에도 comment가 복사되었는지 확인
      const parent = await service.getTicket(ticket.id)
      expect(parent!.comments).toHaveLength(1)
      expect(parent!.comments[0].author).toBe('designer')
      expect(parent!.comments[0].content).toBe('Review comment')

      // cc_review에도 comment가 있는지 확인
      const ccReview = await service.getTicket(ccReviewId)
      expect(ccReview!.comments).toHaveLength(1)
    })
  })

  describe('[status updates]', () => {
    it('updateTicketStatus to in_progress — startedAt 자동 설정', async () => {
      const ticket = await service.createTicket({
        title: 'Status Test',
        prompt: 'Test status',
        assignee: 'developer',
        createdBy: 'user',
      })

      const updated = await service.updateTicketStatus(ticket.id, 'in_progress', ticket.version)

      expect(updated.status).toBe('in_progress')
      expect(updated.startedAt).toBeDefined()
    })

    it('updateTicketStatus to completed — completedAt 자동 설정', async () => {
      const ticket = await service.createTicket({
        title: 'Complete Test',
        prompt: 'Test completion',
        assignee: 'developer',
        createdBy: 'user',
      })

      // 먼저 in_progress로 변경
      let updated = await service.updateTicketStatus(ticket.id, 'in_progress', ticket.version)

      // completed로 변경
      updated = await service.updateTicketStatus(updated.id, 'completed', updated.version, {
        exitCode: 0,
        logPath: '/path/to/log',
      })

      expect(updated.status).toBe('completed')
      expect(updated.completedAt).toBeDefined()
      expect(updated.result).toEqual({ exitCode: 0, logPath: '/path/to/log' })
    })
  })

  describe('[status transition validation]', () => {
    it('blocked → in_progress 직접 전이 시 에러', async () => {
      const ticket = await service.createTicket({
        title: 'Blocked Ticket',
        prompt: 'Test',
        assignee: 'developer',
        cc: ['designer'],
        createdBy: 'user',
      })

      const latestTicket = await service.getTicket(ticket.id)

      await expect(
        service.updateTicketStatus(latestTicket!.id, 'in_progress', latestTicket!.version)
      ).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('completed → ready 전이 시 에러', async () => {
      const ticket = await service.createTicket({
        title: 'Test',
        prompt: 'Test',
        assignee: 'developer',
        createdBy: 'user',
      })

      let updated = await service.updateTicketStatus(ticket.id, 'in_progress', ticket.version)
      updated = await service.updateTicketStatus(updated.id, 'completed', updated.version)

      await expect(
        service.updateTicketStatus(updated.id, 'ready', updated.version)
      ).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('cancelled → in_progress 전이 시 에러', async () => {
      const ticket = await service.createTicket({
        title: 'Test',
        prompt: 'Test',
        assignee: 'developer',
        createdBy: 'user',
      })

      await service.cancelTicket(ticket.id, ticket.version)
      const cancelled = await service.getTicket(ticket.id)

      await expect(
        service.updateTicketStatus(cancelled!.id, 'in_progress', cancelled!.version)
      ).rejects.toThrow(InvalidStatusTransitionError)
    })
  })

  describe('[log operations]', () => {
    it('saveLog and getLog', async () => {
      const ticket = await service.createTicket({
        title: 'Log Test',
        prompt: 'Test log',
        assignee: 'developer',
        createdBy: 'user',
      })

      await service.saveLog(ticket.id, 'This is the execution log content')

      const log = await service.getLog(ticket.id)
      expect(log).toBe('This is the execution log content')
    })

    it('getLog for non-existent log — returns null', async () => {
      const ticket = await service.createTicket({
        title: 'No Log Test',
        prompt: 'Test',
        assignee: 'developer',
        createdBy: 'user',
      })

      const log = await service.getLog(ticket.id)
      expect(log).toBeNull()
    })
  })

  describe('[list operations]', () => {
    it('listTickets with filter', async () => {
      await service.createTicket({
        title: 'Task 1',
        prompt: 'Prompt 1',
        assignee: 'developer',
        createdBy: 'user',
      })

      await service.createTicket({
        title: 'Task 2',
        prompt: 'Prompt 2',
        assignee: 'designer',
        createdBy: 'user',
      })

      // 전체 목록
      const all = await service.listTickets()
      expect(all.length).toBe(2)

      // assignee 필터
      const developerTickets = await service.listTickets({ assignee: 'developer' })
      expect(developerTickets.length).toBe(1)
      expect(developerTickets[0].assignee).toBe('developer')

      // status 필터
      const readyTickets = await service.listTickets({ status: 'ready' })
      expect(readyTickets.length).toBe(2)
    })
  })
})
