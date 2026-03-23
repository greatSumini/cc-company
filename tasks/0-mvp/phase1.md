# Phase 1: Types

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — CLI 스펙, 디렉토리 구조, 스키마
- `/spec/architecture.md` — 레이어 구조, 소스 디렉토리, 데이터 흐름
- `/spec/adr.md` — 아키텍처 결정 사항

그리고 이전 phase의 작업물을 확인하라:
- `src/index.ts` — CLI 엔트리포인트 구조
- `package.json` — 프로젝트 설정

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. 기존 코드와 일관성을 유지하는 것이 중요하다.

## 작업 내용

### src/types/index.ts

프로젝트 전체에서 사용할 타입을 정의한다. `/spec/spec.md`의 스키마 정의를 정확히 반영하라.

#### AgentConfig

```typescript
interface AgentConfig {
  name: string
  description: string
  subagents?: string[]    // 공용 풀의 리소스 이름 배열
  skills?: string[]
  hooks?: string[]
}
```

#### SubagentConfig

```typescript
interface SubagentConfig {
  name: string
  description: string
  prompt: string          // subagent의 instruction 내용
}
```

#### SkillConfig

```typescript
interface SkillConfig {
  name: string
  description: string
  prompt: string
}
```

#### HookConfig

```typescript
interface HookConfig {
  name: string
  description: string
  config: Record<string, unknown>   // hook 설정은 자유 형식
}
```

#### RunLog

```typescript
interface RunLog {
  id: string
  agent: string
  prompt: string
  startedAt: string       // ISO 8601
  finishedAt: string      // ISO 8601
  exitCode: number
  flags: string[]
  stdout: string
  stderr: string
}
```

#### ProjectConfig

```typescript
interface ProjectConfig {
  version: string
}
```

모든 타입은 `export`하라.

## Acceptance Criteria

```bash
npm run build             # 타입 에러 없이 컴파일 성공
```

- 모든 타입이 `src/types/index.ts`에서 export되어야 한다.
- `/spec/spec.md`의 스키마와 1:1 대응되어야 한다.

## AC 검증 방법

`npm run build`를 실행하라. 컴파일 에러가 없으면 성공이다.
성공하면 `/tasks/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 타입만 정의한다. 구현 로직이나 유틸리티 함수를 넣지 마라.
- interface를 사용하라. type alias보다 확장성이 좋다.
- optional 필드는 명시적으로 `?`를 붙여라.
