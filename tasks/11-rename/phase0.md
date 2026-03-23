# Phase 0: 문서 업데이트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`

## 작업 내용

프로젝트 이름을 `cc-company`에서 `agentinc`로 변경한다. 이 phase에서는 **문서 파일만** 수정한다.

### 변경 규칙

| 패턴 | 변경 후 |
|------|--------|
| `cc-company` (CLI 명령어, 패키지명) | `agentinc` |
| `.cc-company` (디렉토리) | `.agentinc` |
| `github.com/greatSumini/cc-company` | `github.com/greatSumini/agentinc` |
| `github.com/choesumin/cc-company` | `github.com/greatSumini/agentinc` |

### 수정 대상 파일

#### spec/ 디렉토리
- `spec/spec.md` — CLI 명령어 예시, 디렉토리 구조 (~50곳)
- `spec/architecture.md` — 경로, 명령어 예시 (~20곳)
- `spec/adr.md` — ADR 내 언급 (~30곳)
- `spec/testing.md` — 제목
- `spec/test-cases.md` — 테스트 케이스 설명
- `spec/external/claude-skills-framework.md` — cc-company 언급

#### docs/ 디렉토리
- `docs/getting-started.md` — 설치, 실행 예시
- `docs/cli-reference.md` — 모든 CLI 명령어
- `docs/daemon-mode.md` — 데몬 모드 명령어
- `docs/webhook-integration.md` — webhook 설정
- `docs/configuration.md` — 설정 구조
- `docs/release.md` — 릴리스 프로세스

#### 기타 문서
- `README.md` — 배지 URL, 예시 명령어, 디렉토리 설명
- `prompts/init.md` — 프로젝트 소개
- `prompts/new-feature.md` — 명령어 예시
- `prompts/task-create.md` — 명령어 예시
- `prompts/dave/0-init.md` — 명령어 예시
- `.claude/commands/release.md` — npm view 명령어
- `soul/project/insights.toml` — 프로젝트 설명

### 작업 방법

1. 각 파일을 열고 `cc-company`, `.cc-company` 문자열을 검색
2. 위 변경 규칙에 따라 치환
3. GitHub URL도 새 저장소명으로 변경

## Acceptance Criteria

```bash
# 문서 파일에 cc-company 문자열이 없어야 함
grep -r "cc-company\|\.cc-company" spec/ docs/ README.md prompts/ .claude/ soul/ && echo "FAIL: cc-company found" || echo "PASS"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. "PASS"가 출력되면 `/tasks/11-rename/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- **소스코드(src/, tests/)는 이 phase에서 수정하지 마라.** 문서만 수정한다.
- **package.json, .gitignore 등 설정 파일도 수정하지 마라.** Phase 1에서 처리한다.
- 배너 이미지(`assets/banner.png`)는 이번 task 범위 외다. 텍스트만 변경하라.
- 기존 테스트를 깨뜨리지 마라 (이 phase에서는 테스트 영향 없음).
