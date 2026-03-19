# Phase 4: 기존 데이터 마이그레이션

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/2-frontmatter-md/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts`
- `/src/utils/frontmatter.ts` (serializeSubagentMd, serializeSkillMd 함수를 이해하라)
- `/src/store/fs-store.ts` (이제 `.md` 파일을 읽고 쓴다)

그리고 마이그레이션 대상 파일들을 확인하라:

- `/.cc-company/subagents/*.json` (현재 존재하는 모든 JSON 파일)
- `/.cc-company/skills/*.json` (현재 존재하는 모든 JSON 파일)

## 작업 내용

### 1. Subagent JSON → MD 변환

`/.cc-company/subagents/` 디렉토리에 있는 모든 `.json` 파일을 `.md` 파일로 변환하라.

**변환 규칙:**
- JSON 파일을 읽는다: `{ "name": "...", "description": "...", "prompt": "..." }`
- 동일한 이름의 `.md` 파일을 생성한다. YAML frontmatter에 `name`과 `description`을 넣고, 마크다운 본문에 `prompt` 내용을 넣는다.
- JSON에서 `\n`으로 이스케이프된 줄바꿈은 실제 줄바꿈으로 변환되어야 한다 (JSON.parse가 자동 처리).
- 변환 후 원본 `.json` 파일을 삭제한다.

**예시 변환:**

Before (`git-expert.json`):
```json
{
  "name": "git-expert",
  "description": "Git 버전 관리 전문가",
  "prompt": "You are a Git version control expert.\n\n## Core Competencies\n..."
}
```

After (`git-expert.md`):
```markdown
---
name: git-expert
description: Git 버전 관리 전문가
---

You are a Git version control expert.

## Core Competencies
...
```

**변환 대상 subagent 파일들 (확인 후 존재하는 것만 변환):**
- `git-expert.json`
- `code-reviewer.json`
- `ux-researcher.json`
- `recruiter.json`

### 2. Skill JSON → MD 변환

`/.cc-company/skills/` 디렉토리에 있는 모든 `.json` 파일을 동일한 규칙으로 `.md`로 변환하라.

**변환 대상 skill 파일들 (확인 후 존재하는 것만 변환):**
- `deploy.json`
- `design-system.json`
- `onboarding.json`
- `submit-pr-review.json`

### 3. 변환 검증

변환 후 다음을 확인하라:
- `/.cc-company/subagents/` 디렉토리에 `.json` 파일이 없어야 한다.
- `/.cc-company/skills/` 디렉토리에 `.json` 파일이 없어야 한다.
- 각 `.md` 파일이 올바른 frontmatter 구조를 갖고 있어야 한다.

### 4. 전체 검증

```bash
npm run build
npm test
```

### 5. dry-run으로 기존 agent 실행 검증

```bash
CC_DRY_RUN=1 node dist/index.js run developer "test"
```

이 명령이 정상적으로 실행되어야 한다 (exit code 0). dry-run 모드이므로 실제 claude CLI는 호출되지 않지만, subagent resolve → flag-builder → 출력 파이프라인이 정상 동작하는지 확인할 수 있다.

출력에 `--agents` 플래그와 해당 subagent의 JSON이 포함되어 있는지 확인하라.

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
CC_DRY_RUN=1 node dist/index.js run developer "test" # exit code 0, --agents 포함
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/2-frontmatter-md/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 소스 코드를 수정하지 마라. 이 phase는 데이터 마이그레이션만 수행한다.
- Hook JSON 파일(`/.cc-company/hooks/*.json`)을 건드리지 마라.
- Agent 디렉토리(`/.cc-company/agents/`)를 건드리지 마라.
- 변환 시 원본 JSON의 prompt 내용이 정확히 보존되는지 반드시 확인하라. 줄바꿈, 공백, 특수문자 등이 손실되면 안 된다.
- `/.cc-company/config.json`을 건드리지 마라.
