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
  "subagents": ["git-expert", "code-reviewer"],
  "skills": ["deploy"],
  "hooks": ["pre-commit"]
}
```

- 모든 리소스 필드는 optional
- 값은 공용 풀의 리소스 이름(식별자) 배열

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
