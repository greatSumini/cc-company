import { Router } from 'express'
import type { AgentState } from '@agentinc/core'

export const agentsRouter = Router()

/**
 * GET /agents
 * 에이전트 목록 조회 (agentStore 의존성 필요)
 */
agentsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.agentStore) {
      return res.status(501).json({ error: 'agentStore not configured' })
    }
    const agents = req.agentStore.listAgents()
    res.json(agents)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /agents/status
 */
agentsRouter.get('/status', async (req, res, next) => {
  try {
    const statuses = await req.agentStatusStore.getAll()
    res.json(statuses)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /agents/:name/status
 */
agentsRouter.get('/:name/status', async (req, res, next) => {
  try {
    const status = await req.agentStatusStore.get(req.params.name)
    if (!status) {
      return res.status(404).json({ error: 'Agent not found' })
    }
    res.json(status)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /agents/:name/heartbeat
 * Agent가 주기적으로 호출하여 alive 상태 유지
 */
agentsRouter.patch('/:name/heartbeat', async (req, res, next) => {
  try {
    await req.agentStatusStore.updateHeartbeat(req.params.name)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /agents/:name/state
 * Body: { state, currentTicketId? }
 */
agentsRouter.patch('/:name/state', async (req, res, next) => {
  try {
    const { state, currentTicketId } = req.body
    const validStates: AgentState[] = ['idle', 'working', 'offline']
    if (!state || !validStates.includes(state)) {
      return res.status(400).json({ error: 'Invalid or missing state' })
    }
    await req.agentStatusStore.updateState(req.params.name, state as AgentState, currentTicketId)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})
