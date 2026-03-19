# Phase 1: 타입 확장 + frontmatter 파서 유틸 + 테스트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/docs/testing.md`
- `/docs/test-cases.md`
- `/tasks/2-frontmatter-md/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 아래 기존 코드를 반드시 읽어라:

- `/src/types/index.ts`
- `/src/store/fs-store.ts`
- `/src/claude-runner/flag-builder.ts`

## 작업 내용

### 1. `gray-matter` 의존성 설치

```bash
npm install gray-matter
npm install -D @types/js-yaml
```

`gray-matter`는 런타임 dependencies에 추가한다 (devDependencies 아님). `@types/js-yaml`은 gray-matter가 내부적으로 사용하는 js-yaml의 타입 정의로, TypeScript 컴파일 시 필요할 수 있으므로 devDependencies에 추가한다. 만약 타입 에러가 없다면 `@types/js-yaml`은 생략해도 된다.

### 2. `/src/types/index.ts` 수정

`SubagentConfig` 인터페이스에 Claude Code 호환 optional 필드를 추가하라:

```typescript
export interface SubagentConfig {
  name: string
  description: string
  prompt: string
  // Claude Code 호환 optional 필드
  model?: string
  tools?: string
  disallowedTools?: string
  maxTurns?: number
  permissionMode?: string
}
```

`SkillConfig` 인터페이스에도 Claude Code 호환 optional 필드를 추가하라:

```typescript
export interface SkillConfig {
  name: string
  description: string
  prompt: string
  // Claude Code 호환 optional 필드
  model?: string
  allowedTools?: string
  context?: string
  agent?: string
  userInvocable?: boolean
  disableModelInvocation?: boolean
  argumentHint?: string
}
```

**핵심 규칙**: `prompt` 필드는 반드시 유지하라. 런타임에서 md body로부터 추출하여 이 필드에 주입한다. `flag-builder.ts`가 `subagent.prompt`로 접근하는 기존 로직을 깨뜨리면 안 된다.

### 3. `/src/utils/frontmatter.ts` 생성

`gray-matter`를 사용하여 frontmatter 파싱/직렬화 유틸을 구현하라.

**함수 시그니처:**

```typescript
import type { SubagentConfig, SkillConfig } from '../types/index.js'

export function parseSubagentMd(content: string): SubagentConfig
export function parseSkillMd(content: string): SkillConfig
export function serializeSubagentMd(config: SubagentConfig): string
export function serializeSkillMd(config: SkillConfig): string
```

**파싱 규칙:**
- `gray-matter`로 frontmatter(YAML)와 body를 분리한다.
- frontmatter에서 `name` 필드가 없으면 에러를 throw하라.
- frontmatter에 `data`가 없거나 빈 객체이면 (frontmatter 자체가 없음) 에러를 throw하라. 에러 메시지: `"Invalid frontmatter: missing required field 'name'"` 또는 `"No frontmatter found"`.
- body(content)를 `trim()`하여 `prompt` 필드에 넣는다.
- `description`은 optional로 처리하되, 없으면 빈 문자열로 기본값을 설정한다.
- optional 필드들은 frontmatter에 있으면 그대로 매핑, 없으면 undefined.

**직렬화 규칙:**
- `gray-matter`의 `stringify` 또는 직접 `---\n{yaml}\n---\n\n{prompt}` 형태로 생성한다.
- `prompt` 필드를 body로 넣고, 나머지 필드를 frontmatter로 넣는다.
- frontmatter에서 값이 `undefined`인 optional 필드는 생략한다.
- `prompt`(body)가 빈 문자열이면 frontmatter만 생성하고 body는 비워둔다.

### 4. `/tests/utils/frontmatter.test.ts` 생성

`/docs/test-cases.md`에 정의된 테스트 케이스를 구현하라:

```
[파싱 - subagent]
✓ 정상적인 frontmatter + body → name, description, prompt 추출
✓ optional 필드(model, tools, maxTurns) 포함 → 해당 필드 파싱
✓ name 필드 누락 → 에러
✓ frontmatter 없는 순수 마크다운 → 에러
✓ 빈 body → prompt가 빈 문자열

[파싱 - skill]
✓ 정상적인 skill frontmatter + body → name, description, prompt 추출
✓ skill optional 필드(allowedTools, context, agent) 포함 → 해당 필드 파싱

[직렬화]
✓ serialize 후 parse → 원본과 동일 (round-trip)
```

테스트 파일 위치: `/tests/utils/frontmatter.test.ts`

vitest를 사용하라. 테스트 데이터는 문자열 리터럴로 직접 작성하라 (파일 I/O 불필요).

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과 (기존 테스트 + 새 frontmatter 테스트)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/2-frontmatter-md/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase에서는 `fs-store.ts`를 수정하지 마라. 파서 유틸과 타입만 작업한다.
- 기존 테스트를 깨뜨리지 마라. `SubagentConfig`/`SkillConfig`에 optional 필드만 추가하므로 기존 코드가 깨질 일은 없어야 한다.
- `gray-matter`의 타입 정의가 없을 경우 `// @ts-ignore`가 아니라, `declare module 'gray-matter'` 또는 `@types/gray-matter`를 설치하여 해결하라. 단, gray-matter는 자체 타입을 포함하고 있으므로 추가 설치가 필요 없을 수 있다.
- `prompt` 필드를 frontmatter에서 제외하고 body에서만 추출하라. frontmatter에 prompt가 있으면 무시한다.
