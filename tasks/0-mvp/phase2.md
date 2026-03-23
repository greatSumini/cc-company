# Phase 2: Store

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — CLI 스펙, 디렉토리 구조, 스키마
- `/spec/architecture.md` — 레이어 구조, IStore 인터페이스 정의
- `/spec/adr.md` — ADR-002 (파일시스템), ADR-004 (공용 풀), ADR-007 (ConfigStore 추상화)
- `/spec/testing.md` — 테스트 전략
- `/spec/test-cases.md` — store 관련 테스트 케이스

그리고 이전 phase의 작업물을 반드시 확인하라:
- `src/types/index.ts` — 타입 정의 (AgentConfig, SubagentConfig 등)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. 특히 types에 정의된 인터페이스를 그대로 사용하라. 임의로 타입을 수정하거나 새로 만들지 마라.

## 작업 내용

### 1. src/store/store.ts — IStore 인터페이스

```typescript
export interface IStore {
  // Project config
  getProjectConfig(): ProjectConfig

  // Agent
  getAgent(name: string): AgentConfig
  listAgents(): AgentConfig[]
  createAgent(config: AgentConfig): void
  removeAgent(name: string): void
  updateAgent(name: string, config: Partial<AgentConfig>): void

  // Subagents (공용 풀)
  getSubagent(name: string): SubagentConfig
  listSubagents(): SubagentConfig[]
  createSubagent(config: SubagentConfig): void
  removeSubagent(name: string): void

  // Skills (공용 풀)
  getSkill(name: string): SkillConfig
  listSkills(): SkillConfig[]
  createSkill(config: SkillConfig): void
  removeSkill(name: string): void

  // Hooks (공용 풀)
  getHook(name: string): HookConfig
  listHooks(): HookConfig[]
  createHook(config: HookConfig): void
  removeHook(name: string): void

  // Run logs
  saveRunLog(log: RunLog): void
  getRunLogs(filter?: RunLogFilter): RunLog[]
}
```

RunLogFilter 타입이 필요하면 `src/types/index.ts`에 추가하라.

### 2. src/store/fs-store.ts — 파일시스템 구현체

IStore를 구현한다. `.cc-company/` 디렉토리 구조:

```
.cc-company/
├── config.json
├── subagents/
│   └── {name}.json
├── skills/
│   └── {name}.json
├── hooks/
│   └── {name}.json
├── agents/
│   └── {name}/
│       ├── agent.json
│       └── prompt.md
└── runs/
    └── {timestamp}-{uuid}.json
```

구현 시 고려사항:
- 생성자에서 `.cc-company/` 루트 경로를 받는다.
- 존재하지 않는 리소스 접근 시 명확한 에러 메시지를 던져라.
- 파일 읽기/쓰기는 동기(`fs.readFileSync`, `fs.writeFileSync`)로 충분하다. CLI 도구에서 async I/O는 불필요한 복잡성이다.
- agent 생성 시 디렉토리 + agent.json + 빈 prompt.md를 함께 만들어라.
- removeAgent 시 디렉토리 전체를 삭제하라 (`fs.rmSync` recursive).

### 3. 테스트 작성

`tests/store/fs-store.test.ts`

`/spec/test-cases.md`의 store 섹션에 정의된 케이스를 구현하라:

```
[agent CRUD]
✓ createAgent → 디렉토리 + agent.json + prompt.md 생성 확인
✓ getAgent → 생성한 agent를 정확히 읽어오는지
✓ listAgents → 복수 agent 목록 반환
✓ removeAgent → 디렉토리 삭제 확인
✓ 존재하지 않는 agent getAgent → 에러

[공용 리소스 CRUD]
✓ createSubagent → .cc-company/subagents/ 에 파일 생성
✓ listSubagents → 전체 목록
✓ removeSubagent → 파일 삭제
✓ 존재하지 않는 리소스 get → 에러

[참조 해석]
✓ agent.json의 subagents 이름 배열 → 실제 파일 내용으로 resolve
✓ 참조된 리소스가 공용 풀에 없을 때 → 에러
```

테스트는 실제 파일시스템을 사용한다. `os.tmpdir()`에 임시 디렉토리를 만들고, 각 테스트 후 정리하라.
참조 해석 테스트를 위해 IStore에 `resolveSubagents(names: string[]): SubagentConfig[]` 같은 메서드가 필요하다면 추가하라.

## Acceptance Criteria

```bash
npm run build    # 컴파일 에러 없음
npm test         # store 테스트 전체 통과
```

## AC 검증 방법

`npm run build && npm test`를 실행하라. 모두 성공하면 `/tasks/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- IStore 인터페이스는 향후 api-store 구현체로 교체 가능해야 한다. 파일시스템 전용 로직이 인터페이스에 누출되면 안 된다.
- `src/types/index.ts`에 정의된 타입을 그대로 import해서 사용하라. 타입을 중복 정의하지 마라.
- 에러는 커스텀 Error 클래스를 만들 필요 없이, 기본 Error에 명확한 메시지를 담아 던져라.
