# Release Notes 생성 지침

이 문서는 git log를 분석하여 release notes를 생성할 때 따라야 할 포맷과 규칙을 정의한다.

## GitHub Release 본문 포맷

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

## CHANGELOG.md 엔트리 포맷

```markdown
## [x.y.z] - YYYY-MM-DD

### Features
- 변경 내용

### Bug Fixes
- 변경 내용
```

## 작성 규칙

### 카테고리 분류
- `feat:` → Features
- `fix:` → Bug Fixes
- 나머지 (`chore:`, `docs:`, `refactor:`, `test:`, `style:`, `perf:`, `ci:` 등) → Other Changes

### 섹션 생략
- 해당 카테고리에 항목이 없으면 해당 섹션을 통째로 생략한다.
- 예: fix 커밋이 없으면 "### Bug Fixes" 섹션 자체를 작성하지 않는다.

### PR 번호 처리
- GitHub Release 본문: PR 번호가 commit message에 포함되어 있으면 `(#123)` 형태로 링크 포함
- CHANGELOG.md: PR 번호를 포함하지 않음 (간결하게)

### 언어
- commit message가 한국어/영어 혼용이면 있는 그대로 사용한다.
- 번역하지 마라.

### squash merge
- squash merge된 PR의 경우 PR 제목을 기준으로 작성한다.

### 사소한 변경 생략
- chore, docs, refactor 등 사용자에게 영향이 없는 변경은 Other Changes로 분류한다.
- 너무 사소한 것(typo 수정, lint 적용, 포맷팅 등)은 생략해도 된다.

### Breaking Changes
- `BREAKING CHANGE:` 또는 `!:` (예: `feat!:`)가 포함된 커밋은 별도로 "### Breaking Changes" 섹션에 추가한다.
- CHANGELOG.md와 GitHub Release 본문 모두에 포함한다.
