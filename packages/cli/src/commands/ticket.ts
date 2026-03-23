import { Command } from 'commander'
import type { TicketPriority } from '@agentinc/core'
import { loadTicketServerConfig } from '../services/orchestrator.service.js'
import { createContext } from './context.js'

export function registerTicketCommand(program: Command): void {
  const ticket = program
    .command('ticket')
    .description('Manage tickets')

  // agentinc ticket create
  ticket
    .command('create')
    .description('Create a new ticket')
    .requiredOption('--assignee <agent>', 'Agent to assign the ticket to')
    .requiredOption('--title <title>', 'Ticket title')
    .requiredOption('--prompt <prompt>', 'Ticket prompt (task description)')
    .option('--cc <agents>', 'Comma-separated list of agents to CC')
    .option('--priority <priority>', 'Priority: low, normal, high, urgent', 'normal')
    .action(async (options) => {
      const ctx = createContext()
      const config = loadTicketServerConfig(ctx.basePath)
      const serverUrl = `http://localhost:${config.port}`

      const cc = options.cc ? options.cc.split(',').map((s: string) => s.trim()) : undefined

      try {
        const res = await fetch(`${serverUrl}/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: options.title,
            prompt: options.prompt,
            assignee: options.assignee,
            cc,
            priority: options.priority as TicketPriority,
            createdBy: 'user',
          }),
        })

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: res.statusText }))
          console.error(`Error: ${error.error}`)
          process.exit(1)
        }

        const ticket = await res.json()
        console.log(`Ticket created: ${ticket.id}`)
        console.log(`  Title: ${ticket.title}`)
        console.log(`  Assignee: ${ticket.assignee}`)
        console.log(`  Status: ${ticket.status}`)
        console.log(`  Priority: ${ticket.priority}`)

        if (ticket.ccReviewTicketIds && ticket.ccReviewTicketIds.length > 0) {
          console.log(`  CC Review Tickets: ${ticket.ccReviewTicketIds.length}`)
        }
      } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED') {
          console.error('Error: Ticket Server is not running. Run `agentinc start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })

  // agentinc ticket list
  ticket
    .command('list')
    .description('List tickets')
    .option('--status <status>', 'Filter by status')
    .option('--assignee <agent>', 'Filter by assignee')
    .option('--type <type>', 'Filter by type: task, cc_review')
    .action(async (options) => {
      const ctx = createContext()
      const config = loadTicketServerConfig(ctx.basePath)
      const serverUrl = `http://localhost:${config.port}`

      const params = new URLSearchParams()
      if (options.status) params.set('status', options.status)
      if (options.assignee) params.set('assignee', options.assignee)
      if (options.type) params.set('type', options.type)

      try {
        const res = await fetch(`${serverUrl}/tickets?${params}`)

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: res.statusText }))
          console.error(`Error: ${error.error}`)
          process.exit(1)
        }

        const tickets = await res.json()

        if (tickets.length === 0) {
          console.log('No tickets found.')
          return
        }

        console.log(`Found ${tickets.length} ticket(s):\n`)

        for (const t of tickets) {
          const typeLabel = t.type === 'cc_review' ? '[CC]' : ''
          console.log(`${t.id} ${typeLabel}`)
          console.log(`  Title: ${t.title}`)
          console.log(`  Assignee: ${t.assignee}`)
          console.log(`  Status: ${t.status}`)
          console.log(`  Priority: ${t.priority}`)
          console.log(`  Created: ${t.createdAt}`)
          console.log()
        }
      } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED') {
          console.error('Error: Ticket Server is not running. Run `agentinc start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })

  // agentinc ticket show <id>
  ticket
    .command('show <id>')
    .description('Show ticket details')
    .action(async (id) => {
      const ctx = createContext()
      const config = loadTicketServerConfig(ctx.basePath)
      const serverUrl = `http://localhost:${config.port}`

      try {
        const res = await fetch(`${serverUrl}/tickets/${id}`)

        if (!res.ok) {
          if (res.status === 404) {
            console.error(`Error: Ticket '${id}' not found.`)
          } else {
            const error = await res.json()
            console.error(`Error: ${error.error}`)
          }
          process.exit(1)
        }

        const t = await res.json()

        console.log(`Ticket: ${t.id}`)
        console.log(`  Type: ${t.type}`)
        console.log(`  Title: ${t.title}`)
        console.log(`  Assignee: ${t.assignee}`)
        console.log(`  Status: ${t.status}`)
        console.log(`  Priority: ${t.priority}`)
        console.log(`  Created By: ${t.createdBy}`)
        console.log(`  Created At: ${t.createdAt}`)

        if (t.startedAt) console.log(`  Started At: ${t.startedAt}`)
        if (t.completedAt) console.log(`  Completed At: ${t.completedAt}`)
        if (t.cancelledAt) console.log(`  Cancelled At: ${t.cancelledAt}`)

        if (t.parentTicketId) {
          console.log(`  Parent Ticket: ${t.parentTicketId}`)
        }

        if (t.ccReviewTicketIds && t.ccReviewTicketIds.length > 0) {
          console.log(`  CC Review Tickets: ${t.ccReviewTicketIds.join(', ')}`)
        }

        if (t.result) {
          console.log(`  Exit Code: ${t.result.exitCode}`)
          console.log(`  Log Path: ${t.result.logPath}`)
        }

        if (t.comments && t.comments.length > 0) {
          console.log(`\nComments (${t.comments.length}):`)
          for (const c of t.comments) {
            console.log(`  [${c.createdAt}] ${c.author}: ${c.content}`)
          }
        }

        console.log(`\nPrompt:`)
        console.log(t.prompt || '(no prompt - cc_review ticket)')
      } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED') {
          console.error('Error: Ticket Server is not running. Run `agentinc start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })

  // agentinc ticket cancel <id>
  ticket
    .command('cancel <id>')
    .description('Cancel a ticket')
    .action(async (id) => {
      const ctx = createContext()
      const config = loadTicketServerConfig(ctx.basePath)
      const serverUrl = `http://localhost:${config.port}`

      try {
        // 먼저 ticket 조회하여 version 확인
        const getRes = await fetch(`${serverUrl}/tickets/${id}`)

        if (!getRes.ok) {
          if (getRes.status === 404) {
            console.error(`Error: Ticket '${id}' not found.`)
          } else {
            const error = await getRes.json()
            console.error(`Error: ${error.error}`)
          }
          process.exit(1)
        }

        const ticket = await getRes.json()

        // 취소 요청
        const res = await fetch(`${serverUrl}/tickets/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedVersion: ticket.version }),
        })

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: res.statusText }))
          console.error(`Error: ${error.error}`)
          process.exit(1)
        }

        const cancelled = await res.json()
        console.log(`Ticket cancelled: ${cancelled.id}`)
        console.log(`  Status: ${cancelled.status}`)
        console.log(`  Cancelled At: ${cancelled.cancelledAt}`)
      } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED') {
          console.error('Error: Ticket Server is not running. Run `agentinc start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })
}
