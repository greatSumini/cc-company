# Configuration

agentinc의 설정 파일 스키마.

## Directory Structure

```
.agentinc/
├── config.json           # 프로젝트 설정
├── agents/
│   └── <agent-name>/
│       ├── agent.json    # agent 메타데이터
│       ├── prompt.md     # 시스템 프롬프트
│       ├── settings.json # Claude Code settings (optional)
│       └── mcp.json      # MCP 서버 (optional)
├── subagents/            # 공용 subagent
│   └── <name>.md
├── skills/               # 공용 skill
│   └── <name>/
│       └── SKILL.md
├── hooks/                # 공용 hook
│   └── <name>.json
└── runs/                 # 실행 로그
```

## config.json

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
    "smeeUrl": "https://smee.io/xxx",
    "secret": "your-secret",
    "approveCondition": "any"
  }
}
```

## agent.json

```json
{
  "name": "developer",
  "description": "소프트웨어 개발 전담 에이전트",
  "gh_user": "github-username",
  "can_delegate": true,
  "subagents": ["git-expert", "code-reviewer"],
  "skills": ["deploy"],
  "hooks": ["pre-commit"]
}
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | agent 식별자 |
| `description` | no | 설명 |
| `gh_user` | no | GitHub 계정명 (webhook 매칭용) |
| `can_delegate` | no | 다른 agent에게 ticket 위임 가능 여부 |
| `subagents` | no | 할당된 subagent 목록 |
| `skills` | no | 할당된 skill 목록 |
| `hooks` | no | 할당된 hook 목록 |

## Subagent (frontmatter MD)

```markdown
---
name: git-expert
description: Git 버전 관리 전문가
model: sonnet
tools: Read, Glob, Grep
maxTurns: 10
---

You are a Git version control expert...
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | subagent 이름 |
| `description` | yes | 설명 |
| `model` | no | 사용할 모델 |
| `tools` | no | 허용 도구 |
| `maxTurns` | no | 최대 턴 수 |

## Skill (directory)

```
skills/<name>/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

### SKILL.md frontmatter

```yaml
---
name: deploy
description: 배포 프로세스 관리
resources:
  - scripts/run-deploy.sh
  - references/env-schema.json
allowedTools: Bash, Read
---
```

## Claude Code Flag Mapping

| Agent 설정 | Claude Code 플래그 |
|---|---|
| `prompt.md` | `--append-system-prompt-file` |
| subagents | `--agents '{...}'` |
| `mcp.json` | `--mcp-config` |
| `settings.json` | `--settings` |
| skills | `--add-dir` |
