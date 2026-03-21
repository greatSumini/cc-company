# cc-company Test Cases

## flag-builder (유닛, ~15개)

```
[기본]
✓ prompt.md만 있는 agent → --append-system-prompt-file만 생성
✓ 모든 설정이 있는 agent → 전체 플래그 생성
✓ 설정이 하나도 없는 agent → 빈 플래그 배열 + prompt만

[개별 플래그 매핑]
✓ subagents 1개 → --agents JSON에 1개 포함
✓ subagents 여러개 → --agents JSON에 전부 포함
✓ mcp.json 존재 → --mcp-config 경로 포함
✓ settings.json 존재 → --settings 경로 포함

[--add-dir]
✓ addDirPath 있으면 → --add-dir 플래그 생성
✓ addDirPath undefined → --add-dir 생략

[패스스루]
✓ 패스스루 플래그가 그대로 뒤에 붙는지
✓ 패스스루에 -p 포함 시 정상 전달
✓ 패스스루 없을 때 빈 배열

[프롬프트]
✓ prompt 문자열이 플래그 배열 마지막에 위치하는지
✓ prompt에 특수문자/공백 포함 시 이스케이프 정상 처리

[엣지 케이스]
✓ subagents 배열이 빈 배열 → --agents 플래그 생략
✓ optional 필드 전부 undefined → 에러 없이 최소 플래그만 생성
```

## store - fs-store (통합, ~10개)

실제 임시 디렉토리(os.tmpdir)에서 실행.

```
[agent CRUD]
✓ createAgent → 디렉토리 + agent.json + prompt.md 생성 확인
✓ getAgent → 생성한 agent를 정확히 읽어오는지
✓ listAgents → 복수 agent 목록 반환
✓ removeAgent → 디렉토리 삭제 확인
✓ 존재하지 않는 agent getAgent → 에러

[공용 리소스 CRUD]
✓ createSubagent → .cc-company/subagents/ 에 파일 생성
✓ listSubagents → 전체 목록
✓ removeSubagent → 파일 삭제
✓ 존재하지 않는 리소스 get → 에러

[Skill 디렉토리 CRUD]
✓ createSkill → skills/{name}/ 디렉토리 + SKILL.md + 서브디렉토리 스캐폴딩 생성
✓ getSkill → 디렉토리 내 SKILL.md 파싱하여 SkillConfig 반환
✓ listSkills → 디렉토리 순회로 전체 목록 반환
✓ removeSkill → 디렉토리 통째로 삭제
✓ 존재하지 않는 skill getSkill → 에러

[Skill 파일 CRUD]
✓ addSkillFile → 파일 생성 + SKILL.md resources에 자동 등록
✓ editSkillFile 존재하지 않는 파일 → 에러
✓ removeSkillFile → 파일 삭제 + resources에서 자동 제거
✓ removeSkillFile 존재하지 않는 파일 → 에러

[마이그레이션]
✓ skills/ 내 단일 .md 파일 → getSkill 시 디렉토리로 자동 변환 + 원본 제거
✓ 이미 디렉토리인 skill → 마이그레이션 스킵 (정상 동작)

[참조 해석]
✓ agent.json의 subagents 이름 배열 → 실제 파일 내용으로 resolve
✓ 참조된 리소스가 공용 풀에 없을 때 → 에러
```

## services (유닛, ~8개)

store는 in-memory fake 또는 실제 fs-store + 임시 디렉토리.

```
[agent.service — assign]
✓ 공용 풀에 있는 리소스 assign → agent.json에 이름 추가
✓ 공용 풀에 없는 리소스 assign → 공용 풀에 생성 + agent.json에 추가
✓ 이미 할당된 리소스 중복 assign → 무시 (에러 아님)

[agent.service — unassign]
✓ 할당된 리소스 unassign → agent.json에서 제거, 공용 풀은 유지
✓ 할당되지 않은 리소스 unassign → 에러

[agent.service — remove]
✓ agent 삭제 시 공용 풀 리소스는 영향 없음

[resource.service — remove]
✓ 아무 agent에도 할당되지 않은 리소스 삭제 → 정상
✓ 할당된 agent가 있는 리소스 삭제 → 경고 메시지 출력

[resource.service — Skill show + 불일치 경고]
✓ showSkill → config + 파일 목록 반환
✓ showSkill resources 불일치 시 경고 출력

[run.service]
✓ 존재하지 않는 agent로 run → 에러
✓ spawner exitCode 0 → 로그에 정상 기록
✓ spawner exitCode 1 → 로그에 실패 기록 + exitCode 전파

[run.service — --add-dir 임시 디렉토리]
✓ skills 있는 agent run → .tmp/run-{uuid}/.claude/skills/ 에 디렉토리 복사
✓ skills 없는 agent run → .tmp 생성하지 않음, --add-dir 없음
✓ 실행 완료 후 임시 디렉토리 정리됨

[run.service — --add-dir 차단]
✓ passthroughFlags에 --add-dir 포함 → 에러

[run.service — stale 정리]
✓ 1시간 이상 경과한 .tmp/run-* 디렉토리 → run 시 자동 삭제
✓ 1시간 미만 .tmp/run-* → 삭제하지 않음

[run.service — resources 불일치 경고]
✓ resources에 등록됐지만 파일 없음 → console.warn
✓ 파일 존재하지만 resources에 미등록 → console.warn
```

## frontmatter utils (유닛, ~8개)

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

[파싱 - Skill / resources]
✓ resources 배열 포함된 frontmatter → resources 필드 정상 파싱
✓ resources 미포함 → resources는 undefined

[직렬화]
✓ serialize 후 parse → 원본과 동일 (round-trip)

[직렬화 - Skill / resources]
✓ resources 있는 SkillConfig serialize → parse → 원본과 동일 (round-trip)
✓ resources가 undefined → 직렬화 시 resources 키 생략
```
