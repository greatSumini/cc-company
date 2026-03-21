# docs-diff: skill-directory

Baseline: `4ac3815`

## `docs/adr.md`

```diff
diff --git a/docs/adr.md b/docs/adr.md
index 911d92a..33aebcc 100644
--- a/docs/adr.md
+++ b/docs/adr.md
@@ -183,3 +183,27 @@
 - Hook은 JSON 유지 (config 필드가 구조화된 JSON이므로 md 변환 부자연스러움)
 
 **영향**: `.cc-company/subagents/*.json` → `*.md`, `.cc-company/skills/*.json` → `*.md`. 런타임 인터페이스(SubagentConfig, SkillConfig) 유지.
+
+---
+
+## ADR-013: Skill 저장 형식을 단일 MD에서 디렉토리로 전환
+
+**상태**: 확정 (2026-03-22)
+
+**맥락**: Anthropic 공식 skills 프레임워크는 디렉토리 단위(SKILL.md + scripts/, references/, assets/)로 관리. 현재 cc-company는 단일 `.md` 파일. 보조 리소스(스크립트, 참조 문서, 템플릿 등)를 함께 관리할 수 없음.
+
+**결정**: `skills/{name}/SKILL.md` 디렉토리 구조로 전환. `resources` 필드를 SKILL.md frontmatter에 매니페스트로 포함. 런타임 디렉토리 스캔이 아닌 메타데이터 기반 — 향후 원격 서버 호스팅(api-store) 전환 시 필요한 파일만 fetch 가능하도록.
+
+**마이그레이션**: 기존 단일 `.md` 파일 감지 시 자동으로 디렉토리 형식으로 변환. 임시 코드로 명시적 주석 처리.
+
+---
+
+## ADR-014: `--add-dir` passthrough 차단 및 내부 사용
+
+**상태**: 확정 (2026-03-22)
+
+**맥락**: Claude Code CLI의 `--add-dir` 플래그는 추가 디렉토리 내 `.claude/skills/`를 자동 로드한다. cc-company가 agent에 할당된 skills를 임시 디렉토리에 복사하여 `--add-dir`로 전달하는 방식을 사용한다.
+
+**결정**: `--add-dir`을 cc-company 내부 전용으로 사용. 사용자가 passthrough로 전달하면 에러. `--add-dir` 차단 검증은 run.service(서비스 레이어)에서 수행 — command 레이어가 아닌 서비스 레이어에서 검증해야 테스트 가능.
+
+**임시 디렉토리**: `.cc-company/.tmp/run-{uuid}/.claude/skills/`에 skill 디렉토리 복사. `try/finally`로 정리 + 다음 run 시 1시간 이상 stale 디렉토리 자동 삭제.
```

## `docs/architecture.md`

```diff
diff --git a/docs/architecture.md b/docs/architecture.md
index 98b5100..b44f9be 100644
--- a/docs/architecture.md
+++ b/docs/architecture.md
@@ -46,6 +46,13 @@ interface IStore {
   removeSubagent(name: string): void
   // skills, hooks 동일 패턴
 
+  // Skill file operations
+  addSkillFile(skillName: string, filePath: string, content: string): void
+  editSkillFile(skillName: string, filePath: string, content: string): void
+  removeSkillFile(skillName: string, filePath: string): void
+  getSkillFile(skillName: string, filePath: string): string
+  getSkillDir(skillName: string): string
+
   // 실행 로그
   saveRunLog(log: RunLog): void
   getRunLogs(filter?: RunLogFilter): RunLog[]
@@ -165,3 +172,41 @@ src/
    RunLog JSON → .cc-company/runs/{timestamp}-{uuid}.json
    prompt: "버그 고쳐줘", mode: "interactive"
 ```
+
+### Skill 전달 흐름 (--add-dir)
+
+run.service에서 skills resolve 후:
+
+```
+1. stale temp 정리
+   .cc-company/.tmp/run-* 중 1시간 이상 경과한 디렉토리 자동 삭제
+
+2. 임시 디렉토리 생성
+   .cc-company/.tmp/run-{uuid}/.claude/skills/ 생성
+
+3. skill 디렉토리 복사
+   할당된 skill 디렉토리 전체를 임시 경로로 복사
+
+4. flag-builder
+   addDirPath: ".cc-company/.tmp/run-{uuid}" → --add-dir 플래그 생성
+
+5. spawner
+   child_process.spawn("claude", [...flags, "--add-dir", addDirPath])
+
+6. 정리 (try/finally)
+   spawn 완료 후 임시 디렉토리 삭제
+```
+
+### FlagBuilderInput
+
+```typescript
+interface FlagBuilderInput {
+  promptFilePath: string
+  subagents?: SubagentConfig[]
+  mcpConfigPath?: string
+  settingsPath?: string
+  addDirPath?: string           // skills 임시 디렉토리 경로
+  passthroughFlags?: string[]
+  prompt?: string
+}
+```
```

## `docs/spec.md`

```diff
diff --git a/docs/spec.md b/docs/spec.md
index 5dbf1c6..b51d2c3 100644
--- a/docs/spec.md
+++ b/docs/spec.md
@@ -69,7 +69,11 @@ cc-company hook add|list|remove <name>
 │   ├── git-expert.md
 │   └── code-reviewer.md
 ├── skills/                  # 공용 skills 풀
-│   └── deploy.md
+│   └── deploy/
+│       ├── SKILL.md
+│       ├── scripts/
+│       ├── references/
+│       └── assets/
 ├── hooks/                   # 공용 hooks 풀
 │   └── pre-commit.json
 ├── agents/
@@ -82,6 +86,9 @@ cc-company hook add|list|remove <name>
 │   │   └── ...
 │   └── hr/
 │       └── ...
+├── .tmp/                    # run 시 임시 디렉토리 (자동 생성/정리)
+│   └── run-{uuid}/
+│       └── .claude/skills/  # --add-dir용 skill 복사본
 └── runs/                    # 실행 로그
     └── 2026-03-19T100000-uuid.json
 ```
@@ -120,25 +127,56 @@ You are a Git version control expert...
 **필수 필드**: `name`, `description`
 **Optional 필드**: `model`, `tools`, `disallowedTools`, `maxTurns`, `permissionMode`
 
-## Skill MD 형식
+## Skill 디렉토리 형식
 
-YAML frontmatter + 마크다운 본문 구조:
+Anthropic 공식 skills 프레임워크를 따르는 디렉토리 구조:
 
-```markdown
+```
+skills/
+└── deploy/
+    ├── SKILL.md              # 메타데이터(YAML frontmatter) + 지시문 (필수)
+    ├── scripts/              # 실행 가능한 코드, 유틸리티 (관례)
+    ├── references/           # 참조 문서, 스키마 (관례)
+    └── assets/               # 템플릿, 이미지 (관례)
+```
+
+### SKILL.md frontmatter
+
+```yaml
 ---
 name: deploy
 description: 배포 프로세스 관리
-allowedTools: Bash, Read  # optional
-model: sonnet             # optional
+resources:
+  - scripts/run-deploy.sh
+  - references/env-schema.json
+allowedTools: Bash, Read     # optional
+model: sonnet                # optional
 ---
+```
 
-# Deploy Skill
+**필수 필드**: `name`, `description`
+**Optional 필드**: `resources`, `model`, `allowedTools`, `context`, `agent`, `userInvocable`, `disableModelInvocation`, `argumentHint`
 
-Manages deployment processes...
+### Skill 파일 관리
+
+```bash
+cc-company skill add-file <skill-name> <file-path> --content <content>
+cc-company skill add-file <skill-name> <file-path> --stdin
+cc-company skill edit-file <skill-name> <file-path> --content <content>
+cc-company skill edit-file <skill-name> <file-path> --stdin
+cc-company skill remove-file <skill-name> <file-path>
 ```
 
-**필수 필드**: `name`, `description`
-**Optional 필드**: `model`, `allowedTools`, `context`, `agent`, `userInvocable`, `disableModelInvocation`, `argumentHint`
+- `<file-path>`는 skill 디렉토리 기준 상대경로 (예: `scripts/run-deploy.sh`)
+- `add-file`: 파일 생성 + SKILL.md resources에 자동 등록
+- `remove-file`: 파일 삭제 + resources에서 자동 제거
+- `--content`와 `--stdin` 중 하나 필수. 둘 다 없으면 에러.
+
+### Skill 상세 조회
+
+```bash
+cc-company skill show <name>    # 메타데이터 + 파일 목록 + resources 불일치 경고
+```
 
 ## Hook JSON 형식
 
@@ -172,7 +210,7 @@ Hook은 config 필드가 구조화된 JSON이므로 `.json` 형식을 유지한
 | subagents (resolved) | `--agents '{...}'` |
 | mcp.json | `--mcp-config` |
 | settings.json | `--settings` |
-| skills/hooks (plugins) | `--plugin-dir` |
+| skills (resolved) | `--add-dir` (임시 디렉토리 경로) |
 
 ## 기본 Agent 템플릿
 
```

## `docs/test-cases.md`

```diff
diff --git a/docs/test-cases.md b/docs/test-cases.md
index ac6b34f..6b3b2bd 100644
--- a/docs/test-cases.md
+++ b/docs/test-cases.md
@@ -13,7 +13,10 @@
 ✓ subagents 여러개 → --agents JSON에 전부 포함
 ✓ mcp.json 존재 → --mcp-config 경로 포함
 ✓ settings.json 존재 → --settings 경로 포함
-✓ plugins 디렉토리 존재 → --plugin-dir 경로 포함
+
+[--add-dir]
+✓ addDirPath 있으면 → --add-dir 플래그 생성
+✓ addDirPath undefined → --add-dir 생략
 
 [패스스루]
 ✓ 패스스루 플래그가 그대로 뒤에 붙는지
@@ -47,6 +50,23 @@
 ✓ removeSubagent → 파일 삭제
 ✓ 존재하지 않는 리소스 get → 에러
 
+[Skill 디렉토리 CRUD]
+✓ createSkill → skills/{name}/ 디렉토리 + SKILL.md + 서브디렉토리 스캐폴딩 생성
+✓ getSkill → 디렉토리 내 SKILL.md 파싱하여 SkillConfig 반환
+✓ listSkills → 디렉토리 순회로 전체 목록 반환
+✓ removeSkill → 디렉토리 통째로 삭제
+✓ 존재하지 않는 skill getSkill → 에러
+
+[Skill 파일 CRUD]
+✓ addSkillFile → 파일 생성 + SKILL.md resources에 자동 등록
+✓ editSkillFile 존재하지 않는 파일 → 에러
+✓ removeSkillFile → 파일 삭제 + resources에서 자동 제거
+✓ removeSkillFile 존재하지 않는 파일 → 에러
+
+[마이그레이션]
+✓ skills/ 내 단일 .md 파일 → getSkill 시 디렉토리로 자동 변환 + 원본 제거
+✓ 이미 디렉토리인 skill → 마이그레이션 스킵 (정상 동작)
+
 [참조 해석]
 ✓ agent.json의 subagents 이름 배열 → 실제 파일 내용으로 resolve
 ✓ 참조된 리소스가 공용 풀에 없을 때 → 에러
@@ -73,10 +93,30 @@ store는 in-memory fake 또는 실제 fs-store + 임시 디렉토리.
 ✓ 아무 agent에도 할당되지 않은 리소스 삭제 → 정상
 ✓ 할당된 agent가 있는 리소스 삭제 → 경고 메시지 출력
 
+[resource.service — Skill show + 불일치 경고]
+✓ showSkill → config + 파일 목록 반환
+✓ showSkill resources 불일치 시 경고 출력
+
 [run.service]
 ✓ 존재하지 않는 agent로 run → 에러
 ✓ spawner exitCode 0 → 로그에 정상 기록
 ✓ spawner exitCode 1 → 로그에 실패 기록 + exitCode 전파
+
+[run.service — --add-dir 임시 디렉토리]
+✓ skills 있는 agent run → .tmp/run-{uuid}/.claude/skills/ 에 디렉토리 복사
+✓ skills 없는 agent run → .tmp 생성하지 않음, --add-dir 없음
+✓ 실행 완료 후 임시 디렉토리 정리됨
+
+[run.service — --add-dir 차단]
+✓ passthroughFlags에 --add-dir 포함 → 에러
+
+[run.service — stale 정리]
+✓ 1시간 이상 경과한 .tmp/run-* 디렉토리 → run 시 자동 삭제
+✓ 1시간 미만 .tmp/run-* → 삭제하지 않음
+
+[run.service — resources 불일치 경고]
+✓ resources에 등록됐지만 파일 없음 → console.warn
+✓ 파일 존재하지만 resources에 미등록 → console.warn
 ```
 
 ## frontmatter utils (유닛, ~8개)
@@ -93,6 +133,14 @@ store는 in-memory fake 또는 실제 fs-store + 임시 디렉토리.
 ✓ 정상적인 skill frontmatter + body → name, description, prompt 추출
 ✓ skill optional 필드(allowedTools, context, agent) 포함 → 해당 필드 파싱
 
+[파싱 - Skill / resources]
+✓ resources 배열 포함된 frontmatter → resources 필드 정상 파싱
+✓ resources 미포함 → resources는 undefined
+
 [직렬화]
 ✓ serialize 후 parse → 원본과 동일 (round-trip)
+
+[직렬화 - Skill / resources]
+✓ resources 있는 SkillConfig serialize → parse → 원본과 동일 (round-trip)
+✓ resources가 undefined → 직렬화 시 resources 키 생략
 ```
```

## `docs/testing.md`

```diff
diff --git a/docs/testing.md b/docs/testing.md
index 1d49b4c..67a848b 100644
--- a/docs/testing.md
+++ b/docs/testing.md
@@ -16,7 +16,7 @@
 |---|---|---|---|
 | flag-builder | 유닛 | 철저히 | 변환 로직이 틀리면 claude가 엉뚱하게 실행됨 |
 | frontmatter (utils) | 유닛 | 철저히 | 파싱이 틀리면 prompt가 통째로 날아감 |
-| store (fs-store) | 통합 | 핵심 경로 | 파일 I/O는 실제로 돌려봐야 의미 있음 |
+| store (fs-store) | 통합 | 핵심 경로 | 파일 I/O는 실제로 돌려봐야 의미 있음. skill 디렉토리 CRUD, 파일 CRUD, 마이그레이션 포함 |
 | services | 유닛 | 핵심 분기만 | 리소스 없을 때 에러, assign 자동 생성 등 |
 | commands | 없음 | - | commander 파싱은 프레임워크 책임 |
 | spawner | 없음 | - | child_process mock은 가치 없음. dry-run으로 수동 검증 |
```
