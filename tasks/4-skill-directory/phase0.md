# Phase 0: 문서 업데이트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/docs/testing.md`
- `/docs/test-cases.md`
- `/docs/external/claude-skills-framework.md`

## 작업 내용

이번 task는 Skill 저장 형식을 단일 `.md` 파일에서 디렉토리 단위(`SKILL.md` + 보조 리소스)로 전환하고, `--add-dir` 기반 Claude CLI 통합을 구현한다.

아래 문서들을 업데이트하라. 기존 내용의 맥락과 톤을 유지하되, 변경되는 부분만 정확히 반영하라.

### 1. `/docs/adr.md` — ADR 2개 추가

**ADR-013: Skill 저장 형식을 단일 MD에서 디렉토리로 전환**

- 맥락: Anthropic 공식 skills 프레임워크는 디렉토리 단위(SKILL.md + scripts/, references/, assets/)로 관리. 현재 cc-company는 단일 `.md` 파일. 보조 리소스(스크립트, 참조 문서, 템플릿 등)를 함께 관리할 수 없음.
- 결정: `skills/{name}/SKILL.md` 디렉토리 구조로 전환. `resources` 필드를 SKILL.md frontmatter에 매니페스트로 포함. 런타임 디렉토리 스캔이 아닌 메타데이터 기반 — 향후 원격 서버 호스팅(api-store) 전환 시 필요한 파일만 fetch 가능하도록.
- 마이그레이션: 기존 단일 `.md` 파일 감지 시 자동으로 디렉토리 형식으로 변환. 임시 코드로 명시적 주석 처리.

**ADR-014: `--add-dir` passthrough 차단 및 내부 사용**

- 맥락: Claude Code CLI의 `--add-dir` 플래그는 추가 디렉토리 내 `.claude/skills/`를 자동 로드한다. cc-company가 agent에 할당된 skills를 임시 디렉토리에 복사하여 `--add-dir`로 전달하는 방식을 사용한다.
- 결정: `--add-dir`을 cc-company 내부 전용으로 사용. 사용자가 passthrough로 전달하면 에러. `--add-dir` 차단 검증은 run.service(서비스 레이어)에서 수행 — command 레이어가 아닌 서비스 레이어에서 검증해야 테스트 가능.
- 임시 디렉토리: `.cc-company/.tmp/run-{uuid}/.claude/skills/`에 skill 디렉토리 복사. `try/finally`로 정리 + 다음 run 시 1시간 이상 stale 디렉토리 자동 삭제.

### 2. `/docs/spec.md` — 변경 사항

**Skill 섹션 전체 교체:**

기존 "Skill MD 형식" 섹션을 아래로 교체:

```markdown
## Skill 디렉토리 형식

Anthropic 공식 skills 프레임워크를 따르는 디렉토리 구조:

\`\`\`
skills/
└── deploy/
    ├── SKILL.md              # 메타데이터(YAML frontmatter) + 지시문 (필수)
    ├── scripts/              # 실행 가능한 코드, 유틸리티 (관례)
    ├── references/           # 참조 문서, 스키마 (관례)
    └── assets/               # 템플릿, 이미지 (관례)
\`\`\`

### SKILL.md frontmatter

\`\`\`yaml
---
name: deploy
description: 배포 프로세스 관리
resources:
  - scripts/run-deploy.sh
  - references/env-schema.json
allowedTools: Bash, Read     # optional
model: sonnet                # optional
---
\`\`\`

**필수 필드**: `name`, `description`
**Optional 필드**: `resources`, `model`, `allowedTools`, `context`, `agent`, `userInvocable`, `disableModelInvocation`, `argumentHint`
```

**CLI Commands 섹션에 추가:**

```markdown
### Skill 파일 관리

\`\`\`bash
cc-company skill add-file <skill-name> <file-path> --content <content>
cc-company skill add-file <skill-name> <file-path> --stdin
cc-company skill edit-file <skill-name> <file-path> --content <content>
cc-company skill edit-file <skill-name> <file-path> --stdin
cc-company skill remove-file <skill-name> <file-path>
\`\`\`

- `<file-path>`는 skill 디렉토리 기준 상대경로 (예: `scripts/run-deploy.sh`)
- `add-file`: 파일 생성 + SKILL.md resources에 자동 등록
- `remove-file`: 파일 삭제 + resources에서 자동 제거
- `--content`와 `--stdin` 중 하나 필수. 둘 다 없으면 에러.
```

**`.cc-company/` 디렉토리 구조에 반영:**

skills 부분을 디렉토리 형식으로 변경하고, `.tmp/` 경로 추가:

```
├── skills/
│   └── deploy/
│       ├── SKILL.md
│       ├── scripts/
│       ├── references/
│       └── assets/
├── .tmp/                    # run 시 임시 디렉토리 (자동 생성/정리)
│   └── run-{uuid}/
│       └── .claude/skills/  # --add-dir용 skill 복사본
```

**Claude Code 플래그 매핑 테이블 변경:**

| agent 설정 | Claude Code 플래그 |
|---|---|
| skills (resolved) | `--add-dir` (임시 디렉토리 경로) |

`--plugin-dir` 행 제거. 기존 `skills/hooks (plugins)` → skills는 `--add-dir`로, hooks는 추후 별도 처리.

**`skill show` 커맨드 설명 추가:**

```markdown
cc-company skill show <name>    # 메타데이터 + 파일 목록 + resources 불일치 경고
```

### 3. `/docs/architecture.md` — 변경 사항

**IStore 인터페이스에 신규 메서드 추가:**

```typescript
// Skill file operations
addSkillFile(skillName: string, filePath: string, content: string): void
editSkillFile(skillName: string, filePath: string, content: string): void
removeSkillFile(skillName: string, filePath: string): void
getSkillFile(skillName: string, filePath: string): string
getSkillDir(skillName: string): string
```

**데이터 흐름 예시에 skill 전달 흐름 추가:**

run.service에서 skills resolve 후:
1. `.cc-company/.tmp/run-{uuid}/.claude/skills/` 생성
2. 할당된 skill 디렉토리 복사
3. `--add-dir .cc-company/.tmp/run-{uuid}` 플래그 추가
4. spawn 완료 후 try/finally로 임시 디렉토리 정리
5. spawn 전 stale temp(1시간 경과) 자동 삭제

**FlagBuilderInput 변경 반영:**

`pluginDirPath` → `addDirPath` 교체 설명.

### 4. `/docs/testing.md` — 변경 사항

테스트 범위 테이블의 store (fs-store) 행 설명에 "skill 디렉토리 CRUD, 파일 CRUD, 마이그레이션" 추가.

### 5. `/docs/test-cases.md` — 변경 사항

아래 테스트 케이스들을 추가/변경하라:

**frontmatter utils 섹션에 추가:**

```
[파싱 - Skill / resources]
✓ resources 배열 포함된 frontmatter → resources 필드 정상 파싱
✓ resources 미포함 → resources는 undefined

[직렬화 - Skill / resources]
✓ resources 있는 SkillConfig serialize → parse → 원본과 동일 (round-trip)
✓ resources가 undefined → 직렬화 시 resources 키 생략
```

**fs-store 섹션의 기존 Skill CRUD 4개를 아래로 교체:**

```
[Skill 디렉토리 CRUD]
✓ createSkill → skills/{name}/ 디렉토리 + SKILL.md + 서브디렉토리 스캐폴딩 생성
✓ getSkill → 디렉토리 내 SKILL.md 파싱하여 SkillConfig 반환
✓ listSkills → 디렉토리 순회로 전체 목록 반환
✓ removeSkill → 디렉토리 통째로 삭제
✓ 존재하지 않는 skill getSkill → 에러

[Skill 파일 CRUD]
✓ addSkillFile → 파일 생성 + SKILL.md resources에 자동 등록
✓ editSkillFile 존재하지 않는 파일 → 에러
✓ removeSkillFile → 파일 삭제 + resources에서 자동 제거
✓ removeSkillFile 존재하지 않는 파일 → 에러

[마이그레이션]
✓ skills/ 내 단일 .md 파일 → getSkill 시 디렉토리로 자동 변환 + 원본 제거
✓ 이미 디렉토리인 skill → 마이그레이션 스킵 (정상 동작)
```

**flag-builder 섹션 변경:**

기존 `--plugin-dir` 관련 테스트 2개 제거. 아래 추가:

```
[--add-dir]
✓ addDirPath 있으면 → --add-dir 플래그 생성
✓ addDirPath undefined → --add-dir 생략
```

**resource.service 섹션에 추가:**

```
[Skill show + 불일치 경고]
✓ showSkill → config + 파일 목록 반환
✓ showSkill resources 불일치 시 경고 출력
```

**run.service 섹션에 추가:**

```
[--add-dir 임시 디렉토리]
✓ skills 있는 agent run → .tmp/run-{uuid}/.claude/skills/ 에 디렉토리 복사
✓ skills 없는 agent run → .tmp 생성하지 않음, --add-dir 없음
✓ 실행 완료 후 임시 디렉토리 정리됨

[--add-dir 차단]
✓ passthroughFlags에 --add-dir 포함 → 에러

[stale 정리]
✓ 1시간 이상 경과한 .tmp/run-* 디렉토리 → run 시 자동 삭제
✓ 1시간 미만 .tmp/run-* → 삭제하지 않음

[resources 불일치 경고]
✓ resources에 등록됐지만 파일 없음 → console.warn
✓ 파일 존재하지만 resources에 미등록 → console.warn
```

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/4-skill-directory/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 문서만 수정한다. 코드는 건드리지 마라.
- 기존 문서의 톤과 형식을 유지하라. 새로운 스타일을 도입하지 마라.
- ADR 번호는 기존 마지막(ADR-012) 이후 순서대로.
- spec.md에서 기존 Skill 관련 내용을 정확히 찾아서 교체하라. 다른 섹션(Subagent, Hook)은 건드리지 마라.
