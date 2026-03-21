# Phase 4: run.service + flag-builder (--add-dir 통합)

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md` (특히 ADR-014: --add-dir 차단)
- `/tasks/4-skill-directory/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (FlagBuilderInput.addDirPath)
- `/src/store/fs-store.ts` (getSkillDir, getSkill 구현)
- `/src/claude-runner/flag-builder.ts` (Phase 1에서 pluginDirPath→addDirPath 변경 완료 상태)
- `/src/services/run.service.ts` (현재 상태)
- `/src/commands/run.ts` (현재 상태)
- `/tests/claude-runner/flag-builder.test.ts` (기존 테스트 패턴)
- `/tests/services/run.service.test.ts` (기존 테스트 패턴, CC_DRY_RUN 사용)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. `src/claude-runner/flag-builder.ts` — --add-dir 플래그

Phase 1에서 `pluginDirPath` → `addDirPath` 교체가 완료된 상태다. `buildFlags` 함수에서:

- `input.addDirPath`가 존재하면 `--add-dir` 플래그를 추가한다.
- 기존 `--plugin-dir` 관련 코드가 남아있다면 제거한다.

```typescript
// --add-dir (skills 임시 디렉토리)
if (input.addDirPath) {
  flags.push('--add-dir', input.addDirPath)
}
```

### 2. `src/services/run.service.ts` — 핵심 변경

**2-1. --add-dir 차단 (서비스 레이어)**

`run()` 메서드 시작 부분에서 passthroughFlags 검증:

```typescript
// ADR-014: --add-dir는 cc-company 내부 전용
if (passthroughFlags.includes('--add-dir')) {
  throw new Error('--add-dir is managed internally by cc-company. Do not pass it directly.')
}
```

**2-2. Skills 임시 디렉토리 생성**

agent에 skills가 할당된 경우:
1. `this.store.resolveSkills(agent.skills)` → SkillConfig[] 획득
2. uuid 생성 (crypto.randomUUID 또는 간단한 타임스탬프+랜덤)
3. `.cc-company/.tmp/run-{uuid}/.claude/skills/` 디렉토리 생성
4. 각 skill 디렉토리를 임시 경로에 복사:
   - `this.store.getSkillDir(skillName)` → 소스 경로
   - 소스 디렉토리 전체를 `.tmp/run-{uuid}/.claude/skills/{skillName}/`으로 복사
   - `fs.cpSync(src, dest, { recursive: true })` 사용 (Node.js 16.7+)
5. `addDirPath`를 `.cc-company/.tmp/run-{uuid}`로 설정

skills가 없으면 addDirPath는 undefined. 임시 디렉토리를 생성하지 않는다.

**2-3. Resource 불일치 경고 (run 시점)**

skills를 임시 디렉토리에 복사하기 전에, 각 skill에 대해:
- `config.resources`에 등록된 파일이 실제 디렉토리에 존재하는지 확인
- 디렉토리에 존재하지만 `config.resources`에 미등록인 파일이 있는지 확인 (SKILL.md 제외, 빈 디렉토리 제외)
- 불일치 발견 시 `console.warn()` 출력. 실행은 계속.

경고 메시지 형식:
```
⚠ skill "deploy": resources에 등록됐지만 파일 없음 — scripts/run-deploy.sh
⚠ skill "deploy": 파일 존재하지만 resources에 미등록 — assets/logo.png
```

**2-4. try/finally 정리**

```typescript
const tmpDir = /* 생성된 임시 디렉토리 경로 또는 null */

try {
  const result = spawnClaude(flags)
  // ... 로그 저장 등
  return result
} finally {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
```

**2-5. Stale 임시 디렉토리 정리**

`run()` 메서드 시작 부분(--add-dir 차단 직후)에 stale cleanup 수행:

```typescript
private cleanStaleTmpDirs(): void {
  const tmpBase = path.join(this.rootPath, '.tmp')
  if (!fs.existsSync(tmpBase)) return

  const ONE_HOUR = 60 * 60 * 1000
  const now = Date.now()

  for (const entry of fs.readdirSync(tmpBase, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('run-')) continue
    const dirPath = path.join(tmpBase, entry.name)
    const stat = fs.statSync(dirPath)
    if (now - stat.mtimeMs > ONE_HOUR) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
  }
}
```

**2-6. 기존 pluginDirPath 참조 제거**

Phase 1에서 이미 `addDirPath`로 교체되었을 것이나, 확인 후 `getIfExists(path.join(agentDir, 'plugins'))` 같은 잔존 코드가 있으면 제거.

### 3. 테스트 작성

**`tests/claude-runner/flag-builder.test.ts`:**

기존 `--plugin-dir` 관련 테스트를 제거하고 아래 추가:

```
[--add-dir]
✓ addDirPath 있으면 → --add-dir 플래그 생성
✓ addDirPath undefined → --add-dir 생략
```

**`tests/services/run.service.test.ts`:**

기존 테스트 패턴(CC_DRY_RUN, tmpDir, vi.spyOn)을 따라 아래 추가:

```
[--add-dir 임시 디렉토리]
✓ skills 있는 agent run → .tmp/run-{uuid}/.claude/skills/ 에 디렉토리 복사
✓ skills 없는 agent run → .tmp 생성하지 않음, --add-dir 없음
✓ 실행 완료 후 임시 디렉토리 정리됨

[--add-dir 차단]
✓ passthroughFlags에 --add-dir 포함 → 에러

[stale 정리]
✓ 1시간 이상 경과한 .tmp/run-* 디렉토리 → run 시 자동 삭제
✓ 1시간 미만 .tmp/run-* → 삭제하지 않음

[resources 불일치 경고]
✓ resources에 등록됐지만 파일 없음 → console.warn
✓ 파일 존재하지만 resources에 미등록 → console.warn
```

stale 테스트에서 시간 조작은 `fs.utimesSync()`로 파일의 mtime을 직접 설정하여 1시간 이전으로 만드는 방식. `vi.useFakeTimers()`는 사용하지 마라 — fs.statSync의 mtime은 OS 레벨이라 fake timer와 무관.

skills 복사 테스트에서는:
1. store에 skill 디렉토리 생성 (createSkill + addSkillFile로 보조 파일 추가)
2. agent에 해당 skill 할당
3. `run()` 실행 (CC_DRY_RUN)
4. 실행 중에 임시 디렉토리가 생성되었는지 확인하려면, `spawnClaude`를 spy로 교체하여 호출 시점에 tmp 디렉토리 존재 여부를 캡처

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/4-skill-directory/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `fs.cpSync`는 Node.js 16.7+ 에서 사용 가능. 프로젝트 요구사항이 Node.js 18+이므로 안전.
- try/finally 블록에서 finally의 `fs.rmSync`가 실패해도 조용히 넘어가야 한다 (`force: true`).
- stale cleanup은 best-effort. 실패해도 에러를 throw하지 않는다.
- resource 불일치 경고는 `console.warn`만 출력하고 실행을 차단하지 않는다.
- run.service 테스트에서 기존 테스트가 skill 없는 agent를 사용하므로, 새 테스트는 별도 describe 블록에서 skill이 있는 agent를 세팅하라.
- 기존 flag-builder 테스트 중 `--plugin-dir` 관련 테스트(plugins directory → --plugin-dir + path, 전체 설정 agent → --plugin-dir 포함)를 찾아서 제거 또는 `--add-dir`로 교체하라.
- 기존 테스트를 깨뜨리지 마라.
