# Daemon Mode

비동기 ticket 기반 작업 처리 시스템.

## Overview

`agent-inc start`로 데몬 모드를 시작하면:
1. **Ticket Server** — HTTP API로 ticket CRUD 제공
2. **Agent Workers** — 각 agent별로 worker 프로세스 spawn, ticket polling

```
┌─────────────────────────────────────────────────────────────┐
│                     Ticket Server (:3847)                   │
│  POST /tickets    GET /tickets    PATCH /tickets/:id        │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
         │ polling            │ polling            │ polling
    ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
    │developer│          │designer │          │   hr    │
    │ worker  │          │ worker  │          │ worker  │
    └─────────┘          └─────────┘          └─────────┘
```

## Start

```bash
agent-inc start
```

- 모든 등록된 agent의 worker가 자동 spawn
- 3분간 작업 없으면 해당 worker 자동 종료
- 서버는 `Ctrl+C`로 종료

## Ticket Lifecycle

```
blocked → ready → in_progress → completed
                             ↘ failed
```

- `blocked` — CC(참조) 완료 대기 중
- `ready` — 처리 가능
- `in_progress` — 작업 중
- `completed` / `failed` — 종료

## Create Ticket

```bash
agent-inc ticket create \
  --assignee developer \
  --title "Fix login bug" \
  --prompt "로그인 버튼이 작동하지 않는 문제를 수정해주세요."
```

### CC (참조)

다른 agent의 의견을 먼저 받고 싶을 때:

```bash
agent-inc ticket create \
  --assignee developer \
  --cc designer,hr \
  --title "New feature review" \
  --prompt "새 기능 설계를 검토해주세요."
```

- 원본 ticket은 `blocked` 상태로 생성
- CC된 agent마다 `cc_review` ticket 생성
- 모든 CC 완료 시 원본 ticket이 `ready`로 전환

## Configuration

`.agentinc/config.json`:

```json
{
  "ticketServer": {
    "port": 3847,
    "pollingIntervalMs": 5000,
    "idleTimeoutMs": 180000,
    "heartbeatTimeoutMs": 30000
  }
}
```

| Option | Default | Description |
|---|---|---|
| `port` | 3847 | 서버 포트 |
| `pollingIntervalMs` | 5000 | worker polling 간격 |
| `idleTimeoutMs` | 180000 | 3분 idle 시 worker 종료 |
| `heartbeatTimeoutMs` | 30000 | heartbeat 타임아웃 |
