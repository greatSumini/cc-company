import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { AgentStatusStore } from '../../src/store/agent-status-store'

describe('AgentStatusStore', () => {
  let testDir: string
  let store: AgentStatusStore

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-agent-status-test-'))
    store = new AgentStatusStore(testDir, 30000) // 30초 heartbeat timeout
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
    vi.useRealTimers()
  })

  describe('[기본 기능]', () => {
    it('updateHeartbeat() — lastHeartbeatAt 갱신', async () => {
      await store.updateHeartbeat('developer')

      const status = await store.get('developer')

      expect(status).not.toBeNull()
      expect(status?.name).toBe('developer')
      expect(status?.state).toBe('idle')
      expect(status?.lastHeartbeatAt).toBeDefined()
      expect(status?.processStartedAt).toBeDefined()
    })

    it('updateState() — state 변경 (idle → working)', async () => {
      // 먼저 idle 상태로 등록
      await store.updateHeartbeat('developer')

      // working 상태로 변경
      await store.updateState('developer', 'working', 'ticket-123')

      const status = await store.get('developer')

      expect(status?.state).toBe('working')
      expect(status?.currentTicketId).toBe('ticket-123')
    })

    it('updateState() — 새로운 agent 등록 시 processStartedAt 설정', async () => {
      await store.updateState('new-agent', 'idle')

      const status = await store.get('new-agent')

      expect(status?.name).toBe('new-agent')
      expect(status?.state).toBe('idle')
      expect(status?.processStartedAt).toBeDefined()
    })

    it('getAll() — 전체 agent 상태 반환', async () => {
      await store.updateState('developer', 'idle')
      await store.updateState('designer', 'working', 'ticket-456')
      await store.updateState('hr', 'idle')

      const all = await store.getAll()

      expect(Object.keys(all)).toHaveLength(3)
      expect(all['developer'].state).toBe('idle')
      expect(all['designer'].state).toBe('working')
      expect(all['designer'].currentTicketId).toBe('ticket-456')
      expect(all['hr'].state).toBe('idle')
    })

    it('get() 존재하는 agent — 정상 반환', async () => {
      await store.updateState('developer', 'working', 'ticket-789')

      const status = await store.get('developer')

      expect(status).not.toBeNull()
      expect(status?.name).toBe('developer')
      expect(status?.state).toBe('working')
      expect(status?.currentTicketId).toBe('ticket-789')
    })

    it('get() 존재하지 않는 agent — null 반환', async () => {
      const status = await store.get('nonexistent')
      expect(status).toBeNull()
    })

    it('remove() — agent 상태 제거', async () => {
      await store.updateState('developer', 'idle')
      expect(await store.get('developer')).not.toBeNull()

      await store.remove('developer')

      expect(await store.get('developer')).toBeNull()
    })
  })

  describe('[offline 판정]', () => {
    it('heartbeatTimeout 초과 시 state=offline', async () => {
      vi.useFakeTimers()
      const now = new Date('2026-03-22T10:00:00Z')
      vi.setSystemTime(now)

      // 짧은 timeout으로 store 생성
      const shortTimeoutStore = new AgentStatusStore(testDir, 1000) // 1초 timeout

      await shortTimeoutStore.updateState('developer', 'working', 'ticket-123')

      // 아직 timeout 전 - working 상태
      let status = await shortTimeoutStore.get('developer')
      expect(status?.state).toBe('working')

      // 2초 후 - timeout 초과
      vi.setSystemTime(new Date('2026-03-22T10:00:02Z'))

      status = await shortTimeoutStore.get('developer')
      expect(status?.state).toBe('offline')
    })

    it('getAll()에서도 offline 판정 적용', async () => {
      vi.useFakeTimers()
      const now = new Date('2026-03-22T10:00:00Z')
      vi.setSystemTime(now)

      const shortTimeoutStore = new AgentStatusStore(testDir, 1000)

      await shortTimeoutStore.updateState('developer', 'working')
      await shortTimeoutStore.updateState('designer', 'idle')

      // timeout 초과
      vi.setSystemTime(new Date('2026-03-22T10:00:02Z'))

      const all = await shortTimeoutStore.getAll()

      expect(all['developer'].state).toBe('offline')
      expect(all['designer'].state).toBe('offline')
    })

    it('heartbeat 갱신 후에는 offline이 아님', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-22T10:00:00Z'))

      const shortTimeoutStore = new AgentStatusStore(testDir, 1000)
      await shortTimeoutStore.updateState('developer', 'working')

      // 0.5초 후 heartbeat 갱신
      vi.setSystemTime(new Date('2026-03-22T10:00:00.500Z'))
      await shortTimeoutStore.updateHeartbeat('developer')

      // 0.5초 후 (heartbeat로부터 0.5초) - 아직 timeout 전
      vi.setSystemTime(new Date('2026-03-22T10:00:01Z'))

      const status = await shortTimeoutStore.get('developer')
      expect(status?.state).toBe('working')
    })

    it('offline 판정은 파일을 수정하지 않음', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-22T10:00:00Z'))

      const shortTimeoutStore = new AgentStatusStore(testDir, 1000)
      await shortTimeoutStore.updateState('developer', 'working')

      // timeout 초과
      vi.setSystemTime(new Date('2026-03-22T10:00:02Z'))

      // get()으로 offline 상태 확인
      const status = await shortTimeoutStore.get('developer')
      expect(status?.state).toBe('offline')

      // 파일을 직접 읽어서 원본 state 확인
      const statusPath = path.join(testDir, '.agentinc', 'status', 'agents.json')
      const raw = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
      expect(raw['developer'].state).toBe('working') // 파일에는 원본 상태 유지
    })
  })

  describe('[파일 저장]', () => {
    it('상태 파일이 올바른 경로에 생성됨', async () => {
      await store.updateState('developer', 'idle')

      const statusPath = path.join(testDir, '.agentinc', 'status', 'agents.json')
      expect(fs.existsSync(statusPath)).toBe(true)

      const content = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
      expect(content['developer']).toBeDefined()
      expect(content['developer'].state).toBe('idle')
    })

    it('여러 agent 상태가 하나의 파일에 저장됨', async () => {
      await store.updateState('developer', 'idle')
      await store.updateState('designer', 'working', 'ticket-1')
      await store.updateState('hr', 'idle')

      const statusPath = path.join(testDir, '.agentinc', 'status', 'agents.json')
      const content = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))

      expect(Object.keys(content)).toHaveLength(3)
      expect(content['developer'].state).toBe('idle')
      expect(content['designer'].state).toBe('working')
      expect(content['hr'].state).toBe('idle')
    })
  })
})
