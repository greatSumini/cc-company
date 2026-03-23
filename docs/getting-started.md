# Getting Started

cc-company를 설치하고 첫 agent를 실행하는 방법.

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 설치 및 인증 완료

## Installation

```bash
npm install -g cc-company
```

## Initialize

프로젝트 루트에서:

```bash
cc-company init
```

`.cc-company/` 디렉토리가 생성되며, 기본 agent 3개가 포함됨:
- `developer` — 소프트웨어 개발
- `designer` — UI/UX 디자인
- `hr` — 인사/조직 관리

## Run an Agent

```bash
# Interactive TUI
cc-company run developer

# Interactive + initial prompt
cc-company run developer "Fix the login bug"

# Headless print mode (for scripts/CI)
cc-company run developer -p "Run all tests"
```

## Create Custom Agent

```bash
cc-company agent create backend-dev
```

생성된 agent 디렉토리:
```
.cc-company/agents/backend-dev/
├── agent.json    # metadata + resource refs
├── prompt.md     # system prompt
├── settings.json # Claude Code settings (optional)
└── mcp.json      # MCP servers (optional)
```

## Add Resources

```bash
# Add subagent
cc-company agent backend-dev add subagent db-expert

# Add skill
cc-company agent backend-dev add skill deploy
```

## Team Sharing

`.cc-company/`를 git에 커밋하면 팀 전체가 같은 agent 설정을 공유.

```bash
git add .cc-company/
git commit -m "Add cc-company agents"
```

## Next Steps

- [CLI Reference](cli-reference.md) — 전체 명령어
- [Configuration](configuration.md) — agent.json 스키마
- [Daemon Mode](daemon-mode.md) — 비동기 작업 처리
