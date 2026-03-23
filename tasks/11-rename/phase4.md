# Phase 4: 검증 및 물리적 rename

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/tasks/11-rename/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- Phase 0~3에서 수정된 모든 파일

## 작업 내용

전체 프로젝트에서 누락된 `cc-company` 문자열이 없는지 검증하고, 로컬의 `.cc-company/` 디렉토리를 `.agentinc/`로 rename한다.

### 1. 검증 스크립트 작성

`verify-rename.sh` 파일을 프로젝트 루트에 생성하라. **이 파일은 commit하지 않는다.**

```bash
#!/bin/bash
# verify-rename.sh - Verify cc-company rename completion
# This file is NOT committed to the repository

set -e

echo "Checking for remaining 'cc-company' references..."

# 예외 경로:
# - .git/ (커밋 히스토리)
# - node_modules/ (외부 패키지)
# - dist/ (빌드 산출물)
# - tasks/*/phase*-output.json (phase 실행 로그)
# - verify-rename.sh (이 스크립트 자체)

RESULT=$(grep -r "cc-company\|\.cc-company" \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude="phase*-output.json" \
  --exclude="verify-rename.sh" \
  . 2>/dev/null || true)

if [ -n "$RESULT" ]; then
  echo "FAIL: Found remaining references:"
  echo "$RESULT"
  exit 1
else
  echo "PASS: No remaining references found"
  exit 0
fi
```

### 2. 검증 스크립트 실행

```bash
chmod +x verify-rename.sh
./verify-rename.sh
```

### 3. 물리적 디렉토리 rename

로컬의 `.cc-company/` 디렉토리가 존재하면 `.agentinc/`로 rename:

```bash
if [ -d ".cc-company" ]; then
  mv .cc-company .agentinc
  echo "Renamed .cc-company to .agentinc"
fi
```

### 4. 최종 검증

```bash
npm run build
npm test
ls -la .agentinc/  # 디렉토리 존재 확인
```

## Acceptance Criteria

```bash
# 빌드 성공
npm run build

# 테스트 통과
npm test

# 검증 스크립트 통과
./verify-rename.sh

# .agentinc 디렉토리 존재
ls -la .agentinc/
```

## AC 검증 방법

위 AC 커맨드를 모두 실행하라. 모두 성공하면 `/tasks/11-rename/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하라.

## 주의사항

- `verify-rename.sh`는 **commit하지 마라**. 일회성 검증용이다.
- `.cc-company/` 디렉토리가 없으면 rename 단계는 건너뛰어도 된다.
- `.agentinc/`가 이미 존재하면 rename하지 마라 (충돌 방지).
- `.gitignore`에 `.agentinc`가 있는지 확인하라 (Phase 1에서 변경됨).
