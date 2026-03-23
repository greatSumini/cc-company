# Phase 2: CLI/Server 패키지 분리

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — 전체 아키텍처 (monorepo 구조 포함)
- `/spec/adr.md` — ADR-022 (Monorepo 전환) 확인
- `/tasks/12-gui-dashboard/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `packages/core/` — Phase 1에서 생성된 core 패키지 구조
- `packages/core/src/` — 이동된 types, store, services, utils
- `packages/core/package.json` — core 패키지 설정

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. CLI 패키지 생성

#### 1.1 디렉토리 구조 생성

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── index.ts
│   │   ├── init.ts
│   │   ├── run.ts
│   │   ├── agent.ts
│   │   ├── subagent.ts
│   │   ├── skill.ts
│   │   ├── hook.ts
│   │   ├── start.ts
│   │   ├── ticket.ts
│   │   ├── webhook.ts
│   │   └── context.ts
│   ├── claude-runner/
│   │   ├── index.ts
│   │   ├── flag-builder.ts
│   │   ├── env-builder.ts
│   │   └── spawner.ts
│   ├── gh-client/
│   │   └── index.ts
│   ├── logger/
│   │   └── run-logger.ts
│   ├── services/
│   │   ├── run.service.ts
│   │   ├── orchestrator.service.ts
│   │   └── agent-runner.service.ts
│   ├── templates/
│   │   └── (기존 템플릿 파일들)
│   └── index.ts          # CLI 엔트리포인트
├── tests/
│   └── claude-runner/
├── package.json
└── tsconfig.json
```

#### 1.2 `packages/cli/package.json` 생성

```json
{
  "name": "@agentinc/cli",
  "version": "0.2.0",
  "type": "module",
  "bin": {
    "agentinc": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@agentinc/core": "workspace:*",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

#### 1.3 `packages/cli/tsconfig.json` 생성

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"],
  "references": [
    { "path": "../core" }
  ]
}
```

#### 1.4 소스 파일 이동

| 원본 경로 | 대상 경로 |
|-----------|-----------|
| `src/commands/*` | `packages/cli/src/commands/` |
| `src/claude-runner/*` | `packages/cli/src/claude-runner/` |
| `src/gh-client/*` | `packages/cli/src/gh-client/` |
| `src/logger/*` | `packages/cli/src/logger/` |
| `src/services/run.service.ts` | `packages/cli/src/services/run.service.ts` |
| `src/services/orchestrator.service.ts` | `packages/cli/src/services/orchestrator.service.ts` |
| `src/services/agent-runner.service.ts` | `packages/cli/src/services/agent-runner.service.ts` |
| `src/templates/*` | `packages/cli/src/templates/` |
| `src/index.ts` | `packages/cli/src/index.ts` |
| `src/agent-worker.ts` | `packages/cli/src/agent-worker.ts` |

#### 1.5 import 경로 수정 (CLI 패키지)

이동한 파일들에서 core 패키지의 모듈을 import하도록 수정:

```typescript
// 변경 전 (기존 src/commands/run.ts)
import { AgentConfig } from '../types/index.js'
import { FsStore } from '../store/fs-store.js'
import { AgentService } from '../services/agent.service.js'

// 변경 후 (packages/cli/src/commands/run.ts)
import { AgentConfig, FsStore, AgentService } from '@agentinc/core'
```

**패턴**:
- `../types/*` → `@agentinc/core` 또는 `@agentinc/core/types`
- `../store/*` → `@agentinc/core` 또는 `@agentinc/core/store`
- `../services/agent.service.js` → `@agentinc/core`
- `../services/resource.service.js` → `@agentinc/core`
- `../services/ticket.service.js` → `@agentinc/core`
- `../utils/*` → `@agentinc/core` 또는 `@agentinc/core/utils`

같은 패키지 내 import는 상대 경로 유지:
```typescript
// packages/cli/src/commands/run.ts
import { RunService } from '../services/run.service.js'  // CLI 내부
import { FlagBuilder } from '../claude-runner/flag-builder.js'  // CLI 내부
```

#### 1.6 CLI 테스트 파일 이동

| 원본 경로 | 대상 경로 |
|-----------|-----------|
| `tests/claude-runner/*` | `packages/cli/tests/claude-runner/` |

테스트 파일의 import 경로도 수정하라.

#### 1.7 `packages/cli/vitest.config.ts` 생성

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

### 2. Server 패키지 생성

#### 2.1 디렉토리 구조 생성

```
packages/server/
├── src/
│   ├── routes/
│   │   ├── index.ts
│   │   ├── tickets.ts
│   │   └── agents.ts
│   ├── middleware/
│   │   ├── index.ts
│   │   └── webhook-signature.ts
│   ├── webhook-receiver/
│   │   ├── index.ts
│   │   ├── smee-receiver.ts
│   │   └── sse-receiver.ts
│   └── index.ts          # Express 앱 엔트리
├── tests/
│   └── middleware/
├── package.json
└── tsconfig.json
```

#### 2.2 `packages/server/package.json` 생성

```json
{
  "name": "@agentinc/server",
  "version": "0.2.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@agentinc/core": "workspace:*",
    "express": "^5.0.0",
    "smee-client": "^2.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

#### 2.3 `packages/server/tsconfig.json` 생성

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"],
  "references": [
    { "path": "../core" }
  ]
}
```

#### 2.4 소스 파일 이동

| 원본 경로 | 대상 경로 |
|-----------|-----------|
| `src/server/routes/*` | `packages/server/src/routes/` |
| `src/server/middleware/*` | `packages/server/src/middleware/` |
| `src/server/index.ts` | `packages/server/src/index.ts` |
| `src/webhook-receiver/*` | `packages/server/src/webhook-receiver/` |

#### 2.5 import 경로 수정 (Server 패키지)

```typescript
// 변경 전 (기존 src/server/routes/tickets.ts)
import { Ticket } from '../../types/index.js'
import { TicketService } from '../../services/ticket.service.js'

// 변경 후 (packages/server/src/routes/tickets.ts)
import { Ticket, TicketService } from '@agentinc/core'
```

#### 2.6 Server 테스트 파일 이동

| 원본 경로 | 대상 경로 |
|-----------|-----------|
| `tests/middleware/*` | `packages/server/tests/middleware/` |

#### 2.7 `packages/server/vitest.config.ts` 생성

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

### 3. CLI-Server 연결

`packages/cli/src/commands/start.ts`에서 server를 시작해야 한다. 두 가지 방식이 있다:

**방식 A**: CLI가 server 패키지를 의존성으로 가짐
**방식 B**: CLI가 server를 별도 프로세스로 실행

**선택: 방식 A** — CLI가 `@agentinc/server`를 의존성으로 추가하고 직접 import하여 시작.

`packages/cli/package.json`에 의존성 추가:
```json
{
  "dependencies": {
    "@agentinc/core": "workspace:*",
    "@agentinc/server": "workspace:*",
    "commander": "^12.1.0"
  }
}
```

`packages/cli/src/commands/start.ts` 수정:
```typescript
import { createServer } from '@agentinc/server'
// 기존 로직 유지, server import 경로만 변경
```

### 4. 기존 src/ 디렉토리 정리

모든 파일이 packages/로 이동되었으면, 기존 `src/` 디렉토리를 삭제하라.

기존 `tests/` 디렉토리도 삭제하라 (모든 테스트가 각 패키지로 이동됨).

기존 `dist/` 디렉토리도 삭제하라.

### 5. 루트 tsconfig.json 업데이트

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "module": "Node16",
    "moduleResolution": "Node16",
    "target": "ES2022",
    "resolveJsonModule": true
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/cli" },
    { "path": "./packages/server" }
  ],
  "files": []
}
```

### 6. 루트 vitest.config.ts 삭제

각 패키지에 개별 vitest.config.ts가 있으므로 루트의 것은 삭제하라.

## Acceptance Criteria

```bash
# 1. 의존성 재설치
pnpm install

# 2. 전체 빌드
pnpm build

# 3. 전체 테스트
pnpm test

# 4. CLI 동작 확인
pnpm --filter @agentinc/cli build
node packages/cli/dist/index.js --help
```

모든 명령이 에러 없이 완료되어야 한다.

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/12-gui-dashboard/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- **Express 버전 확인**: 기존에 사용하던 Express 버전을 확인하고 그대로 사용하라 (5.x인지 4.x인지).
- **smee-client 버전 확인**: 기존 버전을 확인하고 그대로 사용하라.
- **순환 의존성 주의**: core → cli, core → server 방향만 허용. cli ↔ server 간 직접 import는 피하라.
- 기존 테스트가 모두 통과하는지 반드시 확인하라.
- import 경로에서 `.js` 확장자를 빠뜨리지 마라 (패키지 간 import 제외).
- 기존 `src/`, `tests/`, `dist/` 디렉토리 삭제는 모든 이동이 완료된 후 마지막에 수행하라.
