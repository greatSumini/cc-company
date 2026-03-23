# Architecture Decision Records

## ADR-001: Claude Code 연동 방식 — child_process spawn

**상태**: 확정 (2026-03-19)

**맥락**: Claude Code와 연동하는 방식으로 Node.js SDK 호출과 child_process spawn 두 가지 선택지가 있었다.

**결정**: child_process spawn

**근거**:
- Node.js SDK는 API key만 지원하여, 사용자의 Claude Code 구독 요금제를 사용할 수 없음
- spawn 방식은 Claude Code CLI 업데이트에 자동 대응
- MVP에서 충분한 수준의 제어 가능

---

## ADR-002: 설정 저장 방식 — 파일시스템 기반

**상태**: 확정 (2026-03-19)

**맥락**: .cc-company/ 디렉토리에 파일로 저장 vs SQLite 등 로컬 DB

**결정**: 파일시스템 기반 (.cc-company/ 디렉토리)

**근거**:
- git에 커밋 가능 → 팀 공유 자연스러움
- 사용자가 직접 파일을 확인/편집 가능
- DB 의존성 불필요

---

## ADR-003: CLI 플래그 패스스루 전략

**상태**: 확정 (2026-03-19)

**맥락**: cc-company 고유 플래그와 claude CLI 플래그를 어떻게 구분할 것인가

**결정**: 포지셔널 인자 2개(agent-name, prompt)만 추출, 나머지 플래그는 전부 claude CLI에 패스스루

**근거**:
- cc-company 자체 고유 플래그가 거의 없음
- `--` 구분자 불필요 → DX 향상
- claude CLI 플래그 변경에 자동 대응 (유지보수 비용 최소화)
- 향후 cc-company 고유 플래그 필요 시 `--cc-` 접두사로 네임스페이스 도입

---

## ADR-004: 공용 리소스 풀 + 참조 구조

**상태**: 확정 (2026-03-19)

**맥락**: subagent/skills/hooks를 각 agent 디렉토리에 직접 배치할 것인가, 공용 풀에서 참조할 것인가

**결정**: 공용 풀 (.cc-company/subagents/, skills/, hooks/) + agent.json에서 이름으로 참조

**근거**:
- subagent/skills는 특정 기술의 활용법을 담으므로 agent(직무)와 lifecycle이 다름
- 여러 agent가 같은 리소스를 공유할 수 있어야 함
- agent.json에는 이름(식별자) 배열만 저장

---

## ADR-005: 리소스 생성/할당 통합 커맨드

**상태**: 확정 (2026-03-19)

**맥락**: 공용 풀에 리소스 생성과 agent에 할당을 2단계로 분리할 것인가

**결정**: `cc-company agent <name> add subagent <name>` — 공용 풀에 없으면 생성 + 할당을 1단계로 수행. 이미 존재하면 할당만.

**근거**:
- 실제 사용 시나리오에서 "이 agent에 이 기술을 추가"가 시작점
- 2단계 분리는 DX 저하
- 할당 없이 공용 풀에만 생성하는 경로는 별도 커맨드로 제공 (드문 케이스)

---

## ADR-006: 실행 로그 저장 범위

**상태**: 확정 (2026-03-19)

**맥락**: 실행 로그에 메타데이터만 저장할 것인가, stdout/stderr도 포함할 것인가

**결정**: stdout/stderr 포함하여 전체 저장

**근거**:
- 향후 대시보드에서 실행 결과를 보여주려면 stdout이 필요
- 로컬 디스크에 JSON 파일 저장은 부담이 아님

---

## ADR-007: 대시보드 확장 대비 — ConfigStore 추상화

**상태**: 확정 (2026-03-19)

**맥락**: MVP는 CLI-only지만, 가설 검증 후 대시보드(웹 UI) 확장이 예정됨

**결정**: IStore 인터페이스로 설정 읽기/쓰기 추상화. MVP는 fs-store 구현체, 대시보드 연동 시 api-store로 교체.

**근거**:
- CLI와 대시보드가 같은 데이터 소스를 공유해야 함
- 추상화 레이어는 최소한의 투자로 확장성 확보
- 오버엔지니어링이 아닌 전환 비용 절감

---

## ADR-008: 동시 실행 허용

**상태**: 확정 (2026-03-19)

**맥락**: 여러 agent를 동시에 실행하거나, 같은 agent를 중복 실행할 수 있는가

**결정**: 전부 허용. 제한 없음.

**근거**:
- 로그 파일명에 `{timestamp}-{uuid}` 사용으로 충돌 방지
- 실행 제한은 사용자 판단에 위임

---

## ADR-009: config 버전 관리

**상태**: 확정 (2026-03-19)

**맥락**: .cc-company/ 스키마가 변경될 때 기존 설정 호환성 처리

**결정**: config.json에 version 필드를 포함. MVP에서는 마이그레이션 로직 미구현.

**근거**:
- 아직 사용자가 없으므로 스키마 변경 시 `cc-company init --force`로 대응 가능
- version 필드를 지금 심어두면 향후 마이그레이션 로직 추가 시 대응 가능

---

## ADR-010: init 멱등성

**상태**: 확정 (2026-03-19)

**맥락**: .cc-company/가 이미 존재할 때 `cc-company init` 동작

**결정**: 이미 존재하면 에러. `--force` 플래그로 덮어쓰기 옵션 제공.

**근거**:
- 사용자 설정을 실수로 날리는 것 방지
- 머지 로직은 구현 복잡도 대비 가치 낮음

---

## ADR-011: run command의 prompt optional화 및 -p first-class option 등록

**상태**: 확정 (2026-03-19)

**맥락**: 현재 run command는 `<agent>` `<prompt>` 두 개의 필수 인자를 받으며, `-p`는 passthrough flag로 처리된다. 사용자가 prompt 없이 interactive TUI를 시작하고 싶은 니즈가 있고, cc-company가 `-p` 여부를 인식해야 mode별 로직(로깅 전략, prompt 필수 여부 validation 등)을 분기할 수 있다.

**결정**:
1. `<prompt>`를 optional (`[prompt]`)로 변경. `-`로 시작하지 않는 첫 번째 인자를 prompt로 취급.
2. `-p`를 cc-company의 first-class option으로 등록. commander `.option('-p, --print')`로 파싱하되, 동시에 Claude Code CLI에도 전달.
3. `-p` 없이 실행하면 interactive TUI 모드, `-p`로 실행하면 print (headless) 모드.
4. `-p` 사용 시 prompt는 필수. 없으면 에러.
5. RunLog에 `mode` 필드 추가, `prompt`는 nullable.
6. `startedAt`은 spawn 직전, `finishedAt`은 spawn 완료 후 기록 (interactive 세션의 실제 소요 시간 반영).

**근거**:
- ADR-003에서 "패스스루 전략"을 확정했지만, `-p`는 cc-company 자체의 동작 분기에 필요한 유일한 flag. 패스스루 원칙을 깨는 것이 아니라, "인식 + 전달"의 하이브리드 접근.
- interactive mode는 Claude Code의 핵심 UX. 이를 지원하지 않으면 cc-company의 가치가 print mode에만 한정됨.
- prompt optional화로 `cc-company run developer`라는 최소 입력으로 agent를 실행할 수 있어 DX 향상.

---

## ADR-012: Subagent/Skill 저장 형식을 JSON에서 Frontmatter MD로 전환

**상태**: 확정 (2026-03-19)

**맥락**: subagent/skill 리소스의 저장 형식을 `.json`에서 YAML frontmatter를 포함한 `.md` 파일로 변경한다.

**결정**: prompt 필드가 JSON 문자열로 저장되면 가독성이 극히 떨어진다. 마크다운 본문으로 관리하면 IDE에서 넓게 보고 편집할 수 있다.

**구현**:
- frontmatter (YAML, `---` 구분자): `name`, `description`, 그리고 Claude Code 호환 optional 필드들 (`model`, `tools`, `disallowedTools`, `maxTurns`, `permissionMode` 등)
- 마크다운 본문: 기존 `prompt` 필드의 내용. 런타임에서 파싱하여 `SubagentConfig.prompt`로 주입.
- 파싱 라이브러리: `gray-matter` (dependencies)
- Hook은 JSON 유지 (config 필드가 구조화된 JSON이므로 md 변환 부자연스러움)

**영향**: `.cc-company/subagents/*.json` → `*.md`, `.cc-company/skills/*.json` → `*.md`. 런타임 인터페이스(SubagentConfig, SkillConfig) 유지.

---

## ADR-013: Skill 저장 형식을 단일 MD에서 디렉토리로 전환

**상태**: 확정 (2026-03-22)

**맥락**: Anthropic 공식 skills 프레임워크는 디렉토리 단위(SKILL.md + scripts/, references/, assets/)로 관리. 현재 cc-company는 단일 `.md` 파일. 보조 리소스(스크립트, 참조 문서, 템플릿 등)를 함께 관리할 수 없음.

**결정**: `skills/{name}/SKILL.md` 디렉토리 구조로 전환. `resources` 필드를 SKILL.md frontmatter에 매니페스트로 포함. 런타임 디렉토리 스캔이 아닌 메타데이터 기반 — 향후 원격 서버 호스팅(api-store) 전환 시 필요한 파일만 fetch 가능하도록.

**마이그레이션**: 기존 단일 `.md` 파일 감지 시 자동으로 디렉토리 형식으로 변환. 임시 코드로 명시적 주석 처리.

---

## ADR-014: `--add-dir` passthrough 차단 및 내부 사용

**상태**: 확정 (2026-03-22)

**맥락**: Claude Code CLI의 `--add-dir` 플래그는 추가 디렉토리 내 `.claude/skills/`를 자동 로드한다. cc-company가 agent에 할당된 skills를 임시 디렉토리에 복사하여 `--add-dir`로 전달하는 방식을 사용한다.

**결정**: `--add-dir`을 cc-company 내부 전용으로 사용. 사용자가 passthrough로 전달하면 에러. `--add-dir` 차단 검증은 run.service(서비스 레이어)에서 수행 — command 레이어가 아닌 서비스 레이어에서 검증해야 테스트 가능.

**임시 디렉토리**: `.cc-company/.tmp/run-{uuid}/.claude/skills/`에 skill 디렉토리 복사. `try/finally`로 정리 + 다음 run 시 1시간 이상 stale 디렉토리 자동 삭제.

---

## ADR-015: Soul entry 식별 방식 — 파일별 auto-increment 정수 ID

**상태**: 확정 (2026-03-22)

**맥락**: soul TOML 파일(`/soul/` 하위)의 `[[entries]]` 항목을 스크립트로 조작할 때, 개별 항목을 안정적으로 참조할 방법이 필요. 선택지: (1) 배열 인덱스 기반, (2) 파일별 auto-increment 정수 ID, (3) UUID/해시.

**결정**: 파일별 auto-increment 정수 ID (`id` 필드)

**근거**:
- 인덱스 기반은 삭제 시 뒤 항목의 인덱스가 밀려 배치 처리에서 불안정
- 정수 ID는 삭제 후에도 기존 항목의 ID가 변하지 않아 안정적 참조 가능
- UUID/해시는 이 규모에서 과잉. 파일 내 유니크면 충분
- 새 항목 추가 시 `max(id) + 1`로 부여. AI가 파일을 읽고 직접 할당

---

## ADR-016: 에이전트별 GitHub 프로필 — gh CLI 멀티 계정 + 환경변수 주입

**상태**: 확정 (2026-03-22)

**맥락**: cc-company로 생성한 agent들이 commit/push/PR 시 서로 다른 GitHub 계정을 사용할 수 있어야 한다. GitHub에서 "누가 했는가"는 두 레이어로 나뉜다: Git commit identity (author/committer)와 GitHub API identity (push/PR 권한). 둘 다 에이전트별로 분리해야 한다.

**결정**: gh CLI 멀티 계정 + 환경변수 주입

**근거**:
- gh CLI v2.40+는 네이티브 멀티 계정을 지원 (`gh auth login`으로 복수 계정 등록, `gh auth token --user X`로 토큰 추출)
- `GH_TOKEN` 환경변수로 subprocess 단위 GitHub API 격리 가능 (병렬 실행 안전)
- `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` 환경변수로 Git identity 격리
- 별도 credential store나 SSH 키 관리 불필요 — gh CLI의 기존 인프라 활용
- agent.json에 `gh_user` 필드만 추가하면 되므로 스키마 변경 최소
- 프로필 정보(name, email)는 `gh api /user`로 동적 resolve하여 DRY 유지
- 15분 in-memory 캐시로 반복 호출 절감

**구현 위치**:
- `src/claude-runner/env-builder.ts` (신규) — gh_user → env 변환 전담
- `src/claude-runner/spawner.ts` — env 파라미터 추가
- `src/services/run.service.ts` — env-builder 호출 → spawner 전달
- `scripts/run-phases.py` — task index.json의 gh_user 필드 기반 동일 로직

---

## ADR-017: Ticket 기반 작업 관리 시스템

**상태**: 확정 (2026-03-22)

**맥락**: 현재 `cc-company run <agent>`는 1회성 실행이다. agent들이 지속적으로 실행되면서 할당된 작업(ticket)을 처리하는 방식으로 전환이 필요하다. ticket에는 참조(cc) 기능이 있어, 참조된 agent들이 수신확인 후 assignee가 작업을 시작할 수 있다.

**결정**: Ticket 기반 작업 관리 시스템 도입

**설계**:
- Ticket 타입: `task` (실제 작업), `cc_review` (참조 확인 요청)
- cc가 있는 ticket 생성 시, cc된 agent 수만큼 `cc_review` ticket도 함께 생성
- 모든 `cc_review` 완료 시 원본 `task`의 상태가 `blocked` → `ready`로 전환
- Ticket 상태: `blocked`, `ready`, `in_progress`, `completed`, `failed`, `cancelled`
- 각 agent는 자신에게 할당된 `ready` ticket을 priority → createdAt 순으로 처리
- 낙관적 락(version 필드)으로 동시성 제어

---

## ADR-018: Ticket Server — 파일 저장 + HTTP API

**상태**: 확정 (2026-03-22)

**맥락**: agent 프로세스들이 ticket 저장소에 접근하는 방식을 결정해야 한다. 향후 GUI 대시보드 연동과 원격 서버 전환을 고려해야 한다.

**결정**: 파일 저장 + HTTP API

**근거**:
- 파일 저장: `.cc-company/tickets/{id}.json`에 저장. git 추적 가능, 단순
- HTTP API: 각 agent가 REST API로 ticket CRUD. GUI 대시보드 연동 자연스러움
- ITicketStore 인터페이스로 추상화 → 향후 원격 서버 전환 시 API 스펙 유지

**구현 위치**:
- `src/server/` — Express 기반 HTTP 서버
- `src/store/ticket-store.ts` — ITicketStore 인터페이스
- `src/store/fs-ticket-store.ts` — 파일 기반 구현

---

## ADR-019: Agent 프로세스 관리 — fork + idle timeout

**상태**: 확정 (2026-03-22)

**맥락**: `cc-company start` 실행 시 여러 agent 프로세스를 관리하는 방식을 결정해야 한다.

**결정**: child_process.fork() + idle timeout (3분)

**근거**:
- `cc-company start` 시 Ticket Server 시작 + 모든 agent worker 프로세스 fork
- 각 agent는 polling loop로 ticket 조회 (5초 간격)
- 3분간 작업 없으면 해당 agent 자동 종료
- 모든 agent 종료 후에도 Ticket Server는 유지 (사용자가 Ctrl+C로 종료)
- graceful shutdown: SIGINT/SIGTERM 핸들링

**구현 위치**:
- `src/services/orchestrator.service.ts` — 전체 시스템 부트스트랩
- `src/services/agent-runner.service.ts` — 개별 agent polling loop
- `src/agent-worker.ts` — fork용 엔트리포인트

---

## ADR-020: Webhook 기반 PR 이벤트 연동

**상태**: 확정 (2026-03-23)

**맥락**: agent가 작성한 PR에 review comment나 approve가 달리면 자동으로 ticket을 생성하여 agent가 대응할 수 있게 해야 한다. GitHub App vs repo-level webhook, 로컬 개발 환경에서의 webhook 수신 방법을 결정해야 한다.

**결정**: Repo-level webhook + smee.io (로컬) / 자체 SSE (원격)

**근거**:
- GitHub App은 설치 복잡도가 높고, MVP 단계에서 과잉
- Repo-level webhook은 설정이 단순하고 필요한 기능 충분
- 로컬 환경은 퍼블릭 IP가 없으므로 smee.io 프록시 사용
- 향후 원격 서버 모드에서는 자체 SSE 엔드포인트로 대체 (smee 노출 없이)
- IWebhookReceiver 인터페이스로 추상화하여 전환 비용 최소화

**구현 위치**:
- `src/webhook-receiver/` — 수신 추상화
- `src/server/routes/webhooks.ts` — HTTP 엔드포인트
- `src/services/pr-event.service.ts` — 이벤트 처리

---

## ADR-021: Ticket metadata 범용 필드

**상태**: 확정 (2026-03-23)

**맥락**: webhook으로 생성된 ticket은 PR 번호, comment ID 등 추가 정보가 필요하다. 중복 ticket 방지, merge 시 PR 정보 참조 등에 사용된다. ticket 스키마에 어떻게 추가할 것인가.

**결정**: `metadata` 필드 (범용 JSON 객체)

**근거**:
- `prNumber` 같은 단일 필드보다 확장성 있음
- 향후 Jira, Slack 등 다른 소스 연동 시 해당 키만 추가
- `metadata.source`로 생성 출처 추적 (user/webhook/agent)
- `metadata.github`로 GitHub 관련 정보 묶음

**스키마**:
```typescript
interface TicketMetadata {
  source?: 'user' | 'webhook' | 'agent'
  github?: {
    repo: string
    prNumber: number
    prUrl: string
    commentIds?: string[]
    eventType?: 'review_comment' | 'review_approved' | 'conflict_resolve'
    reviewers?: string[]
  }
}
```
