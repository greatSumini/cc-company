# spec-diff: rename

Baseline: `7d87b66`

## `spec/adr.md`

```diff
diff --git a/spec/adr.md b/spec/adr.md
index f472e70..efab0d2 100644
--- a/spec/adr.md
+++ b/spec/adr.md
@@ -19,9 +19,9 @@
 
 **상태**: 확정 (2026-03-19)
 
-**맥락**: .cc-company/ 디렉토리에 파일로 저장 vs SQLite 등 로컬 DB
+**맥락**: .agentinc/ 디렉토리에 파일로 저장 vs SQLite 등 로컬 DB
 
-**결정**: 파일시스템 기반 (.cc-company/ 디렉토리)
+**결정**: 파일시스템 기반 (.agentinc/ 디렉토리)
 
 **근거**:
 - git에 커밋 가능 → 팀 공유 자연스러움
@@ -34,15 +34,15 @@
 
 **상태**: 확정 (2026-03-19)
 
-**맥락**: cc-company 고유 플래그와 claude CLI 플래그를 어떻게 구분할 것인가
+**맥락**: agentinc 고유 플래그와 claude CLI 플래그를 어떻게 구분할 것인가
 
 **결정**: 포지셔널 인자 2개(agent-name, prompt)만 추출, 나머지 플래그는 전부 claude CLI에 패스스루
 
 **근거**:
-- cc-company 자체 고유 플래그가 거의 없음
+- agentinc 자체 고유 플래그가 거의 없음
 - `--` 구분자 불필요 → DX 향상
 - claude CLI 플래그 변경에 자동 대응 (유지보수 비용 최소화)
-- 향후 cc-company 고유 플래그 필요 시 `--cc-` 접두사로 네임스페이스 도입
+- 향후 agentinc 고유 플래그 필요 시 `--ai-` 접두사로 네임스페이스 도입
 
 ---
 
@@ -52,7 +52,7 @@
 
 **맥락**: subagent/skills/hooks를 각 agent 디렉토리에 직접 배치할 것인가, 공용 풀에서 참조할 것인가
 
-**결정**: 공용 풀 (.cc-company/subagents/, skills/, hooks/) + agent.json에서 이름으로 참조
+**결정**: 공용 풀 (.agentinc/subagents/, skills/, hooks/) + agent.json에서 이름으로 참조
 
 **근거**:
 - subagent/skills는 특정 기술의 활용법을 담으므로 agent(직무)와 lifecycle이 다름
@@ -67,7 +67,7 @@
 
 **맥락**: 공용 풀에 리소스 생성과 agent에 할당을 2단계로 분리할 것인가
 
-**결정**: `cc-company agent <name> add subagent <name>` — 공용 풀에 없으면 생성 + 할당을 1단계로 수행. 이미 존재하면 할당만.
+**결정**: `agent-inc agent <name> add subagent <name>` — 공용 풀에 없으면 생성 + 할당을 1단계로 수행. 이미 존재하면 할당만.
 
 **근거**:
 - 실제 사용 시나리오에서 "이 agent에 이 기술을 추가"가 시작점
@@ -123,12 +123,12 @@
 
 **상태**: 확정 (2026-03-19)
 
-**맥락**: .cc-company/ 스키마가 변경될 때 기존 설정 호환성 처리
+**맥락**: .agentinc/ 스키마가 변경될 때 기존 설정 호환성 처리
 
 **결정**: config.json에 version 필드를 포함. MVP에서는 마이그레이션 로직 미구현.
 
 **근거**:
-- 아직 사용자가 없으므로 스키마 변경 시 `cc-company init --force`로 대응 가능
+- 아직 사용자가 없으므로 스키마 변경 시 `agent-inc init --force`로 대응 가능
 - version 필드를 지금 심어두면 향후 마이그레이션 로직 추가 시 대응 가능
 
 ---
@@ -137,7 +137,7 @@
 
 **상태**: 확정 (2026-03-19)
 
-**맥락**: .cc-company/가 이미 존재할 때 `cc-company init` 동작
+**맥락**: .agentinc/가 이미 존재할 때 `agent-inc init` 동작
 
 **결정**: 이미 존재하면 에러. `--force` 플래그로 덮어쓰기 옵션 제공.
 
@@ -151,20 +151,20 @@
 
 **상태**: 확정 (2026-03-19)
 
-**맥락**: 현재 run command는 `<agent>` `<prompt>` 두 개의 필수 인자를 받으며, `-p`는 passthrough flag로 처리된다. 사용자가 prompt 없이 interactive TUI를 시작하고 싶은 니즈가 있고, cc-company가 `-p` 여부를 인식해야 mode별 로직(로깅 전략, prompt 필수 여부 validation 등)을 분기할 수 있다.
+**맥락**: 현재 run command는 `<agent>` `<prompt>` 두 개의 필수 인자를 받으며, `-p`는 passthrough flag로 처리된다. 사용자가 prompt 없이 interactive TUI를 시작하고 싶은 니즈가 있고, agent-inc가 `-p` 여부를 인식해야 mode별 로직(로깅 전략, prompt 필수 여부 validation 등)을 분기할 수 있다.
 
 **결정**:
 1. `<prompt>`를 optional (`[prompt]`)로 변경. `-`로 시작하지 않는 첫 번째 인자를 prompt로 취급.
-2. `-p`를 cc-company의 first-class option으로 등록. commander `.option('-p, --print')`로 파싱하되, 동시에 Claude Code CLI에도 전달.
+2. `-p`를 agent-inc의 first-class option으로 등록. commander `.option('-p, --print')`로 파싱하되, 동시에 Claude Code CLI에도 전달.
 3. `-p` 없이 실행하면 interactive TUI 모드, `-p`로 실행하면 print (headless) 모드.
 4. `-p` 사용 시 prompt는 필수. 없으면 에러.
 5. RunLog에 `mode` 필드 추가, `prompt`는 nullable.
 6. `startedAt`은 spawn 직전, `finishedAt`은 spawn 완료 후 기록 (interactive 세션의 실제 소요 시간 반영).
 
 **근거**:
-- ADR-003에서 "패스스루 전략"을 확정했지만, `-p`는 cc-company 자체의 동작 분기에 필요한 유일한 flag. 패스스루 원칙을 깨는 것이 아니라, "인식 + 전달"의 하이브리드 접근.
-- interactive mode는 Claude Code의 핵심 UX. 이를 지원하지 않으면 cc-company의 가치가 print mode에만 한정됨.
-- prompt optional화로 `cc-company run developer`라는 최소 입력으로 agent를 실행할 수 있어 DX 향상.
+- ADR-003에서 "패스스루 전략"을 확정했지만, `-p`는 agentinc 자체의 동작 분기에 필요한 유일한 flag. 패스스루 원칙을 깨는 것이 아니라, "인식 + 전달"의 하이브리드 접근.
+- interactive mode는 Claude Code의 핵심 UX. 이를 지원하지 않으면 agent-inc의 가치가 print mode에만 한정됨.
+- prompt optional화로 `agent-inc run developer`라는 최소 입력으로 agent를 실행할 수 있어 DX 향상.
 
 ---
 
@@ -182,7 +182,7 @@
 - 파싱 라이브러리: `gray-matter` (dependencies)
 - Hook은 JSON 유지 (config 필드가 구조화된 JSON이므로 md 변환 부자연스러움)
 
-**영향**: `.cc-company/subagents/*.json` → `*.md`, `.cc-company/skills/*.json` → `*.md`. 런타임 인터페이스(SubagentConfig, SkillConfig) 유지.
+**영향**: `.agentinc/subagents/*.json` → `*.md`, `.agentinc/skills/*.json` → `*.md`. 런타임 인터페이스(SubagentConfig, SkillConfig) 유지.
 
 ---
 
@@ -190,7 +190,7 @@
 
 **상태**: 확정 (2026-03-22)
 
-**맥락**: Anthropic 공식 skills 프레임워크는 디렉토리 단위(SKILL.md + scripts/, references/, assets/)로 관리. 현재 cc-company는 단일 `.md` 파일. 보조 리소스(스크립트, 참조 문서, 템플릿 등)를 함께 관리할 수 없음.
+**맥락**: Anthropic 공식 skills 프레임워크는 디렉토리 단위(SKILL.md + scripts/, references/, assets/)로 관리. 현재 agent-inc는 단일 `.md` 파일. 보조 리소스(스크립트, 참조 문서, 템플릿 등)를 함께 관리할 수 없음.
 
 **결정**: `skills/{name}/SKILL.md` 디렉토리 구조로 전환. `resources` 필드를 SKILL.md frontmatter에 매니페스트로 포함. 런타임 디렉토리 스캔이 아닌 메타데이터 기반 — 향후 원격 서버 호스팅(api-store) 전환 시 필요한 파일만 fetch 가능하도록.
 
@@ -202,11 +202,11 @@
 
 **상태**: 확정 (2026-03-22)
 
-**맥락**: Claude Code CLI의 `--add-dir` 플래그는 추가 디렉토리 내 `.claude/skills/`를 자동 로드한다. cc-company가 agent에 할당된 skills를 임시 디렉토리에 복사하여 `--add-dir`로 전달하는 방식을 사용한다.
+**맥락**: Claude Code CLI의 `--add-dir` 플래그는 추가 디렉토리 내 `.claude/skills/`를 자동 로드한다. agent-inc가 agent에 할당된 skills를 임시 디렉토리에 복사하여 `--add-dir`로 전달하는 방식을 사용한다.
 
-**결정**: `--add-dir`을 cc-company 내부 전용으로 사용. 사용자가 passthrough로 전달하면 에러. `--add-dir` 차단 검증은 run.service(서비스 레이어)에서 수행 — command 레이어가 아닌 서비스 레이어에서 검증해야 테스트 가능.
+**결정**: `--add-dir`을 agentinc 내부 전용으로 사용. 사용자가 passthrough로 전달하면 에러. `--add-dir` 차단 검증은 run.service(서비스 레이어)에서 수행 — command 레이어가 아닌 서비스 레이어에서 검증해야 테스트 가능.
 
-**임시 디렉토리**: `.cc-company/.tmp/run-{uuid}/.claude/skills/`에 skill 디렉토리 복사. `try/finally`로 정리 + 다음 run 시 1시간 이상 stale 디렉토리 자동 삭제.
+**임시 디렉토리**: `.agentinc/.tmp/run-{uuid}/.claude/skills/`에 skill 디렉토리 복사. `try/finally`로 정리 + 다음 run 시 1시간 이상 stale 디렉토리 자동 삭제.
 
 ---
 
@@ -230,7 +230,7 @@
 
 **상태**: 확정 (2026-03-22)
 
-**맥락**: cc-company로 생성한 agent들이 commit/push/PR 시 서로 다른 GitHub 계정을 사용할 수 있어야 한다. GitHub에서 "누가 했는가"는 두 레이어로 나뉜다: Git commit identity (author/committer)와 GitHub API identity (push/PR 권한). 둘 다 에이전트별로 분리해야 한다.
+**맥락**: agent-inc로 생성한 agent들이 commit/push/PR 시 서로 다른 GitHub 계정을 사용할 수 있어야 한다. GitHub에서 "누가 했는가"는 두 레이어로 나뉜다: Git commit identity (author/committer)와 GitHub API identity (push/PR 권한). 둘 다 에이전트별로 분리해야 한다.
 
 **결정**: gh CLI 멀티 계정 + 환경변수 주입
 
@@ -255,7 +255,7 @@
 
 **상태**: 확정 (2026-03-22)
 
-**맥락**: 현재 `cc-company run <agent>`는 1회성 실행이다. agent들이 지속적으로 실행되면서 할당된 작업(ticket)을 처리하는 방식으로 전환이 필요하다. ticket에는 참조(cc) 기능이 있어, 참조된 agent들이 수신확인 후 assignee가 작업을 시작할 수 있다.
+**맥락**: 현재 `agent-inc run <agent>`는 1회성 실행이다. agent들이 지속적으로 실행되면서 할당된 작업(ticket)을 처리하는 방식으로 전환이 필요하다. ticket에는 참조(cc) 기능이 있어, 참조된 agent들이 수신확인 후 assignee가 작업을 시작할 수 있다.
 
 **결정**: Ticket 기반 작업 관리 시스템 도입
 
@@ -278,7 +278,7 @@
 **결정**: 파일 저장 + HTTP API
 
 **근거**:
-- 파일 저장: `.cc-company/tickets/{id}.json`에 저장. git 추적 가능, 단순
+- 파일 저장: `.agentinc/tickets/{id}.json`에 저장. git 추적 가능, 단순
 - HTTP API: 각 agent가 REST API로 ticket CRUD. GUI 대시보드 연동 자연스러움
 - ITicketStore 인터페이스로 추상화 → 향후 원격 서버 전환 시 API 스펙 유지
 
@@ -293,12 +293,12 @@
 
 **상태**: 확정 (2026-03-22)
 
-**맥락**: `cc-company start` 실행 시 여러 agent 프로세스를 관리하는 방식을 결정해야 한다.
+**맥락**: `agent-inc start` 실행 시 여러 agent 프로세스를 관리하는 방식을 결정해야 한다.
 
 **결정**: child_process.fork() + idle timeout (3분)
 
 **근거**:
-- `cc-company start` 시 Ticket Server 시작 + 모든 agent worker 프로세스 fork
+- `agent-inc start` 시 Ticket Server 시작 + 모든 agent worker 프로세스 fork
 - 각 agent는 polling loop로 ticket 조회 (5초 간격)
 - 3분간 작업 없으면 해당 agent 자동 종료
 - 모든 agent 종료 후에도 Ticket Server는 유지 (사용자가 Ctrl+C로 종료)
```

## `spec/architecture.md`

```diff
diff --git a/spec/architecture.md b/spec/architecture.md
index 9cedd3d..f4adccd 100644
--- a/spec/architecture.md
+++ b/spec/architecture.md
@@ -1,4 +1,4 @@
-# cc-company Architecture
+# agent-inc Architecture
 
 ## 기술 스택
 
@@ -128,7 +128,7 @@ Claude CLI와의 인터페이스 전담.
 
 ### Logger
 
-- **run-logger.ts** — 실행 메타데이터 + stdout/stderr를 `.cc-company/runs/`에 JSON으로 저장
+- **run-logger.ts** — 실행 메타데이터 + stdout/stderr를 `.agentinc/runs/`에 JSON으로 저장
 
 ## 소스 디렉토리 구조
 
@@ -184,7 +184,7 @@ src/
 
 ## 데이터 흐름
 
-### Interactive Mode 예시: `cc-company run developer`
+### Interactive Mode 예시: `agent-inc run developer`
 
 ```
 1. commands/run.ts
@@ -217,11 +217,11 @@ src/
         │
         ▼
 6. logger/run-logger.ts
-   RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
+   RunLog JSON → .agentinc/runs/{timestamp}-{uuid}.json
    prompt: null, mode: "interactive"
 ```
 
-### Interactive Mode with Prompt 예시: `cc-company run developer "버그 고쳐줘" --model opus`
+### Interactive Mode with Prompt 예시: `agent-inc run developer "버그 고쳐줘" --model opus`
 
 ```
 1. commands/run.ts
@@ -257,7 +257,7 @@ src/
         │
         ▼
 6. logger/run-logger.ts
-   RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
+   RunLog JSON → .agentinc/runs/{timestamp}-{uuid}.json
    prompt: "버그 고쳐줘", mode: "interactive"
 ```
 
@@ -267,16 +267,16 @@ run.service에서 skills resolve 후:
 
 ```
 1. stale temp 정리
-   .cc-company/.tmp/run-* 중 1시간 이상 경과한 디렉토리 자동 삭제
+   .agentinc/.tmp/run-* 중 1시간 이상 경과한 디렉토리 자동 삭제
 
 2. 임시 디렉토리 생성
-   .cc-company/.tmp/run-{uuid}/.claude/skills/ 생성
+   .agentinc/.tmp/run-{uuid}/.claude/skills/ 생성
 
 3. skill 디렉토리 복사
    할당된 skill 디렉토리 전체를 임시 경로로 복사
 
 4. flag-builder
-   addDirPath: ".cc-company/.tmp/run-{uuid}" → --add-dir 플래그 생성
+   addDirPath: ".agentinc/.tmp/run-{uuid}" → --add-dir 플래그 생성
 
 5. spawner
    child_process.spawn("claude", [...flags, "--add-dir", addDirPath])
@@ -299,7 +299,7 @@ interface FlagBuilderInput {
 }
 ```
 
-### 데몬 모드 예시: `cc-company start`
+### 데몬 모드 예시: `agent-inc start`
 
 ```
 1. commands/start.ts
@@ -334,7 +334,7 @@ interface FlagBuilderInput {
 ### Ticket 생성 → 처리 흐름 (cc 포함)
 
 ```
-1. cc-company ticket create --assignee developer --cc designer
+1. agent-inc ticket create --assignee developer --cc designer
         │
         ▼
 2. HTTP POST /tickets
@@ -365,7 +365,7 @@ interface FlagBuilderInput {
 1. GitHub에서 PR review comment 작성
         │
         ▼
-2. Webhook 발송 → smee.io (로컬) 또는 cc-company 서버 (원격)
+2. Webhook 발송 → smee.io (로컬) 또는 agentinc 서버 (원격)
         │
         ▼
 3. SmeeReceiver / SseReceiver가 이벤트 수신
```

## `spec/external/claude-skills-framework.md`

```diff
diff --git a/spec/external/claude-skills-framework.md b/spec/external/claude-skills-framework.md
index bfb1522..61661be 100644
--- a/spec/external/claude-skills-framework.md
+++ b/spec/external/claude-skills-framework.md
@@ -115,7 +115,7 @@ Progressive disclosure 패턴으로 구성:
 5. **Cross-references** — 관련 스킬 간 모듈화
 6. **Edge case documentation** — 명시적 gotchas 및 경고
 
-## cc-company 적용 시 핵심 시사점
+## agent-inc 적용 시 핵심 시사점
 
 1. **SKILL.md 중심 구조**: 단일 진입점(SKILL.md) + 보조 리소스(scripts/, references/, assets/)
 2. **Description의 중요성**: 트리거 메커니즘으로서의 description — Claude가 자동 호출할지 결정하는 핵심
```

## `spec/spec.md`

```diff
diff --git a/spec/spec.md b/spec/spec.md
index 160e3db..e0be8df 100644
--- a/spec/spec.md
+++ b/spec/spec.md
@@ -1,8 +1,8 @@
-# cc-company CLI Specification
+# agent-inc CLI Specification
 
 ## Overview
 
-cc-company는 Claude Code를 직무(agent) 단위로 조직화하여 실행할 수 있게 해주는 CLI 도구다.
+agent-inc는 Claude Code를 직무(agent) 단위로 조직화하여 실행할 수 있게 해주는 CLI 도구다.
 핵심 가치: "CEO처럼 목표를 제시하면, AI agent가 알아서 실행한다."
 
 ## CLI Commands
@@ -10,21 +10,21 @@ cc-company는 Claude Code를 직무(agent) 단위로 조직화하여 실행할 
 ### 프로젝트 초기화
 
 ```bash
-cc-company init          # .cc-company/ 구조 생성 + 기본 agent 3개 (developer, designer, hr)
-cc-company init --force  # 기존 .cc-company/ 덮어쓰기
+agent-inc init          # .agentinc/ 구조 생성 + 기본 agent 3개 (developer, designer, hr)
+agent-inc init --force  # 기존 .agentinc/ 덮어쓰기
 ```
 
 ### Agent 실행
 
 ```bash
-cc-company run <agent-name>                                    # interactive TUI
-cc-company run <agent-name> <prompt>                           # interactive + 초기 prompt
-cc-company run <agent-name> -p <prompt>                        # print mode (headless)
-cc-company run <agent-name> -p <prompt> --output-format json   # print mode + JSON 출력
+agent-inc run <agent-name>                                    # interactive TUI
+agent-inc run <agent-name> <prompt>                           # interactive + 초기 prompt
+agent-inc run <agent-name> -p <prompt>                        # print mode (headless)
+agent-inc run <agent-name> -p <prompt> --output-format json   # print mode + JSON 출력
 ```
 
 - 포지셔널 인자: `<agent-name>` 필수, `[prompt]` 선택
-- `-p` (print mode): cc-company가 인식하는 first-class option. Claude Code CLI에도 동시에 전달된다. `-p` 사용 시 `<prompt>`는 필수.
+- `-p` (print mode): agent-inc가 인식하는 first-class option. Claude Code CLI에도 동시에 전달된다. `-p` 사용 시 `<prompt>`는 필수.
 - `-p` 없이 실행하면 Claude Code의 interactive TUI가 터미널에 표시된다.
 - `-p`, `<prompt>` 외의 나머지 플래그는 전부 Claude Code CLI에 패스스루.
 - stdout/stderr는 그대로 사용자에게 파이프 (`stdio: 'inherit'`).
@@ -32,39 +32,39 @@ cc-company run <agent-name> -p <prompt> --output-format json   # print mode + JS
 ### Agent 관리
 
 ```bash
-cc-company agent create <name>    # agent 생성
-cc-company agent list             # agent 목록 조회
-cc-company agent remove <name>    # agent 삭제
-cc-company agent <name> show      # agent 상세 조회 (할당된 리소스 포함)
+agent-inc agent create <name>    # agent 생성
+agent-inc agent list             # agent 목록 조회
+agent-inc agent remove <name>    # agent 삭제
+agent-inc agent <name> show      # agent 상세 조회 (할당된 리소스 포함)
 ```
 
 ### 데몬 모드 실행
 
 ```bash
-cc-company start          # Ticket Server + 모든 agent worker 시작
+agent-inc start          # Ticket Server + 모든 agent worker 시작
 ```
 
 - Ticket Server를 시작하고 모든 등록된 agent의 worker 프로세스를 spawn
 - 각 agent worker는 자신에게 할당된 ticket을 polling하며 대기
 - 3분간 작업 없으면 해당 agent worker 자동 종료
 - 모든 agent 종료 후에도 서버는 유지 (Ctrl+C로 종료)
-- 기존 `cc-company run <agent>` 명령어는 1회성 실행으로 유지
+- 기존 `agent-inc run <agent>` 명령어는 1회성 실행으로 유지
 
 ### Ticket 관리
 
 ```bash
-cc-company ticket create --assignee <agent> [--cc <agents>] --title <title> --prompt <prompt> [--priority <p>]
-cc-company ticket list [--status <s>] [--assignee <a>]
-cc-company ticket show <id>
-cc-company ticket cancel <id>
+agent-inc ticket create --assignee <agent> [--cc <agents>] --title <title> --prompt <prompt> [--priority <p>]
+agent-inc ticket list [--status <s>] [--assignee <a>]
+agent-inc ticket show <id>
+agent-inc ticket cancel <id>
 ```
 
 ### Webhook 관리
 
 ```bash
-cc-company webhook setup <smee-url>  # smeeUrl을 config에 저장, enabled=true
-cc-company webhook status            # 현재 webhook 설정 표시
-cc-company webhook disable           # webhook.enabled = false
+agent-inc webhook setup <smee-url>  # smeeUrl을 config에 저장, enabled=true
+agent-inc webhook status            # 현재 webhook 설정 표시
+agent-inc webhook disable           # webhook.enabled = false
 ```
 
 - `--cc`: 쉼표로 구분된 agent 목록 (예: `--cc designer,hr`)
@@ -75,29 +75,29 @@ cc-company webhook disable           # webhook.enabled = false
 ### Agent 리소스 할당
 
 ```bash
-cc-company agent <agent-name> add subagent <name>       # 공용 풀에 없으면 생성 + 할당
-cc-company agent <agent-name> add skill <name>
-cc-company agent <agent-name> add hook <name>
-cc-company agent <agent-name> remove subagent <name>    # 할당 해제
-cc-company agent <agent-name> remove skill <name>
-cc-company agent <agent-name> remove hook <name>
+agent-inc agent <agent-name> add subagent <name>       # 공용 풀에 없으면 생성 + 할당
+agent-inc agent <agent-name> add skill <name>
+agent-inc agent <agent-name> add hook <name>
+agent-inc agent <agent-name> remove subagent <name>    # 할당 해제
+agent-inc agent <agent-name> remove skill <name>
+agent-inc agent <agent-name> remove hook <name>
 ```
 
 ### 공용 리소스 관리
 
 ```bash
-cc-company subagent add <name>       # 공용 풀에만 생성 (할당 없이)
-cc-company subagent list
-cc-company subagent remove <name>    # 삭제 (할당된 agent 있으면 경고)
+agent-inc subagent add <name>       # 공용 풀에만 생성 (할당 없이)
+agent-inc subagent list
+agent-inc subagent remove <name>    # 삭제 (할당된 agent 있으면 경고)
 
-cc-company skill add|list|remove <name>
-cc-company hook add|list|remove <name>
+agent-inc skill add|list|remove <name>
+agent-inc hook add|list|remove <name>
 ```
 
-## .cc-company/ 디렉토리 구조
+## .agentinc/ 디렉토리 구조
 
 ```
-.cc-company/
+.agentinc/
 ├── config.json              # 프로젝트 레벨 설정 (version 포함)
 ├── subagents/               # 공용 subagent 풀
 │   ├── git-expert.md
@@ -273,11 +273,11 @@ model: sonnet                # optional
 ### Skill 파일 관리
 
 ```bash
-cc-company skill add-file <skill-name> <file-path> --content <content>
-cc-company skill add-file <skill-name> <file-path> --stdin
-cc-company skill edit-file <skill-name> <file-path> --content <content>
-cc-company skill edit-file <skill-name> <file-path> --stdin
-cc-company skill remove-file <skill-name> <file-path>
+agent-inc skill add-file <skill-name> <file-path> --content <content>
+agent-inc skill add-file <skill-name> <file-path> --stdin
+agent-inc skill edit-file <skill-name> <file-path> --content <content>
+agent-inc skill edit-file <skill-name> <file-path> --stdin
+agent-inc skill remove-file <skill-name> <file-path>
 ```
 
 - `<file-path>`는 skill 디렉토리 기준 상대경로 (예: `scripts/run-deploy.sh`)
@@ -288,7 +288,7 @@ cc-company skill remove-file <skill-name> <file-path>
 ### Skill 상세 조회
 
 ```bash
-cc-company skill show <name>    # 메타데이터 + 파일 목록 + resources 불일치 경고
+agent-inc skill show <name>    # 메타데이터 + 파일 목록 + resources 불일치 경고
 ```
 
 ## Hook JSON 형식
@@ -353,7 +353,7 @@ Hook은 config 필드가 구조화된 JSON이므로 `.json` 형식을 유지한
 
 ## 기본 Agent 템플릿
 
-`cc-company init` 시 생성되는 기본 agent 3종:
+`agent-inc init` 시 생성되는 기본 agent 3종:
 
 - **developer**: 소프트웨어 개발 전담. 기본 subagent/skills 포함.
 - **designer**: UI/UX 디자인 전담. 기본 subagent/skills 포함.
```

## `spec/test-cases.md`

```diff
diff --git a/spec/test-cases.md b/spec/test-cases.md
index 82e9dd8..e59b1cb 100644
--- a/spec/test-cases.md
+++ b/spec/test-cases.md
@@ -1,4 +1,4 @@
-# cc-company Test Cases
+# agent-inc Test Cases
 
 ## flag-builder (유닛, ~15개)
 
@@ -45,7 +45,7 @@
 ✓ 존재하지 않는 agent getAgent → 에러
 
 [공용 리소스 CRUD]
-✓ createSubagent → .cc-company/subagents/ 에 파일 생성
+✓ createSubagent → .agentinc/subagents/ 에 파일 생성
 ✓ listSubagents → 전체 목록
 ✓ removeSubagent → 파일 삭제
 ✓ 존재하지 않는 리소스 get → 에러
```

## `spec/testing.md`

```diff
diff --git a/spec/testing.md b/spec/testing.md
index 67a848b..8332468 100644
--- a/spec/testing.md
+++ b/spec/testing.md
@@ -1,4 +1,4 @@
-# cc-company Testing Strategy
+# agent-inc Testing Strategy
 
 ## 원칙
 
```
