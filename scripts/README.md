# scripts/

agent-inc 프로젝트의 자동화 스크립트를 관리하는 디렉토리.

## 스크립트 목록

| 스크립트 | 역할 | 관련 파일 |
|---|---|---|
| `run-phases.py` | task의 phase를 순차 실행하는 runner | `tasks/*/index.json`, `tasks/*/phase*.md`, `prompts/task-create.md` |
| `gen-spec-diff.py` | Phase 0 완료 후 spec/ 변경 diff를 markdown으로 생성 | `tasks/*/spec-diff.md` |
| `soul-manager.py` | soul TOML 항목의 last_used_at 갱신, stale 항목 조회, 항목 제거/유예 | `soul/**/*.toml`, `.claude/commands/review-soul.md` |
| `_utils.py` | 스크립트 공용 유틸리티 (프로젝트 루트 탐색 등) | - |

## 의존성

- Python 3.10+
- 외부 패키지 설치: `pip install -r scripts/requirements.txt`

## 실행 방법

```bash
# 프로젝트 루트에서 실행
python3 scripts/run-phases.py <task-dir>

# 예시
python3 scripts/run-phases.py 0-mvp
python3 scripts/run-phases.py 5-soul-manager
```

`run-phases.py`는 내부적으로 `gen-spec-diff.py`를 Phase 0 완료 후 자동 호출한다.
