# Phase 3: resource.service + skill CLI 커맨드

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/4-skill-directory/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/store/fs-store.ts` (디렉토리 기반 skill CRUD + 파일 CRUD 구현)
- `/src/store/store.ts` (IStore 인터페이스)
- `/src/types/index.ts` (SkillConfig with resources)
- `/src/services/resource.service.ts` (현재 상태)
- `/src/commands/skill.ts` (현재 상태)
- `/src/commands/context.ts` (서비스 생성 패턴 파악)
- `/tests/services/resource.service.test.ts` (기존 테스트 패턴)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. `src/services/resource.service.ts` — 신규 메서드

기존 메서드(createSkill, listSkills, removeSkill) 유지. 아래 메서드 추가:

**`addSkillFile(skillName, filePath, content)`**:
- `this.store.addSkillFile(skillName, filePath, content)` 호출

**`editSkillFile(skillName, filePath, content)`**:
- `this.store.editSkillFile(skillName, filePath, content)` 호출

**`removeSkillFile(skillName, filePath)`**:
- `this.store.removeSkillFile(skillName, filePath)` 호출

**`showSkill(skillName)`**:
- `this.store.getSkill(skillName)` → SkillConfig 획득
- `this.store.getSkillDir(skillName)` → 디렉토리 경로
- 디렉토리 내 실제 파일 목록 수집 (SKILL.md 제외, 재귀 탐색)
- resources 불일치 경고:
  - resources에 등록됐지만 실제 파일 없음 → `console.warn('⚠ skill "{name}": resources에 등록됐지만 파일 없음 — {path}')`
  - 파일 존재하지만 resources에 미등록 → `console.warn('⚠ skill "{name}": 파일 존재하지만 resources에 미등록 — {path}')`
- 반환: `{ config: SkillConfig, files: string[], warnings: string[] }`

`showSkill`에서 디렉토리 내 파일 목록 수집 시, `scripts/`, `references/`, `assets/` 등의 서브디렉토리를 재귀 탐색하되 SKILL.md는 제외. 빈 디렉토리(스캐폴딩)는 무시.

### 2. `src/commands/skill.ts` — 커맨드 확장

기존 `add`, `list`, `remove` 유지 (add의 동작은 디렉토리 생성으로 자연스럽게 변경됨 — store가 디렉토리로 생성하므로).

**`show` 커맨드 추가:**

```bash
cc-company skill show <name>
```

출력 형식:
```
Skill: deploy
Description: 배포 프로세스 관리
Model: sonnet
Resources:
  - scripts/run-deploy.sh
  - references/env-schema.json
Files:
  - scripts/run-deploy.sh
  - references/env-schema.json
  - assets/logo.png
⚠ skill "deploy": 파일 존재하지만 resources에 미등록 — assets/logo.png
```

**`add-file` 커맨드 추가:**

```bash
cc-company skill add-file <skill-name> <file-path> --content <content>
cc-company skill add-file <skill-name> <file-path> --stdin
```

- `--content`와 `--stdin` 중 하나 필수. 둘 다 없으면 에러: `Either --content or --stdin is required`
- `--stdin` 사용 시 process.stdin에서 전체 내용 읽기 (async action)

stdin 읽기를 위한 헬퍼 함수를 커맨드 파일 내에 정의:

```typescript
async function readContent(options: { content?: string; stdin?: boolean }): Promise<string> {
  if (options.content) return options.content
  if (options.stdin) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf-8')
  }
  throw new Error('Either --content or --stdin is required')
}
```

이 헬퍼를 `add-file`과 `edit-file` 커맨드에서 공유.

**`edit-file` 커맨드 추가:**

```bash
cc-company skill edit-file <skill-name> <file-path> --content <content>
cc-company skill edit-file <skill-name> <file-path> --stdin
```

동일한 `readContent` 헬퍼 사용. 내용을 읽은 후 `resourceService.editSkillFile()` 호출.

**`remove-file` 커맨드 추가:**

```bash
cc-company skill remove-file <skill-name> <file-path>
```

`resourceService.removeSkillFile()` 호출.

### 3. 테스트 작성 — `tests/services/resource.service.test.ts`

기존 테스트 파일의 패턴을 따라 아래 테스트 추가:

```
[Skill show + 불일치 경고]
✓ showSkill → config + 파일 목록 반환
✓ showSkill resources 불일치 시 경고 출력
```

`console.warn` spy 패턴은 기존 remove 테스트에서 이미 사용 중이므로 동일하게 적용.

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/4-skill-directory/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `show` 커맨드에서 디렉토리 재귀 탐색 로직은 service에 넣어라. command는 출력만.
- `readContent` 헬퍼의 async 처리: commander의 action은 async function을 지원한다. `.action(async (...) => { ... })` 형태로 작성.
- `--stdin` 구현 시 commander의 option과 충돌하지 않도록 주의. `--stdin`은 boolean 플래그.
- 기존 `skill add` 커맨드의 동작은 변경하지 마라. store 레이어가 디렉토리를 생성하므로 command 코드는 그대로.
- 기존 테스트를 깨뜨리지 마라.
