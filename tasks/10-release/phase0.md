# Phase 0: 문서 업데이트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/architecture.md`
- `/docs/spec.md`
- `/docs/adr.md`
- `/package.json` (현재 버전, scripts, prepublishOnly 확인)

## 작업 내용

`/docs/release.md` 파일을 새로 생성한다. 아래 내용을 포함하는 배포 프로세스 문서를 작성하라:

### 1. 개요
- cc-company의 배포 대상: npm 패키지 + GitHub Release + CHANGELOG.md
- 배포 도구: `/release` slash command + `scripts/release.py`

### 2. 배포 흐름 (전체 파이프라인)

```
Pre-flight → Release Notes 생성 → scripts/release.py → npm publish → gh release → 검증
```

각 단계의 역할과 담당(Claude vs Script)을 명확히 기술:

| 단계 | 담당 | 설명 |
|------|------|------|
| Pre-flight 체크 | Claude | branch, clean tree, npm whoami, 변경사항, audit, pack |
| Release Notes 생성 | Claude | git log 분석 → CHANGELOG.md + GH Release 본문 |
| Version bump + build + test + commit + tag | Script | `scripts/release.py {patch\|minor\|major}` |
| npm publish | Claude | 사용자 확인 후 실행 |
| GitHub Release | Claude | gh release create |
| Post-publish 검증 | Claude | npm view, gh release view |

### 3. Pre-flight 체크 항목

| 항목 | 차단/경고 | 커맨드 |
|------|-----------|--------|
| main 브랜치 확인 | 차단 | `git rev-parse --abbrev-ref HEAD` |
| working tree clean | 차단 | `git status --porcelain` |
| npm 인증 상태 | 차단 | `npm whoami` |
| 이전 태그 대비 변경사항 | 차단 | `git log $(git describe --tags --abbrev=0)..HEAD --oneline` |
| npm audit | 경고 | `npm audit --omit=dev` |
| npm pack 확인 | 경고 | `npm pack --dry-run` |

### 4. CHANGELOG.md 포맷

```markdown
# Changelog

## [x.y.z] - YYYY-MM-DD

### Features
- 내용

### Bug Fixes
- 내용
```

- [Keep a Changelog](https://keepachangelog.com) 규칙을 따른다.
- 카테고리: Features, Bug Fixes, Breaking Changes (해당 시에만)

### 5. `scripts/release.py` 인터페이스

```bash
python3 scripts/release.py <patch|minor|major>
```

- package.json version bump → npm run build → npm test → git commit → git tag
- build/test 실패 시 `git checkout -- package.json`으로 복원 후 exit 1
- 성공 시 새 버전 번호를 stdout 마지막 줄에 출력

### 6. 사용법

```bash
# Claude Code에서
/release patch
/release minor
/release        # bump 타입 추천 후 질문
```

## Acceptance Criteria

```bash
test -f docs/release.md && echo "OK: docs/release.md exists"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 통과하면 `/tasks/10-release/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase에서는 `docs/release.md`만 생성하라. 스크립트나 커맨드 파일을 만들지 마라.
- 기존 docs 파일을 수정하지 마라.
- 문서에 구체적인 커맨드와 예시를 포함하되, 실제 실행하지는 마라.
