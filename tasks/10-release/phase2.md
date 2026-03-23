# Phase 2: Slash Command + Release Notes 지침

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/release.md` (Phase 0에서 생성된 배포 프로세스 문서)
- `/tasks/10-release/docs-diff.md` (이번 task의 문서 변경 기록)
- `/scripts/release.py` (Phase 1에서 생성된 릴리스 스크립트)
- `/.claude/commands/plan-and-build.md` (기존 slash command 패턴 참고)
- `/prompts/task-create.md` (기존 prompt 파일 패턴 참고)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

두 개의 파일을 생성한다.

### 1. `/prompts/release-notes.md` — Release Notes 생성 지침

이 파일은 `/release` slash command가 참조하는 지침이다. Claude가 git log를 분석하여 release notes를 생성할 때 따라야 할 포맷과 규칙을 정의한다.

포함할 내용:

#### GitHub Release 본문 포맷

```markdown
## What's Changed

### Features
- 변경 내용 (#PR번호)

### Bug Fixes
- 변경 내용 (#PR번호)

### Other Changes
- 변경 내용 (#PR번호)

**Full Changelog**: https://github.com/{owner}/{repo}/compare/v{prev}...v{new}
```

#### CHANGELOG.md 엔트리 포맷

```markdown
## [x.y.z] - YYYY-MM-DD

### Features
- 변경 내용

### Bug Fixes
- 변경 내용
```

#### 작성 규칙
- git log에서 commit message를 읽어 카테고리별로 분류
- `feat:` → Features, `fix:` → Bug Fixes, 나머지 → Other Changes
- 카테고리에 해당 항목이 없으면 해당 섹션을 생략
- PR 번호가 commit message에 포함되어 있으면 GitHub Release 본문에 링크로 포함
- CHANGELOG.md에는 PR 번호를 포함하지 않음 (간결하게)
- commit message가 한국어/영어 혼용이면 있는 그대로 사용 (번역하지 마라)
- squash merge된 PR의 경우 PR 제목을 기준으로 작성
- chore, docs, refactor 등 사용자에게 영향이 없는 변경은 Other Changes로 분류하되, 너무 사소한 것(typo 수정, lint 등)은 생략

### 2. `/.claude/commands/release.md` — Slash Command

`$ARGUMENTS`를 첫 줄에 배치하고, 아래 흐름을 Claude에게 지시하는 마크다운을 작성한다.

#### 전체 구조

```markdown
$ARGUMENTS

위 인자를 버전 bump 타입(patch/minor/major)으로 사용한다.
인자가 없으면 `git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline`을 실행하여 변경 내역을 분석하고, patch 또는 minor 중 적절한 것을 추천한 뒤 사용자에게 확인을 받는다.

## 1단계: Pre-flight 체크

아래 항목을 순서대로 확인한다.

### 차단 항목 (하나라도 실패하면 중단하고 원인 진단)
1. `git rev-parse --abbrev-ref HEAD` — main 브랜치인지 확인
2. `git status --porcelain` — working tree가 clean한지 확인
3. `npm whoami` — npm 인증 상태 확인
4. `git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline` — 이전 태그 대비 변경사항이 존재하는지 확인. 변경사항이 없으면 릴리스할 것이 없다고 알리고 중단.

### 경고 항목 (결과를 보여주되 계속 진행)
5. `npm audit --omit=dev` — critical/high 취약점이 있으면 경고
6. `npm pack --dry-run 2>&1` — 포함 파일과 크기를 출력. 포함되면 안 되는 파일(.env, tests/, node_modules/ 등)이 있으면 경고

모든 체크 결과를 아래 형식의 테이블로 출력한다:

| 항목 | 상태 | 비고 |
|------|------|------|
| Branch | ✓ main | |
| Clean tree | ✓ | |
| npm auth | ✓ user@example.com | |
| Changes | ✓ 12 commits | |
| Audit | ⚠ 1 moderate | express 관련 |
| Pack size | ✓ 45.2 kB | |

## 2단계: Release Notes 생성

`/prompts/release-notes.md`를 읽고 해당 지침을 따른다.

1. `git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline`으로 변경 내역을 가져온다.
2. 필요시 개별 커밋의 상세 내용을 `git show --stat {hash}`로 확인한다.
3. CHANGELOG.md 엔트리 초안을 작성한다.
4. GitHub Release 본문 초안을 작성한다.
5. 두 초안을 사용자에게 보여주고 확인을 요청한다.
6. 수정 지시가 있으면 반영한다.
7. 확정되면:
   - CHANGELOG.md 파일 상단에 새 엔트리를 추가한다. 파일이 없으면 `# Changelog` 헤더와 함께 새로 생성한다.
   - `git add CHANGELOG.md`를 실행한다.

## 3단계: Release Script 실행

```bash
python3 scripts/release.py {bump-type}
```

이 스크립트가 수행하는 것:
- package.json version bump
- npm run build
- npm test
- git commit (package.json + CHANGELOG.md)
- git tag

스크립트 실패 시 에러 메시지를 확인하고 사용자에게 상황을 보고한다.

## 4단계: npm publish

사용자에게 `npm publish` 실행 여부를 확인한다. 확인을 받은 후에만 실행한다.

```bash
npm publish
```

실패 시 에러를 진단하고 사용자에게 보고한다.

## 5단계: GitHub Release

2단계에서 확정한 GitHub Release 본문으로 릴리스를 생성한다.

```bash
gh release create v{version} --title "v{version}" --notes "{release-notes-body}"
```

## 6단계: Post-publish 검증

아래 커맨드를 실행하여 배포 결과를 검증한다:

1. `npm view cc-company version` — 새 버전이 반영되었는가
2. `gh release view v{version}` — GitHub Release가 존재하는가

결과를 요약 테이블로 출력한다:

| 검증 항목 | 상태 |
|-----------|------|
| npm registry | ✓ v{version} |
| GitHub Release | ✓ v{version} |
```

#### 핵심 규칙
- `$ARGUMENTS`는 반드시 파일의 첫 번째 줄에 위치해야 한다. `plan-and-build.md`의 패턴을 따르라.
- 각 단계에서 사용자 확인이 필요한 곳을 명확히 표시하라: Release Notes 확인 (2단계), npm publish 확인 (4단계).
- 스크립트 경로는 `scripts/release.py`로 고정.
- `prompts/release-notes.md` 참조 시 절대경로(`/prompts/release-notes.md`)를 사용하라.

## Acceptance Criteria

```bash
test -f .claude/commands/release.md && echo "OK: release.md exists"
test -f prompts/release-notes.md && echo "OK: release-notes.md exists"
head -1 .claude/commands/release.md | grep -q '^\$ARGUMENTS' && echo "OK: starts with \$ARGUMENTS"
```

모든 검증이 OK를 출력해야 한다.

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/10-release/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `plan-and-build.md`의 구조를 참고하되 그대로 복사하지 마라. release 워크플로우에 맞게 작성하라.
- slash command 안에서 `run-phases.py`를 호출하지 마라. release 흐름은 task 시스템과 무관하다.
- `prompts/release-notes.md`는 독립적으로 읽을 수 있어야 한다. slash command 없이도 release notes 작성 가이드로 기능해야 한다.
- 기존 `.claude/commands/` 내 다른 파일을 수정하지 마라.
- 기존 `prompts/` 내 다른 파일을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
