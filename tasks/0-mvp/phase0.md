# Phase 0: 프로젝트 스캐폴딩

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — CLI 스펙, 디렉토리 구조, 스키마
- `/spec/architecture.md` — 레이어 구조, 소스 디렉토리, 데이터 흐름
- `/spec/adr.md` — 아키텍처 결정 사항
- `/spec/testing.md` — 테스트 전략
- `/spec/test-cases.md` — 테스트 케이스

이 phase는 전체 프로젝트의 기반을 만드는 단계다. 이후 모든 phase가 이 구조 위에서 동작하므로, 빈틈없이 설정하라.

## 작업 내용

### 1. package.json

```json
{
  "name": "cc-company",
  "version": "0.1.0",
  "description": "Run Claude Code like a company",
  "main": "dist/index.js",
  "bin": {
    "cc-company": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "type": "module"
}
```

dependencies: `commander`
devDependencies: `typescript`, `vitest`, `@types/node`

### 2. tsconfig.json

- target: ES2022
- module: Node16
- moduleResolution: Node16
- outDir: dist
- rootDir: src
- strict: true
- esModuleInterop: true
- declaration: true

### 3. vitest.config.ts

기본 설정. test 파일 위치는 `tests/**/*.test.ts`

### 4. src/index.ts

commander를 사용한 CLI 엔트리포인트. 빈 껍데기로 아래만 동작하면 된다:
- `cc-company --version` → 버전 출력
- `cc-company --help` → 도움말 출력

파일 최상단에 `#!/usr/bin/env node` shebang 포함.

### 5. 디렉토리 구조 생성

아래 빈 디렉토리/파일 구조를 미리 만들어둔다 (빈 파일이라도 구조가 보여야 한다):

```
src/
├── index.ts          (위에서 작성)
├── commands/
├── services/
├── store/
├── claude-runner/
├── logger/
├── types/
└── templates/
```

### 6. .gitignore

node_modules, dist, *.tgz 등 표준 Node.js gitignore

## Acceptance Criteria

다음 명령어들이 **모두 성공**해야 한다:

```bash
npm install
npm run build
npx cc-company --version    # "0.1.0" 출력
npx cc-company --help       # 도움말 출력
npm test                    # vitest 실행 (테스트 0개, 에러 없음)
```

## AC 검증 방법

위 명령어를 순서대로 실행하라. 하나라도 실패하면 수정 후 재시도하라.
모든 명령어가 성공하면 `/tasks/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 불필요한 파일이나 설정을 추가하지 마라. 정확히 명시된 것만 생성하라.
- ESM (type: module) 환경임을 잊지 마라. import/export 구문 사용.
- commander의 version은 package.json의 version과 일치시켜라.
