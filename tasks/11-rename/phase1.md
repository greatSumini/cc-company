# Phase 1: 패키지 및 설정 파일

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/tasks/11-rename/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- Phase 0에서 수정된 문서 파일들 (spec/, docs/, README.md 등)

## 작업 내용

패키지 메타데이터와 설정 파일을 변경한다.

### 변경 규칙

| 패턴 | 변경 후 |
|------|--------|
| `cc-company` (패키지명) | `agentinc` |
| `.cc-company` (디렉토리) | `.agentinc` |
| `github.com/greatSumini/cc-company` | `github.com/greatSumini/agentinc` |
| `github.com/choesumin/cc-company` | `github.com/greatSumini/agentinc` |

### 수정 대상 파일

#### package.json
```json
{
  "name": "agentinc",  // 변경
  "bin": {
    "agentinc": "dist/index.js"  // 키 변경
  },
  "repository": {
    "url": "https://github.com/greatSumini/agentinc.git"  // 변경
  },
  "homepage": "https://github.com/greatSumini/agentinc#readme"  // 변경
}
```

#### package-lock.json
- `name` 필드 2곳 변경 (루트, packages[""])

#### LICENSE
- Copyright holder: `cc-company` → `agentinc`

#### .gitignore
- `.cc-company` → `.agentinc`

#### tasks/index.json
- `repositoryUrl`: `https://github.com/greatSumini/agentinc`

## Acceptance Criteria

```bash
# 빌드 성공
npm run build

# 설정 파일에 cc-company 문자열이 없어야 함
grep -E "cc-company|\.cc-company" package.json package-lock.json LICENSE .gitignore tasks/index.json && echo "FAIL" || echo "PASS"
```

## AC 검증 방법

위 AC 커맨드를 순서대로 실행하라. 빌드 성공하고 "PASS"가 출력되면 `/tasks/11-rename/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- **소스코드(src/, tests/)는 이 phase에서 수정하지 마라.**
- package-lock.json은 직접 수정해도 되고, `npm install`로 재생성해도 된다.
- 기존 테스트를 깨뜨리지 마라 (이 phase에서는 테스트가 실패할 수 있음 — 경로 불일치. Phase 3에서 수정).
