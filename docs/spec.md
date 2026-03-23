# cc-company CLI Specification

## Overview

cc-company는 Claude Code를 직무(agent) 단위로 조직화하여 실행할 수 있게 해주는 CLI 도구다.
핵심 가치: "CEO처럼 목표를 제시하면, AI agent가 알아서 실행한다."

## CLI Commands

### 프로젝트 초기화

```bash
cc-company init          # .cc-company/ 구조 생성 + 기본 agent 3개 (developer, designer, hr)
cc-company init --force  # 기존 .cc-company/ 덮어쓰기
```

### Agent 실행

```bash
cc-company run <agent-name>                                    # interactive TUI
cc-company run <agent-name> <prompt>                           # interactive + 초기 prompt
cc-company run <agent-name> -p <prompt>                        # print mode (headless)
cc-company run <agent-name> -p <prompt> --output-format json   # print mode + JSON 출력
```

- 포지셔널 인자: `<agent-name>` 필수, `[prompt]` 선택
- `-p` (print mode): cc-company가 인식하는 first-class option. Claude Code CLI에도 동시에 전달된다. `-p` 사용 시 `<prompt>`는 필수.
- `-p` 없이 실행하면 Claude Code의 interactive TUI가 터미널에 표시된다.
- `-p`, `<prompt>` 외의 나머지 플래그는 전부 Claude Code CLI에 패스스루.
- stdout/stderr는 그대로 사용자에게 파이프 (`stdio: 'inherit'`).

### Agent 관리

```bash
cc-company agent create <name>    # agent 생성
cc-company agent list             # agent 목록 조회
cc-company agent remove <name>    # agent 삭제
cc-company agent <name> show      # agent 상세 조회 (할당된 리소스 포함)
```

### 데몬 모드 실행

```bash
cc-company start          # Ticket Server + 모든 agent worker 시작
```

- Ticket Server를 시작하고 모든 등록된 agent의 worker 프로세스를 spawn
- 각 agent worker는 자신에게 할당된 ticket을 polling하며 대기
- 3분간 작업 없으면 해당 agent worker 자동 종료
- 모든 agent 종료 후에도 서버는 유지 (Ctrl+C로 종료)
- 기존 `cc-company run <agent>` 명령어는 1회성 실행으로 유지

### Ticket 관리

```bash
cc-company ticket create --assignee <agent> [--cc <agents>] --title <title> --prompt <prompt> [--priority <p>]
cc-company ticket list [--status <s>] [--assignee <a>]
cc-company ticket show <id>
cc-company ticket cancel <id>
```

### Webhook 관리

```bash
cc-company webhook setup <smee-url>  # smeeUrl을 config에 저장, enabled=true
cc-company webhook status            # 현재 webhook 설정 표시
cc-company webhook disable           # webhook.enabled = false
```

- `--cc`: 쉼표로 구분된 agent 목록 (예: `--cc designer,hr`)
- `--priority`: `low`, `normal`, `high`, `urgent` (기본값: `normal`)
- cc가 있으면 원본 ticket은 `blocked` 상태로 생성되고, cc된 agent 수만큼 `cc_review` ticket이 함께 생성됨
- `cc_review` ticket 완료 시 의견이 원본 ticket의 comments에 복사됨

### Agent 리소스 할당

```bash
cc-company agent <agent-name> add subagent <name>       # 공용 풀에 없으면 생성 + 할당
cc-company agent <agent-name> add skill <name>
cc-company agent <agent-name> add hook <name>
cc-company agent <agent-name> remove subagent <name>    # 할당 해제
cc-company agent <agent-name> remove skill <name>
cc-company agent <agent-name> remove hook <name>
```

### 공용 리소스 관리

```bash
cc-company subagent add <name>       # 공용 풀에만 생성 (할당 없이)
cc-company subagent list
cc-company subagent remove <name>    # 삭제 (할당된 agent 있으면 경고)

cc-company skill add|list|remove <name>
cc-company hook add|list|remove <name>
```

## .cc-company/ 디렉토리 구조

```
.cc-company/
├── config.json              # 프로젝트 레벨 설정 (version 포함)
├── subagents/               # 공용 subagent 풀
│   ├── git-expert.md
│   └── code-reviewer.md
├── skills/                  # 공용 skills 풀
│   └── deploy/
│       ├── SKILL.md
│       ├── scripts/
│       ├── references/
│       └── assets/
├── hooks/                   # 공용 hooks 풀
│   └── pre-commit.json
├── agents/
│   ├── developer/
│   │   ├── agent.json       # 메타데이터 + 공용 리소스 참조
│   │   ├── prompt.md        # 시스템 프롬프트
│   │   ├── settings.json    # claude code settings
│   │   └── mcp.json         # MCP 서버 설정
│   ├── designer/
│   │   └── ...
│   └── hr/
│       └── ...
├── .tmp/                    # run 시 임시 디렉토리 (자동 생성/정리)
│   └── run-{uuid}/
│       └── .claude/skills/  # --add-dir용 skill 복사본
└── runs/                    # 실행 로그
    └── 2026-03-19T100000-uuid.json
```

## agent.json 스키마

```json
{
  "name": "developer",
  "description": "소프트웨어 개발 전담 에이전트",
  "gh_user": "dev-bot",
  "can_delegate": true,
  "subagents": ["git-expert", "code-reviewer"],
  "skills": ["deploy"],
  "hooks": ["pre-commit"]
}
```

- 모든 리소스 필드는 optional
- 값은 공용 풀의 리소스 이름(식별자) 배열
- `gh_user`: optional. gh CLI에 등록된 GitHub 계정명. 설정 시 해당 계정의 토큰과 Git identity로 commit/push/PR 수행. 미설정 시 현재 활성 계정 사용.
- `can_delegate`: optional. true이면 다른 agent에게 ticket 위임(생성) 가능. 기본값 false.

## Ticket JSON 스키마

```json
{
  "id": "uuid",
  "title": "버그 수정",
  "prompt": "로그인 버튼이 동작하지 않는 버그를 수정해주세요.",
  "type": "task",
  "parentTicketId": null,
  "ccReviewTicketIds": ["cc-001", "cc-002"],
  "assignee": "developer",
  "priority": "normal",
  "status": "ready",
  "createdBy": "user",
  "createdAt": "2026-03-22T10:00:00+0900",
  "startedAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "result": null,
  "comments": [],
  "metadata": {
    "source": "webhook",
    "github": {
      "repo": "owner/repo",
      "prNumber": 42,
      "prUrl": "https://github.com/owner/repo/pull/42",
      "commentIds": ["c1", "c2"],
      "eventType": "review_comment",
      "reviewers": ["reviewer1"]
    }
  },
  "version": 1
}
```

- `type`: `task` (실제 작업) 또는 `cc_review` (참조 확인 요청)
- `parentTicketId`: `cc_review`인 경우 원본 ticket ID
- `ccReviewTicketIds`: `task`인 경우 연결된 `cc_review` ticket ID 목록
- `status`: `blocked`, `ready`, `in_progress`, `completed`, `failed`, `cancelled`. 허용 전이: `blocked→ready|cancelled`, `ready→in_progress|cancelled`, `in_progress→completed|failed`. 터미널 상태(`completed`, `failed`, `cancelled`)에서는 전이 불가.
- `priority`: `low`, `normal`, `high`, `urgent`. `cc_review`는 parent의 priority를 따름
- `createdBy`: `user` 또는 agent name (위임 시)
- `result`: 완료 시 `{ exitCode: number, logPath: string }`
- `comments`: `[{ id, author, content, createdAt }]`
- `metadata`: 선택적 필드. ticket 생성 출처 및 관련 정보
- `metadata.source`: `'user'` | `'webhook'` | `'agent'`
- `metadata.github`: GitHub PR 관련 정보 (webhook으로 생성된 경우)
- `metadata.github.eventType`: `'review_comment'` | `'review_approved'` | `'conflict_resolve'`
- `version`: 낙관적 락용 버전 번호

## config.json 확장

```json
{
  "version": "1.0.0",
  "ticketServer": {
    "port": 3847,
    "pollingIntervalMs": 5000,
    "idleTimeoutMs": 180000,
    "heartbeatTimeoutMs": 30000
  },
  "webhook": {
    "enabled": true,
    "secret": "github-webhook-secret",
    "smeeUrl": "https://smee.io/xxx",
    "approveCondition": "any"
  }
}
```

필드 설명:
- `webhook.enabled`: webhook 수신 활성화 여부
- `webhook.secret`: GitHub webhook secret (signature 검증용, 선택)
- `webhook.smeeUrl`: smee.io 채널 URL (로컬 개발용, 선택)
- `webhook.approveCondition`: `'any'` (기본, 최소 1개 approve) | `'all'` (모든 requested reviewer approve)

## Subagent MD 형식

YAML frontmatter + 마크다운 본문 구조:

```markdown
---
name: git-expert
description: Git 버전 관리 전문가
model: sonnet          # optional
tools: Read, Glob, Grep  # optional
maxTurns: 10           # optional
---

You are a Git version control expert...
```

**필수 필드**: `name`, `description`
**Optional 필드**: `model`, `tools`, `disallowedTools`, `maxTurns`, `permissionMode`

## Skill 디렉토리 형식

Anthropic 공식 skills 프레임워크를 따르는 디렉토리 구조:

```
skills/
└── deploy/
    ├── SKILL.md              # 메타데이터(YAML frontmatter) + 지시문 (필수)
    ├── scripts/              # 실행 가능한 코드, 유틸리티 (관례)
    ├── references/           # 참조 문서, 스키마 (관례)
    └── assets/               # 템플릿, 이미지 (관례)
```

### SKILL.md frontmatter

```yaml
---
name: deploy
description: 배포 프로세스 관리
resources:
  - scripts/run-deploy.sh
  - references/env-schema.json
allowedTools: Bash, Read     # optional
model: sonnet                # optional
---
```

**필수 필드**: `name`, `description`
**Optional 필드**: `resources`, `model`, `allowedTools`, `context`, `agent`, `userInvocable`, `disableModelInvocation`, `argumentHint`

### Skill 파일 관리

```bash
cc-company skill add-file <skill-name> <file-path> --content <content>
cc-company skill add-file <skill-name> <file-path> --stdin
cc-company skill edit-file <skill-name> <file-path> --content <content>
cc-company skill edit-file <skill-name> <file-path> --stdin
cc-company skill remove-file <skill-name> <file-path>
```

- `<file-path>`는 skill 디렉토리 기준 상대경로 (예: `scripts/run-deploy.sh`)
- `add-file`: 파일 생성 + SKILL.md resources에 자동 등록
- `remove-file`: 파일 삭제 + resources에서 자동 제거
- `--content`와 `--stdin` 중 하나 필수. 둘 다 없으면 에러.

### Skill 상세 조회

```bash
cc-company skill show <name>    # 메타데이터 + 파일 목록 + resources 불일치 경고
```

## Hook JSON 형식

Hook은 config 필드가 구조화된 JSON이므로 `.json` 형식을 유지한다.

## 실행 로그 스키마

```json
{
  "id": "uuid",
  "agent": "developer",
  "prompt": "버그 고쳐줘",
  "mode": "interactive",
  "startedAt": "2026-03-19T10:00:00Z",
  "finishedAt": "2026-03-19T10:05:00Z",
  "exitCode": 0,
  "flags": ["--model", "opus"],
  "stdout": "",
  "stderr": ""
}
```

- `mode`: `"interactive"` 또는 `"print"`. `-p` flag 유무로 결정.
- `prompt`: interactive mode에서 prompt 없이 시작한 경우 `null`.

## Task Index 스키마

### `/tasks/index.json` (top-level)

```json
{
  "repositoryUrl": "https://github.com/owner/repo",
  "tasks": [
    {
      "id": 0,
      "name": "mvp",
      "dir": "0-mvp",
      "status": "completed",
      "created_at": "2026-03-19T01:55:23+09:00",
      "completed_at": "2026-03-19T02:29:19+09:00",
      "pr_number": 1,
      "pr_url": "https://github.com/owner/repo/pull/1"
    }
  ]
}
```

- `repositoryUrl`: GitHub repository URL. 최초 PR 생성 시 자동 추가.
- `pr_number`: PR 번호. PR 생성 시 자동 기록.
- `pr_url`: PR 전체 URL. PR 생성 시 자동 기록.

## Claude Code 플래그 매핑

| agent 설정 | Claude Code 플래그 |
|---|---|
| prompt.md | `--append-system-prompt-file` |
| subagents (resolved) | `--agents '{...}'` |
| mcp.json | `--mcp-config` |
| settings.json | `--settings` |
| skills (resolved) | `--add-dir` (임시 디렉토리 경로) |

## 기본 Agent 템플릿

`cc-company init` 시 생성되는 기본 agent 3종:

- **developer**: 소프트웨어 개발 전담. 기본 subagent/skills 포함.
- **designer**: UI/UX 디자인 전담. 기본 subagent/skills 포함.
- **hr**: 인사/조직 관리 전담. 기본 subagent/skills 포함.

각 agent는 prompt.md + 직무에 맞는 subagent/skills/hooks 풀세트로 제공.
