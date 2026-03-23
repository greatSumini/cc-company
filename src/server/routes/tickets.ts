import { Router } from 'express'
import { TicketStatus } from '../../types/index.js'

export const ticketsRouter = Router()

/**
 * GET /tickets
 * Query params: status, assignee, type
 */
ticketsRouter.get('/', async (req, res, next) => {
  try {
    const filter = {
      status: req.query.status as TicketStatus | undefined,
      assignee: req.query.assignee as string | undefined,
      type: req.query.type as 'task' | 'cc_review' | undefined,
    }
    const tickets = await req.ticketService.listTickets(filter)
    res.json(tickets)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /tickets/:id
 */
ticketsRouter.get('/:id', async (req, res, next) => {
  try {
    const ticket = await req.ticketService.getTicket(req.params.id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }
    res.json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /tickets
 * Body: { title, prompt, assignee, cc?, priority?, createdBy }
 */
ticketsRouter.post('/', async (req, res, next) => {
  try {
    const { title, prompt, assignee, cc, priority, createdBy } = req.body

    if (!title || !prompt || !assignee) {
      return res.status(400).json({ error: 'title, prompt, and assignee are required' })
    }

    const ticket = await req.ticketService.createTicket({
      title,
      prompt,
      assignee,
      cc,
      priority,
      createdBy: createdBy ?? 'user',
    })
    res.status(201).json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /tickets/:id
 * Body: { status?, priority?, expectedVersion, result? }
 */
ticketsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { status, priority, expectedVersion, result } = req.body

    if (expectedVersion === undefined) {
      return res.status(400).json({ error: 'expectedVersion is required' })
    }

    let ticket
    if (status) {
      ticket = await req.ticketService.updateTicketStatus(
        req.params.id,
        status,
        expectedVersion,
        result
      )
    } else if (priority) {
      ticket = await req.ticketService.updateTicketPriority(
        req.params.id,
        priority,
        expectedVersion
      )
    } else {
      return res.status(400).json({ error: 'status or priority is required' })
    }

    res.json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /tickets/:id
 * Body: { expectedVersion }
 */
ticketsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { expectedVersion } = req.body

    if (expectedVersion === undefined) {
      return res.status(400).json({ error: 'expectedVersion is required' })
    }

    const ticket = await req.ticketService.cancelTicket(req.params.id, expectedVersion)
    res.json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /tickets/:id/log
 */
ticketsRouter.get('/:id/log', async (req, res, next) => {
  try {
    const log = await req.ticketService.getLog(req.params.id)
    if (log === null) {
      return res.status(404).json({ error: 'Log not found' })
    }
    res.type('text/plain').send(log)
  } catch (error) {
    next(error)
  }
})

/**
 * PUT /tickets/:id/log
 * Body: plain text
 */
ticketsRouter.put('/:id/log', async (req, res, next) => {
  try {
    // express.text() middleware가 없으므로 raw body를 수동으로 수집
    let body = ''
    req.setEncoding('utf-8')
    for await (const chunk of req) {
      body += chunk
    }
    await req.ticketService.saveLog(req.params.id, body)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /tickets/:id/comments
 * Body: { author, content }
 */
ticketsRouter.post('/:id/comments', async (req, res, next) => {
  try {
    const { author, content } = req.body

    if (!author || !content) {
      return res.status(400).json({ error: 'author and content are required' })
    }

    const comment = await req.ticketService.addComment(req.params.id, { author, content })
    res.status(201).json(comment)
  } catch (error) {
    next(error)
  }
})
