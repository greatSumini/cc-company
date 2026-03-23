# docs-diff: release

Baseline: `8e3d849`

## `docs/release.md`

```diff
diff --git a/docs/release.md b/docs/release.md
new file mode 100644
index 0000000..9709d57
--- /dev/null
+++ b/docs/release.md
@@ -0,0 +1,144 @@
+# cc-company Release Process
+
+## 1. 개요
+
+### 배포 대상
+- **npm 패키지**: npmjs.com에 배포
+- **GitHub Release**: 태그 기반 릴리스 생성
+- **CHANGELOG.md**: 변경 내역 문서화
+
+### 배포 도구
+- **`/release` slash command**: Claude Code에서 실행
+- **`scripts/release.py`**: 버전 범프 + 빌드 + 테스트 + 커밋 + 태그 자동화
+
+## 2. 배포 흐름 (전체 파이프라인)
+
+```
+Pre-flight → Release Notes 생성 → scripts/release.py → npm publish → gh release → 검증
+```
+
+| 단계 | 담당 | 설명 |
+|------|------|------|
+| Pre-flight 체크 | Claude | branch, clean tree, npm whoami, 변경사항, audit, pack 확인 |
+| Release Notes 생성 | Claude | git log 분석 → CHANGELOG.md 업데이트 + GH Release 본문 작성 |
+| Version bump + build + test + commit + tag | Script | `scripts/release.py {patch\|minor\|major}` |
+| npm publish | Claude | 사용자 확인 후 `npm publish` 실행 |
+| GitHub Release | Claude | `gh release create` 실행 |
+| Post-publish 검증 | Claude | `npm view`, `gh release view`로 배포 확인 |
+
+## 3. Pre-flight 체크 항목
+
+| 항목 | 차단/경고 | 커맨드 |
+|------|-----------|--------|
+| main 브랜치 확인 | 차단 | `git rev-parse --abbrev-ref HEAD` |
+| working tree clean | 차단 | `git status --porcelain` |
+| npm 인증 상태 | 차단 | `npm whoami` |
+| 이전 태그 대비 변경사항 | 차단 | `git log $(git describe --tags --abbrev=0)..HEAD --oneline` |
+| npm audit | 경고 | `npm audit --omit=dev` |
+| npm pack 확인 | 경고 | `npm pack --dry-run` |
+
+**차단**: 조건 미충족 시 배포 중단
+**경고**: 사용자에게 알림 후 계속 진행 가능
+
+## 4. CHANGELOG.md 포맷
+
+[Keep a Changelog](https://keepachangelog.com) 규칙을 따른다.
+
+```markdown
+# Changelog
+
+## [x.y.z] - YYYY-MM-DD
+
+### Features
+- 새로운 기능 설명
+
+### Bug Fixes
+- 버그 수정 설명
+
+### Breaking Changes
+- 호환성 깨지는 변경 (해당 시에만)
+```
+
+### 카테고리 분류 기준
+- **Features**: 새로운 기능 추가 (`feat:` 커밋)
+- **Bug Fixes**: 버그 수정 (`fix:` 커밋)
+- **Breaking Changes**: 하위 호환성을 깨는 변경 (`BREAKING CHANGE:` 또는 `!:` 포함)
+
+## 5. `scripts/release.py` 인터페이스
+
+```bash
+python3 scripts/release.py <patch|minor|major>
+```
+
+### 동작 순서
+1. `package.json` version bump
+2. `npm run build`
+3. `npm test`
+4. `git commit -m "chore(release): vX.Y.Z"`
+5. `git tag vX.Y.Z`
+
+### 실패 시 롤백
+- build 또는 test 실패 시 `git checkout -- package.json`으로 복원 후 exit 1
+
+### 출력
+- 성공 시 새 버전 번호를 stdout 마지막 줄에 출력 (예: `0.3.0`)
+
+## 6. 사용법
+
+### Slash Command로 실행
+
+```bash
+# Claude Code에서
+/release patch    # 패치 버전 배포 (0.2.0 → 0.2.1)
+/release minor    # 마이너 버전 배포 (0.2.0 → 0.3.0)
+/release major    # 메이저 버전 배포 (0.2.0 → 1.0.0)
+/release          # bump 타입 없이 실행 시, Claude가 커밋 분석 후 추천
+```
+
+### 수동 실행 (디버깅용)
+
+```bash
+# Pre-flight 체크
+git rev-parse --abbrev-ref HEAD  # main 확인
+git status --porcelain            # clean tree 확인
+npm whoami                        # npm 인증 확인
+
+# Release 스크립트 실행
+python3 scripts/release.py patch
+
+# npm 배포
+npm publish
+
+# GitHub Release 생성
+gh release create vX.Y.Z --notes "Release notes here"
+
+# 배포 검증
+npm view cc-company version
+gh release view vX.Y.Z
+```
+
+## 7. 버전 정책
+
+[Semantic Versioning 2.0.0](https://semver.org/) 준수:
+
+- **MAJOR**: 하위 호환성 깨지는 API 변경
+- **MINOR**: 하위 호환 새 기능 추가
+- **PATCH**: 하위 호환 버그 수정
+
+### 현재 상태 (0.x.y)
+- 0.x 버전에서는 MINOR 변경도 breaking change 포함 가능
+- 1.0.0 릴리스 전까지는 API 안정성 보장하지 않음
+
+## 8. 체크리스트 (Quick Reference)
+
+배포 전:
+- [ ] main 브랜치인가?
+- [ ] working tree가 clean한가?
+- [ ] npm에 로그인되어 있는가?
+- [ ] 마지막 태그 이후 커밋이 있는가?
+- [ ] CHANGELOG.md 업데이트했는가?
+
+배포 후:
+- [ ] npm에서 새 버전 확인 (`npm view cc-company version`)
+- [ ] GitHub Release 확인 (`gh release view vX.Y.Z`)
+- [ ] 새 버전 설치 테스트 (`npm install -g cc-company@X.Y.Z`)
```
