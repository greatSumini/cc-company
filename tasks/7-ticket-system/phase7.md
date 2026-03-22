# Phase 7: ticket-commands

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/7-ticket-system/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (Phase 1)
- `/src/server/routes/tickets.ts` (Phase 4)
- `/src/services/orchestrator.service.ts` (Phase 6)
- `/src/commands/start.ts` (Phase 6)

기존 command 패턴을 참고하라:

- `/src/commands/agent.ts`
- `/src/commands/skill.ts`

## 작업 내용

Ticket 관리 CLI commands를 구현한다.

### 1. `src/commands/ticket.ts`

```typescript
import { Command } from 'commander'
import { loadTicketServerConfig } from '../services/orchestrator.service'
import { createContext } from './context'
import { TicketPriority } from '../types'

export function registerTicketCommand(program: Command): void {
  const ticket = program
    .command('ticket')
    .description('Manage tickets')

  // cc-company ticket create
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
          const error = await res.json()
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
          console.error('Error: Ticket Server is not running. Run `cc-company start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })

  // cc-company ticket list
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
          const error = await res.json()
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
          console.error('Error: Ticket Server is not running. Run `cc-company start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })

  // cc-company ticket show <id>
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
          console.error('Error: Ticket Server is not running. Run `cc-company start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })

  // cc-company ticket cancel <id>
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
          const error = await res.json()
          console.error(`Error: ${error.error}`)
          process.exit(1)
        }

        const cancelled = await res.json()
        console.log(`Ticket cancelled: ${cancelled.id}`)
        console.log(`  Status: ${cancelled.status}`)
        console.log(`  Cancelled At: ${cancelled.cancelledAt}`)
      } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED') {
          console.error('Error: Ticket Server is not running. Run `cc-company start` first.')
        } else {
          console.error(`Error: ${error.message}`)
        }
        process.exit(1)
      }
    })
}
```

### 2. `src/index.ts` — Command 등록

기존 command 등록 부분에 `ticket` command를 추가:

```typescript
import { registerTicketCommand } from './commands/ticket'

// ... 기존 코드 ...

registerTicketCommand(program)
```

### 3. 사용 예시

```bash
# Ticket Server 시작 (별도 터미널)
cc-company start

# Ticket 생성
cc-company ticket create \
  --assignee developer \
  --title "버그 수정" \
  --prompt "로그인 버튼이 동작하지 않는 버그를 수정해주세요."

# CC가 있는 Ticket 생성
cc-company ticket create \
  --assignee developer \
  --cc designer,hr \
  --title "새 기능 구현" \
  --prompt "결제 모듈을 구현해주세요." \
  --priority high

# Ticket 목록 조회
cc-company ticket list
cc-company ticket list --status ready
cc-company ticket list --assignee developer

# Ticket 상세 조회
cc-company ticket show abc-123

# Ticket 취소
cc-company ticket cancel abc-123
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 7 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 서버가 실행 중이지 않을 때 친절한 에러 메시지를 출력하라 (`ECONNREFUSED` 처리).
- `cancel` 시 낙관적 락을 위해 먼저 ticket을 조회하여 version을 얻어야 한다.
- `--cc` 옵션은 쉼표로 구분된 문자열을 배열로 파싱해야 한다.
- HTTP 요청 에러를 적절히 처리하고 사용자에게 의미 있는 메시지를 출력하라.
