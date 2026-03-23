# Phase 1: Core 패키지 분리

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — 전체 아키텍처 (monorepo 구조 포함)
- `/spec/adr.md` — ADR-022 (Monorepo 전환) 확인
- `/tasks/12-gui-dashboard/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 현재 소스 구조를 파악하라:

- `/src/` 디렉토리의 모든 파일 구조
- `/tests/` 디렉토리의 테스트 파일 구조
- `/package.json` — 현재 의존성
- `/tsconfig.json` — 현재 TypeScript 설정

## 작업 내용

### 1. 루트 설정 파일 생성

#### 1.1 `pnpm-workspace.yaml` 생성

```yaml
packages:
  - 'packages/*'
```

#### 1.2 루트 `package.json` 수정

기존 내용을 유지하되, 아래 사항을 변경/추가하라:

```json
{
  "name": "agentinc-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev": "pnpm -r --parallel dev",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- `main`, `bin`, `files`, `type`, `exports` 등 CLI 패키지 관련 필드는 **삭제**하라. 이들은 `packages/cli/package.json`으로 이동한다.
- 런타임 dependencies (commander, express 등)는 **삭제**하라. 각 패키지로 분산된다.
- devDependencies 중 typescript만 루트에 남기고, vitest 등은 각 패키지로 이동한다.

#### 1.3 루트 `tsconfig.json` 수정

Project references 방식으로 변경:

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

### 2. Core 패키지 생성

#### 2.1 디렉토리 구조 생성

```
packages/core/
├── src/
│   ├── types/
│   │   ├── index.ts
│   │   └── github-events.ts
│   ├── store/
│   │   ├── index.ts
│   │   ├── store.ts
│   │   ├── fs-store.ts
│   │   ├── ticket-store.ts
│   │   ├── fs-ticket-store.ts
│   │   └── agent-status-store.ts
│   ├── services/
│   │   ├── index.ts
│   │   ├── agent.service.ts
│   │   ├── resource.service.ts
│   │   ├── ticket.service.ts
│   │   ├── pr-event.service.ts
│   │   └── merge.service.ts
│   ├── utils/
│   │   ├── index.ts
│   │   └── frontmatter.ts
│   └── index.ts          # 전체 re-export
├── tests/
│   ├── store/
│   ├── services/
│   └── utils/
├── package.json
└── tsconfig.json
```

#### 2.2 `packages/core/package.json` 생성

```json
{
  "name": "@agentinc/core",
  "version": "0.2.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./types": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/types/index.js"
    },
    "./store": {
      "types": "./dist/store/index.d.ts",
      "import": "./dist/store/index.js"
    },
    "./services": {
      "types": "./dist/services/index.d.ts",
      "import": "./dist/services/index.js"
    },
    "./utils": {
      "types": "./dist/utils/index.d.ts",
      "import": "./dist/utils/index.js"
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
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

#### 2.3 `packages/core/tsconfig.json` 생성

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### 2.4 소스 파일 이동

아래 파일들을 `src/`에서 `packages/core/src/`로 이동하라:

| 원본 경로 | 대상 경로 |
|-----------|-----------|
| `src/types/index.ts` | `packages/core/src/types/index.ts` |
| `src/types/github-events.ts` | `packages/core/src/types/github-events.ts` |
| `src/store/store.ts` | `packages/core/src/store/store.ts` |
| `src/store/fs-store.ts` | `packages/core/src/store/fs-store.ts` |
| `src/store/ticket-store.ts` | `packages/core/src/store/ticket-store.ts` |
| `src/store/fs-ticket-store.ts` | `packages/core/src/store/fs-ticket-store.ts` |
| `src/store/agent-status-store.ts` | `packages/core/src/store/agent-status-store.ts` |
| `src/services/agent.service.ts` | `packages/core/src/services/agent.service.ts` |
| `src/services/resource.service.ts` | `packages/core/src/services/resource.service.ts` |
| `src/services/ticket.service.ts` | `packages/core/src/services/ticket.service.ts` |
| `src/services/pr-event.service.ts` | `packages/core/src/services/pr-event.service.ts` |
| `src/services/merge.service.ts` | `packages/core/src/services/merge.service.ts` |
| `src/utils/index.ts` | `packages/core/src/utils/index.ts` |
| `src/utils/frontmatter.ts` | `packages/core/src/utils/frontmatter.ts` |

**주의**: `src/services/` 디렉토리에 다른 서비스 파일이 있다면 (예: `run.service.ts`, `orchestrator.service.ts`, `agent-runner.service.ts`) 이들은 CLI/Server 전용이므로 이동하지 마라. Phase 2에서 처리한다.

#### 2.5 index.ts 파일 생성

**`packages/core/src/types/index.ts`**: 기존 파일 유지 (이미 export 있음)

**`packages/core/src/store/index.ts`** 생성:
```typescript
export * from './store.js'
export * from './fs-store.js'
export * from './ticket-store.js'
export * from './fs-ticket-store.js'
export * from './agent-status-store.js'
```

**`packages/core/src/services/index.ts`** 생성:
```typescript
export * from './agent.service.js'
export * from './resource.service.js'
export * from './ticket.service.js'
export * from './pr-event.service.js'
export * from './merge.service.js'
```

**`packages/core/src/utils/index.ts`**: 기존 파일 유지

**`packages/core/src/index.ts`** 생성:
```typescript
export * from './types/index.js'
export * from './store/index.js'
export * from './services/index.js'
export * from './utils/index.js'
```

#### 2.6 import 경로 수정

이동한 모든 파일의 상대 import 경로를 수정하라. 예:

```typescript
// 변경 전 (src/store/fs-store.ts)
import { AgentConfig } from '../types/index.js'

// 변경 후 (packages/core/src/store/fs-store.ts)
import { AgentConfig } from '../types/index.js'  // 같은 패키지 내라 변경 없음
```

**핵심 규칙**:
- 같은 패키지 내 import는 상대 경로 유지
- `.js` 확장자 필수 (ESM)

### 3. 테스트 파일 이동

#### 3.1 테스트 파일 이동

| 원본 경로 | 대상 경로 |
|-----------|-----------|
| `tests/store/` | `packages/core/tests/store/` |
| `tests/services/` | `packages/core/tests/services/` |
| `tests/utils/` | `packages/core/tests/utils/` |

#### 3.2 테스트 import 경로 수정

테스트 파일에서 소스를 import하는 경로를 수정하라:

```typescript
// 변경 전
import { FsStore } from '../../src/store/fs-store.js'

// 변경 후
import { FsStore } from '../../src/store/fs-store.js'  // 상대 경로 동일하게 유지
```

#### 3.3 `packages/core/vitest.config.ts` 생성

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

### 4. Claude Runner 관련 코드 처리

`src/claude-runner/` 디렉토리의 `flag-builder.ts`는 순수 변환 로직이므로 core로 이동해도 되지만, CLI 전용 코드와 밀접하게 연관되어 있다.

**결정**: `flag-builder.ts`는 Phase 2에서 `packages/cli/`로 이동한다. 이 phase에서는 건드리지 마라.

관련 테스트 (`tests/claude-runner/`)도 Phase 2에서 처리한다.

## Acceptance Criteria

```bash
# 1. pnpm 설치
pnpm install

# 2. core 패키지 빌드
pnpm --filter @agentinc/core build

# 3. core 패키지 테스트
pnpm --filter @agentinc/core test
```

모든 명령이 에러 없이 완료되어야 한다.

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/12-gui-dashboard/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- **기존 `src/` 디렉토리는 아직 삭제하지 마라.** Phase 2에서 나머지 코드를 이동한 후 삭제한다.
- **CLI/Server 전용 서비스는 이동하지 마라**: `run.service.ts`, `orchestrator.service.ts`, `agent-runner.service.ts`
- **claude-runner/ 디렉토리는 이동하지 마라**: Phase 2에서 처리
- **server/ 디렉토리는 이동하지 마라**: Phase 2에서 처리
- **commands/ 디렉토리는 이동하지 마라**: Phase 2에서 처리
- import 경로 수정 시 `.js` 확장자를 빠뜨리지 마라.
- 테스트가 기존과 동일하게 통과하는지 반드시 확인하라.
