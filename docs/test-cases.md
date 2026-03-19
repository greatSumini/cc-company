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
✓ plugins 디렉토리 존재 → --plugin-dir 경로 포함

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

[run.service]
✓ 존재하지 않는 agent로 run → 에러
✓ spawner exitCode 0 → 로그에 정상 기록
✓ spawner exitCode 1 → 로그에 실패 기록 + exitCode 전파
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

[직렬화]
✓ serialize 후 parse → 원본과 동일 (round-trip)
```
