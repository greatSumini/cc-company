# Phase 5: npm publish 및 deprecate

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/release.md`
- `/tasks/11-rename/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- Phase 4에서 모든 검증 통과 확인

## 작업 내용

새 패키지명 `agentinc`로 npm에 publish하고, 기존 `cc-company` 패키지를 deprecate한다.

### 1. npm 로그인 확인

```bash
npm whoami
```

로그인되어 있지 않으면 이 phase를 `"error"`로 마킹하고 다음 메시지를 기록하라:
> npm 로그인이 필요합니다. `npm login` 후 다시 실행하세요.

### 2. 버전 확인

현재 package.json의 버전을 확인하라. `0.2.0` 이상이어야 한다.
(기존 cc-company는 0.1.0이었으므로, 새 패키지는 최소 0.2.0)

버전이 0.2.0 미만이면:
```bash
npm version minor --no-git-tag-version
```

### 3. 빌드 및 테스트

```bash
npm run build
npm test
```

### 4. npm publish

```bash
npm publish
```

publish 성공 확인:
```bash
npm view agentinc version
```

### 5. 기존 패키지 deprecate

publish가 성공한 후에만 실행:

```bash
npm deprecate cc-company "This package has been renamed to agentinc. Please use 'npm install -g agentinc' instead."
```

deprecate 확인:
```bash
npm view cc-company
```

"DEPRECATED" 메시지가 표시되어야 한다.

## Acceptance Criteria

```bash
# 새 패키지 publish 확인
npm view agentinc version  # 버전 출력되어야 함

# 기존 패키지 deprecate 확인
npm view cc-company 2>&1 | grep -i "deprecated"  # deprecated 메시지 포함
```

## AC 검증 방법

위 AC 커맨드를 실행하라.
- `agentinc` 버전이 출력되고
- `cc-company`에 deprecated 메시지가 있으면

`/tasks/11-rename/index.json`의 phase 5 status를 `"completed"`로 변경하라.

실패하면 status를 `"error"`로 변경하고 에러 내용을 기록하라.

## 주의사항

- **npm publish는 되돌릴 수 없다.** 신중하게 진행하라.
- publish 전에 반드시 빌드/테스트가 통과해야 한다.
- deprecate는 publish 성공 후에만 실행하라.
- npm 로그인 계정이 `cc-company`의 maintainer인지 확인하라.
- 2FA가 활성화되어 있으면 OTP 입력이 필요할 수 있다.
