# Phase 1: Release Script

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/release.md` (이번 task의 Phase 0에서 생성된 배포 프로세스 문서)
- `/tasks/10-release/docs-diff.md` (이번 task의 문서 변경 기록)
- `/scripts/run-phases.py` (기존 Python 스크립트의 코드 스타일과 패턴 참고)
- `/scripts/_utils.py` (공통 유틸리티)
- `/package.json` (현재 버전, scripts 필드 확인)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

`/scripts/release.py` 파일을 생성한다. 기존 `run-phases.py`의 코드 스타일(import 구조, 헬퍼 분리, `_utils.py` 사용 등)을 따르라.

### CLI 인터페이스

```bash
python3 scripts/release.py <patch|minor|major>
```

- 인자가 없거나 유효하지 않으면 usage 출력 후 exit 1
- 유효 값: `patch`, `minor`, `major` (대소문자 무시)

### 구현할 함수/로직

#### 1. `read_version() -> str`
- `package.json`을 읽어 현재 `version` 필드를 반환
- `_utils.py`의 `find_project_root()`를 사용하여 프로젝트 루트를 찾는다

#### 2. `bump_version(current: str, bump_type: str) -> str`
- semver 문자열을 `.` 기준으로 split하여 major, minor, patch 정수로 파싱
- `patch`: patch + 1, 나머지 유지
- `minor`: minor + 1, patch = 0
- `major`: major + 1, minor = 0, patch = 0
- 새 버전 문자열 반환

#### 3. `update_package_json(new_version: str)`
- package.json을 읽어 `version` 필드를 교체하고 저장
- JSON 포맷 유지 (indent=2, trailing newline)

#### 4. `run_cmd(cmd: list[str], description: str) -> bool`
- subprocess.run으로 실행, cwd는 프로젝트 루트
- 실패 시 stderr 출력 후 False 반환
- 성공 시 True 반환

#### 5. `main()` 흐름

```
1. CLI 인자 파싱 (bump_type)
2. current = read_version()
3. new_version = bump_version(current, bump_type)
4. print(f"  {current} → {new_version}")
5. update_package_json(new_version)
6. run_cmd(["npm", "run", "build"]) — 실패 시 → rollback
7. run_cmd(["npm", "test"]) — 실패 시 → rollback
8. git add package.json
9. CHANGELOG.md가 staging area에 있으면 함께 add (git diff --cached --name-only로 확인하지 말고, 파일이 존재하고 git status에 modified로 나오면 add)
10. git commit -m "chore(release): v{new_version}"
11. git tag v{new_version}
12. 마지막 줄에 new_version 출력
```

#### rollback 처리
- build 또는 test 실패 시: `git checkout -- package.json` 실행
- "Build failed. Rolled back package.json." 또는 "Tests failed. Rolled back package.json." 메시지 출력
- exit 1

### 핵심 규칙

- **npm publish를 실행하지 마라.** 이 스크립트의 범위는 version bump + build + test + commit + tag까지다.
- **gh release를 실행하지 마라.** Claude가 별도로 처리한다.
- git commit 시 `--no-verify` 플래그를 사용하지 마라.
- 외부 패키지를 import하지 마라. 표준 라이브러리(json, subprocess, sys, pathlib)만 사용.

## Acceptance Criteria

```bash
test -f scripts/release.py && python3 scripts/release.py --help 2>&1; echo "exit: $?"
```

위 커맨드에서:
- `scripts/release.py` 파일이 존재해야 한다
- `--help` 또는 인자 없이 실행 시 usage를 출력하고 exit 1해야 한다 (실제 release를 수행하면 안 됨)

추가 검증:
```bash
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from release import bump_version
assert bump_version('0.2.0', 'patch') == '0.2.1'
assert bump_version('0.2.0', 'minor') == '0.3.0'
assert bump_version('0.2.0', 'major') == '1.0.0'
assert bump_version('1.9.9', 'patch') == '1.9.10'
assert bump_version('1.9.9', 'minor') == '1.10.0'
print('All bump_version tests passed')
"
```

## AC 검증 방법

위 AC 커맨드를 모두 실행하라. 모두 통과하면 `/tasks/10-release/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `run-phases.py`의 코드 스타일을 따르라: shebang line, docstring, 섹션 구분 주석(`# ---`), 함수 분리 패턴.
- `_utils.py`의 `find_project_root()`를 재사용하라. 새로 구현하지 마라.
- CHANGELOG.md를 이 스크립트가 생성하거나 수정하지 마라. Claude가 미리 staging해둔 것을 commit에 포함만 하라.
- 기존 테스트를 깨뜨리지 마라. `npm run build && npm test`로 확인.
