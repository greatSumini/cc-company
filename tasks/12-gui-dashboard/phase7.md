# Phase 7: 통합 및 CLI 연동

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — 실행 모드 (개발/프로덕션)
- `/spec/adr.md` — ADR-022 (Monorepo), ADR-023 (GUI 프레임워크)
- `/tasks/12-gui-dashboard/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `packages/cli/src/commands/start.ts` — 기존 daemon 시작 로직
- `packages/server/src/index.ts` — Express 앱 엔트리
- `packages/web/` — 빌드된 정적 파일 위치 (dist/)
- 루트 `package.json` — 현재 스크립트

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. 빌드 스크립트 설정

#### 1.1 루트 `package.json` 수정

```json
{
  "name": "agentinc-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "build:web": "pnpm --filter @agentinc/web build && pnpm run copy:web",
    "copy:web": "rm -rf packages/server/public && cp -r packages/web/dist packages/server/public",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "clean": "pnpm -r clean",
    "prepublish:cli": "pnpm build && pnpm build:web"
  }
}
```

#### 1.2 `packages/server/public/` 디렉토리 설정

`.gitignore`에 추가 (빌드 산출물이므로):

```
# 루트 .gitignore에 추가
packages/server/public/
```

**또는** 빌드된 파일을 git에 포함하려면 `.gitkeep` 파일 생성:

```bash
mkdir -p packages/server/public
touch packages/server/public/.gitkeep
```

### 2. Server 정적 파일 서빙

#### 2.1 `packages/server/src/index.ts` 수정

```typescript
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import ticketsRouter from './routes/tickets.js'
import agentsRouter from './routes/agents.js'
import eventsRouter from './routes/events.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(express.json())

// API 라우트
app.use('/tickets', ticketsRouter)
app.use('/agents', agentsRouter)
app.use('/events', eventsRouter)

// 정적 파일 서빙 (프로덕션)
const publicPath = path.join(__dirname, '../public')
app.use(express.static(publicPath))

// SPA fallback — API 라우트가 아닌 모든 GET 요청을 index.html로
app.get('*', (req, res, next) => {
  // API 요청은 무시
  if (req.path.startsWith('/tickets') ||
      req.path.startsWith('/agents') ||
      req.path.startsWith('/events') ||
      req.path.startsWith('/webhooks')) {
    return next()
  }

  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) {
      // public/index.html이 없으면 (개발 모드) 404
      res.status(404).send('Dashboard not built. Run: pnpm build:web')
    }
  })
})

export { app }
export { eventBus } from './events/event-bus.js'

export interface ServerOptions {
  port?: number
  onReady?: () => void
}

export function createServer(options: ServerOptions = {}) {
  const port = options.port || 3847

  const server = app.listen(port, () => {
    options.onReady?.()
  })

  return server
}
```

### 3. CLI start 명령 수정

#### 3.1 `packages/cli/src/commands/start.ts` 수정

콘솔에 Dashboard URL을 출력하도록 수정:

```typescript
import { createServer } from '@agentinc/server'
// 기존 import 유지...

export function startCommand(program: Command) {
  program
    .command('start')
    .description('Start the daemon mode (ticket server + agent workers)')
    .option('-p, --port <port>', 'Server port', '3847')
    .action(async (options) => {
      const port = parseInt(options.port, 10)

      console.log('')
      console.log('🚀 Agent Inc Daemon Started')
      console.log('├─ Ticket API:  http://localhost:' + port)
      console.log('├─ Dashboard:   http://localhost:' + port)
      console.log('└─ Press Ctrl+C to stop')
      console.log('')

      // 서버 시작
      createServer({
        port,
        onReady: () => {
          // 기존 agent worker 시작 로직 유지
          startAgentWorkers()
        }
      })

      // 기존 로직 유지...
    })
}

// 기존 함수들 유지...
```

**주의**: 기존 `start.ts`의 로직 (orchestrator, agent workers 등)을 유지하면서 콘솔 출력만 추가하라. 서버 시작 로직이 이미 있다면 중복되지 않도록 통합하라.

### 4. 패키지 빌드 순서 설정

#### 4.1 `packages/cli/package.json` 수정

빌드 시 server와 web이 먼저 빌드되도록 의존성 확인:

```json
{
  "dependencies": {
    "@agentinc/core": "workspace:*",
    "@agentinc/server": "workspace:*"
  }
}
```

pnpm의 workspace 의존성으로 빌드 순서가 자동 결정됨:
1. `@agentinc/core` (의존성 없음)
2. `@agentinc/server` (core 의존)
3. `@agentinc/web` (core 의존, 타입만)
4. `@agentinc/cli` (core, server 의존)

### 5. npm 배포 설정 (CLI 패키지)

#### 5.1 `packages/cli/package.json` 확인

```json
{
  "name": "@agentinc/cli",
  "version": "0.2.0",
  "type": "module",
  "bin": {
    "agentinc": "./dist/index.js"
  },
  "files": [
    "dist"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

#### 5.2 루트에서 CLI만 배포하는 스크립트

루트 `package.json`에 추가:

```json
{
  "scripts": {
    "publish:cli": "pnpm prepublish:cli && pnpm --filter @agentinc/cli publish"
  }
}
```

**주의**: 실제 배포는 수동으로 진행. 자동 배포 스크립트는 이 task 범위 밖.

### 6. 개발 모드 편의 스크립트

#### 6.1 루트 `package.json`에 개발 스크립트 추가

```json
{
  "scripts": {
    "dev:server": "pnpm --filter @agentinc/cli dev & pnpm --filter @agentinc/server dev",
    "dev:web": "pnpm --filter @agentinc/web dev",
    "dev:all": "concurrently \"pnpm dev:server\" \"pnpm dev:web\""
  }
}
```

**선택사항**: `concurrently` 패키지 설치 (개발 편의):

```bash
pnpm add -D concurrently -w
```

### 7. 통합 테스트 스크립트

#### 7.1 `scripts/test-integration.sh` 생성 (선택사항)

```bash
#!/bin/bash
set -e

echo "Building all packages..."
pnpm build

echo "Building web for production..."
pnpm build:web

echo "Starting server in background..."
node packages/cli/dist/index.js start &
SERVER_PID=$!

sleep 3

echo "Testing API endpoint..."
curl -s http://localhost:3847/agents | head -c 100

echo ""
echo "Testing dashboard..."
curl -s http://localhost:3847/ | head -c 100

echo ""
echo "Stopping server..."
kill $SERVER_PID

echo ""
echo "Integration test passed!"
```

### 8. README 업데이트

#### 8.1 `/README.md` 또는 `/docs/` 문서에 GUI 사용법 추가

```markdown
## Dashboard (GUI)

`agentinc start` 명령 실행 시 웹 대시보드가 함께 시작됩니다.

\`\`\`bash
agentinc start

# 출력:
# 🚀 Agent Inc Daemon Started
# ├─ Ticket API:  http://localhost:3847
# ├─ Dashboard:   http://localhost:3847
# └─ Press Ctrl+C to stop
\`\`\`

브라우저에서 http://localhost:3847 로 접속하면 Kanban 보드가 표시됩니다.

### 개발 모드

개발 시에는 HMR(Hot Module Replacement)을 위해 Vite dev server를 별도로 실행합니다:

\`\`\`bash
# 터미널 1: API 서버
agentinc start

# 터미널 2: Vite dev server (HMR)
pnpm --filter @agentinc/web dev
# → http://localhost:3848 에서 접속
\`\`\`
```

## Acceptance Criteria

```bash
# 1. 전체 빌드
pnpm build

# 2. 웹 빌드 및 복사
pnpm build:web

# 3. CLI 시작 및 대시보드 확인
node packages/cli/dist/index.js start
# → 콘솔에 Dashboard URL 출력 확인
# → 브라우저에서 http://localhost:3847 접속
# → Kanban 보드 표시 확인

# 4. CLI 동작 확인
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js agent list
```

모든 명령이 에러 없이 완료되고, 대시보드가 정상 표시되어야 한다.

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/12-gui-dashboard/index.json`의 phase 7 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- **기존 start 로직 보존**: orchestrator, agent worker 관련 기존 로직을 삭제하지 마라. 콘솔 출력만 추가.
- **SPA fallback 순서**: API 라우트를 먼저 등록하고, fallback은 마지막에 등록해야 한다.
- **ESM __dirname**: Node.js ESM에서 `__dirname`이 없으므로 `fileURLToPath`와 `path.dirname`을 사용하라.
- **빌드 순서**: `pnpm build` 실행 시 workspace 의존성 순서대로 빌드됨. web은 CLI와 무관하게 병렬 빌드 가능.
- **public 디렉토리 위치**: `packages/server/public/`이 `dist/` 외부에 있어야 함. 빌드 후 복사 스크립트가 덮어씀.
- 기존 테스트가 모두 통과하는지 확인하라.
