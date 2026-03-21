# cc-company Architecture

## 기술 스택

- **Runtime**: Node.js
- **Language**: TypeScript
- **CLI Parser**: commander
- **Claude Code 연동**: child_process.spawn
- **Frontmatter 파싱**: gray-matter
- **배포**: npm

## 레이어 구조

```
Commands (CLI 파싱) → Services (비즈니스 로직) → Store (데이터 접근) / Claude Runner (실행)
```

### Commands

CLI arg 파싱만 수행하고 service를 호출한다. 로직 없음.

### Services

- **agent.service.ts** — agent CRUD + 리소스 assign/unassign
- **resource.service.ts** — 공용 subagent/skill/hook CRUD
- **run.service.ts** — 설정 로드 → 플래그 빌드 → spawn → 로그 저장 오케스트레이션

### Store

파일시스템 읽기/쓰기를 인터페이스로 추상화.
향후 대시보드 서버 API 구현체로 교체 가능.

```typescript
interface IStore {
  // agent
  getAgent(name: string): AgentConfig
  listAgents(): AgentConfig[]
  createAgent(config: AgentConfig): void
  removeAgent(name: string): void
  updateAgent(name: string, config: Partial<AgentConfig>): void

  // 공용 리소스
  getSubagent(name: string): SubagentConfig
  listSubagents(): SubagentConfig[]
  createSubagent(config: SubagentConfig): void
  removeSubagent(name: string): void
  // skills, hooks 동일 패턴

  // Skill file operations
  addSkillFile(skillName: string, filePath: string, content: string): void
  editSkillFile(skillName: string, filePath: string, content: string): void
  removeSkillFile(skillName: string, filePath: string): void
  getSkillFile(skillName: string, filePath: string): string
  getSkillDir(skillName: string): string

  // 실행 로그
  saveRunLog(log: RunLog): void
  getRunLogs(filter?: RunLogFilter): RunLog[]
}
```

- **fs-store.ts** — 파일시스템 구현체 (MVP). subagent/skill은 `.md` 파일을 `gray-matter`로 파싱하여 frontmatter → 메타데이터, body → prompt로 분리.
- **api-store.ts** — HTTP API 구현체 (향후 대시보드 연동 시)

### Claude Runner

Claude CLI와의 인터페이스 전담.

- **flag-builder.ts** — AgentConfig → claude CLI 플래그 배열 변환
- **spawner.ts** — child_process.spawn + stdin/stdout/stderr 파이프 + 종료코드 전달

### Logger

- **run-logger.ts** — 실행 메타데이터 + stdout/stderr를 `.cc-company/runs/`에 JSON으로 저장

## 소스 디렉토리 구조

```
src/
├── index.ts                  # CLI 엔트리, commander 설정
├── commands/
│   ├── init.ts
│   ├── run.ts
│   ├── agent.ts
│   ├── subagent.ts
│   ├── skill.ts
│   └── hook.ts
├── services/
│   ├── agent.service.ts
│   ├── resource.service.ts
│   └── run.service.ts
├── store/
│   ├── store.ts              # IStore 인터페이스
│   └── fs-store.ts
├── claude-runner/
│   ├── flag-builder.ts
│   └── spawner.ts
├── logger/
│   └── run-logger.ts
├── utils/
│   └── frontmatter.ts        # subagent/skill MD 파일의 파싱(parse*Md)과 직렬화(serialize*Md)
├── types/
│   └── index.ts
└── templates/                # init 시 복사할 기본 agent 템플릿
```

## 데이터 흐름

### Interactive Mode 예시: `cc-company run developer`

```
1. commands/run.ts
   포지셔널 추출: agent="developer", prompt=undefined (optional)
   mode 결정: -p flag 없음 → interactive mode
   패스스루 수집: []
        │
        ▼
2. services/run.service.ts
   store.getAgent("developer") → AgentConfig
   store.getSubagents(config.subagents) → SubagentConfig[]
   mode="interactive" 전달
        │
        ▼
3. claude-runner/flag-builder.ts
   AgentConfig + SubagentConfig[] → claude CLI 플래그 배열
   prompt가 undefined이면 마지막 positional arg 생략
   ["--append-system-prompt-file", "...prompt.md",
    "--agents", '{"git-expert":{...}}']
        │
        ▼
4. claude-runner/spawner.ts
   child_process.spawn("claude", flags)
   stdio: 'inherit' → interactive TUI가 터미널에 표시됨
        │
        ▼
5. logger/run-logger.ts
   RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
   prompt: null, mode: "interactive"
```

### Interactive Mode with Prompt 예시: `cc-company run developer "버그 고쳐줘" --model opus`

```
1. commands/run.ts
   포지셔널 추출: agent="developer", prompt="버그 고쳐줘" (optional)
   mode 결정: -p flag 없음 → interactive mode (prompt 있는 interactive)
   패스스루 수집: ["--model", "opus"]
   (-p flag 사용 시 mode="print", prompt 필수)
        │
        ▼
2. services/run.service.ts
   store.getAgent("developer") → AgentConfig
   store.getSubagents(config.subagents) → SubagentConfig[]
   store.getSkills(config.skills) → SkillConfig[]
        │
        ▼
3. claude-runner/flag-builder.ts
   AgentConfig + SubagentConfig[] → claude CLI 플래그 배열
   prompt가 있으면 마지막 positional arg로 포함
   ["--append-system-prompt-file", "...prompt.md",
    "--agents", '{"git-expert":{...}}',
    "--model", "opus",
    "버그 고쳐줘"]
        │
        ▼
4. claude-runner/spawner.ts
   child_process.spawn("claude", flags)
   stdout/stderr → 사용자에게 파이프 + 버퍼에 수집
        │
        ▼
5. logger/run-logger.ts
   RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
   prompt: "버그 고쳐줘", mode: "interactive"
```

### Skill 전달 흐름 (--add-dir)

run.service에서 skills resolve 후:

```
1. stale temp 정리
   .cc-company/.tmp/run-* 중 1시간 이상 경과한 디렉토리 자동 삭제

2. 임시 디렉토리 생성
   .cc-company/.tmp/run-{uuid}/.claude/skills/ 생성

3. skill 디렉토리 복사
   할당된 skill 디렉토리 전체를 임시 경로로 복사

4. flag-builder
   addDirPath: ".cc-company/.tmp/run-{uuid}" → --add-dir 플래그 생성

5. spawner
   child_process.spawn("claude", [...flags, "--add-dir", addDirPath])

6. 정리 (try/finally)
   spawn 완료 후 임시 디렉토리 삭제
```

### FlagBuilderInput

```typescript
interface FlagBuilderInput {
  promptFilePath: string
  subagents?: SubagentConfig[]
  mcpConfigPath?: string
  settingsPath?: string
  addDirPath?: string           // skills 임시 디렉토리 경로
  passthroughFlags?: string[]
  prompt?: string
}
```
