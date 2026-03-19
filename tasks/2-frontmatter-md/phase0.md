# Phase 0: 문서 업데이트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/docs/testing.md`
- `/docs/test-cases.md`

## 작업 내용

### 1. `/docs/adr.md` — ADR-012 추가

아래 ADR을 기존 ADR 목록 끝에 추가하라:

```
### ADR-012: Subagent/Skill 저장 형식을 JSON에서 Frontmatter MD로 전환

- **결정**: subagent/skill 리소스의 저장 형식을 `.json`에서 YAML frontmatter를 포함한 `.md` 파일로 변경한다.
- **이유**: prompt 필드가 JSON 문자열로 저장되면 가독성이 극히 떨어진다. 마크다운 본문으로 관리하면 IDE에서 넓게 보고 편집할 수 있다.
- **구현**:
  - frontmatter (YAML, `---` 구분자): `name`, `description`, 그리고 Claude Code 호환 optional 필드들 (`model`, `tools`, `disallowedTools`, `maxTurns`, `permissionMode` 등)
  - 마크다운 본문: 기존 `prompt` 필드의 내용. 런타임에서 파싱하여 `SubagentConfig.prompt`로 주입.
  - 파싱 라이브러리: `gray-matter` (dependencies)
  - Hook은 JSON 유지 (config 필드가 구조화된 JSON이므로 md 변환 부자연스러움)
- **영향**: `.cc-company/subagents/*.json` → `*.md`, `.cc-company/skills/*.json` → `*.md`. 런타임 인터페이스(SubagentConfig, SkillConfig) 유지.
```

### 2. `/docs/spec.md` — 디렉토리 구조 및 스키마 업데이트

spec.md에서 `.cc-company/` 디렉토리 구조를 설명하는 부분을 찾아 다음을 반영하라:

- `subagents/` 하위: `*.json` → `*.md` (YAML frontmatter + 마크다운 본문)
- `skills/` 하위: `*.json` → `*.md` (YAML frontmatter + 마크다운 본문)
- `hooks/`는 `*.json` 유지

subagent/skill의 스키마 설명 부분도 업데이트:

**Subagent MD 형식 예시:**
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

**Skill MD 형식 예시:**
```markdown
---
name: deploy
description: 배포 프로세스 관리
allowedTools: Bash, Read  # optional
model: sonnet             # optional
---

# Deploy Skill

Manages deployment processes...
```

Subagent frontmatter optional 필드: `model`, `tools`, `disallowedTools`, `maxTurns`, `permissionMode`
Skill frontmatter optional 필드: `model`, `allowedTools`, `context`, `agent`, `userInvocable`, `disableModelInvocation`, `argumentHint`

### 3. `/docs/architecture.md` — frontmatter 파싱 레이어 추가

architecture.md의 기술 스택 또는 레이어 설명 부분에 다음을 추가하라:

- **의존성**: `gray-matter` — YAML frontmatter 파싱
- **유틸 모듈**: `src/utils/frontmatter.ts` — subagent/skill MD 파일의 파싱(`parse*Md`)과 직렬화(`serialize*Md`)를 담당. fs-store에서 호출.
- Store 레이어 설명에서: subagent/skill은 `.md` 파일을 `gray-matter`로 파싱하여 frontmatter → 메타데이터, body → prompt로 분리

### 4. `/docs/testing.md` — frontmatter 유틸 테스트 범위 추가

테스트 범위 표에 다음 행을 추가하라:

| frontmatter (utils) | 유닛 | 철저히 | 파싱이 틀리면 prompt가 통째로 날아감 |

### 5. `/docs/test-cases.md` — frontmatter 유닛 테스트 케이스 추가

기존 테스트 케이스 목록에 다음 섹션을 추가하라:

```
## frontmatter utils (유닛, ~8개)

[파싱 - subagent]
✓ 정상적인 frontmatter + body → name, description, prompt 추출
✓ optional 필드(model, tools, maxTurns) 포함 → 해당 필드 파싱
✓ name 필드 누락 → 에러
✓ frontmatter 없는 순수 마크다운 → 에러
✓ 빈 body → prompt가 빈 문자열

[파싱 - skill]
✓ 정상적인 skill frontmatter + body → name, description, prompt 추출
✓ skill optional 필드(allowedTools, context, agent) 포함 → 해당 필드 파싱

[직렬화]
✓ serialize 후 parse → 원본과 동일 (round-trip)
```

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/2-frontmatter-md/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 코드를 수정하지 마라. 이 phase는 문서만 업데이트한다.
- 기존 문서의 다른 부분을 삭제하거나 훼손하지 마라. 추가/수정만 한다.
- `docs-diff.md`는 직접 작성하지 마라. `run-phases.py`가 자동 생성한다.
