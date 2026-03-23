# Phase 4: Services

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — CLI 스펙, 리소스 할당 구조
- `/spec/architecture.md` — 서비스 레이어의 역할, 데이터 흐름
- `/spec/adr.md` — ADR-004 (공용 풀), ADR-005 (생성/할당 통합), ADR-008 (동시 실행)
- `/spec/testing.md` — 테스트 전략
- `/spec/test-cases.md` — services 테스트 케이스

그리고 이전 phase의 작업물을 반드시 확인하라:
- `src/types/index.ts` — 모든 타입 정의
- `src/store/store.ts` — IStore 인터페이스
- `src/store/fs-store.ts` — 파일시스템 구현체
- `src/claude-runner/flag-builder.ts` — buildFlags 함수 시그니처
- `src/claude-runner/spawner.ts` — spawnClaude 함수 시그니처

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. 특히 store의 IStore 인터페이스와 claude-runner의 함수 시그니처를 정확히 사용하라.

## 작업 내용

### 1. src/services/agent.service.ts

IStore를 주입받아 agent 관련 비즈니스 로직을 처리한다.

```typescript
export class AgentService {
  constructor(private store: IStore) {}

  create(name: string, description: string): void
  list(): AgentConfig[]
  show(name: string): AgentConfig   // 할당된 리소스 포함
  remove(name: string): void

  // 리소스 할당 — 공용 풀에 없으면 생성 후 할당
  assignSubagent(agentName: string, subagentName: string): void
  assignSkill(agentName: string, skillName: string): void
  assignHook(agentName: string, hookName: string): void

  // 리소스 할당 해제
  unassignSubagent(agentName: string, subagentName: string): void
  unassignSkill(agentName: string, skillName: string): void
  unassignHook(agentName: string, hookName: string): void
}
```

assign 로직:
1. 공용 풀에 해당 리소스가 존재하는지 확인
2. 없으면 공용 풀에 빈 템플릿으로 생성 (name + 빈 description/prompt)
3. agent.json의 해당 배열에 이름 추가
4. 이미 할당되어 있으면 무시 (에러 아님)

unassign 로직:
1. agent.json에서 해당 이름 제거
2. 공용 풀의 리소스는 건드리지 않음
3. 할당되어 있지 않으면 에러

### 2. src/services/resource.service.ts

공용 리소스 CRUD를 처리한다.

```typescript
export class ResourceService {
  constructor(private store: IStore) {}

  // Subagents
  createSubagent(name: string, description: string, prompt: string): void
  listSubagents(): SubagentConfig[]
  removeSubagent(name: string): void   // 할당된 agent 있으면 경고 출력

  // Skills
  createSkill(name: string, description: string, prompt: string): void
  listSkills(): SkillConfig[]
  removeSkill(name: string): void

  // Hooks
  createHook(name: string, description: string, config: Record<string, unknown>): void
  listHooks(): HookConfig[]
  removeHook(name: string): void
}
```

removeSubagent에서 할당된 agent가 있는지 확인하는 로직:
- `store.listAgents()`로 전체 agent 조회
- 각 agent의 subagents 배열에 해당 이름이 포함되어 있는지 확인
- 포함되어 있으면 console.warn으로 경고 출력 후 삭제 진행

### 3. src/services/run.service.ts

run 명령어의 오케스트레이션을 담당한다.

```typescript
export class RunService {
  constructor(
    private store: IStore,
    private logger: RunLogger   // Phase 5에서 구현. 지금은 인터페이스만 정의하고 optional로 처리.
  ) {}

  run(agentName: string, prompt: string, passthroughFlags: string[]): SpawnResult
}
```

run 로직:
1. `store.getAgent(agentName)` — agent 존재 확인
2. agent의 subagents/skills/hooks 이름 배열을 resolve (공용 풀에서 실제 설정 로드)
3. agent 디렉토리의 prompt.md, settings.json, mcp.json 경로 결정
4. `buildFlags()` 호출 → 플래그 배열 생성
5. `spawnClaude()` 호출 → 실행
6. logger가 있으면 RunLog 저장
7. SpawnResult 반환

logger는 Phase 5에서 구현되므로, 지금은 logger가 null/undefined일 때 로깅을 건너뛰도록 구현하라.

### 4. 테스트 작성

`/spec/test-cases.md`의 services 섹션에 정의된 케이스를 구현하라.

#### tests/services/agent.service.test.ts

실제 fs-store + 임시 디렉토리를 사용한다.

```
[assign]
✓ 공용 풀에 있는 리소스 assign → agent.json에 이름 추가
✓ 공용 풀에 없는 리소스 assign → 공용 풀에 생성 + agent.json에 추가
✓ 이미 할당된 리소스 중복 assign → 무시 (에러 아님)

[unassign]
✓ 할당된 리소스 unassign → agent.json에서 제거, 공용 풀은 유지
✓ 할당되지 않은 리소스 unassign → 에러

[remove]
✓ agent 삭제 시 공용 풀 리소스는 영향 없음
```

#### tests/services/resource.service.test.ts

```
[remove]
✓ 아무 agent에도 할당되지 않은 리소스 삭제 → 정상
✓ 할당된 agent가 있는 리소스 삭제 → 경고 메시지 출력
```

#### tests/services/run.service.test.ts

run.service의 테스트는 spawner를 mock해야 하므로, spawnClaude를 함수 인자로 주입받는 구조가 필요하다.
또는 `CC_DRY_RUN=1`을 설정하여 실제 spawn을 방지하라.

```
[run]
✓ 존재하지 않는 agent로 run → 에러
✓ 정상 실행 → 로그에 기록 (logger가 있을 때)
✓ exitCode 전파 확인
```

## Acceptance Criteria

```bash
npm run build    # 컴파일 에러 없음
npm test         # 모든 테스트 통과 (store + flag-builder + services)
```

## AC 검증 방법

`npm run build && npm test`를 실행하라. 모두 성공하면 `/tasks/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- Service는 IStore 인터페이스에만 의존한다. fs-store를 직접 import하지 마라 (테스트에서는 ok).
- assign 시 공용 풀 자동 생성은 빈 템플릿이다. 사용자가 나중에 내용을 채우는 구조.
- run.service에서 agent 디렉토리 경로를 결정하려면 `.cc-company/` 루트 경로를 알아야 한다. store에서 얻거나, 생성자에서 주입받아라.
