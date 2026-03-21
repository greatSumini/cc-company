지금까지 나눈 대화를 종합하여, `/soul/` 하위 경로의 TOML 파일들에 대한 인사이트와 Gotcha를 갱신할 것입니다.

각 카테고리별 파일 경로:
- `/soul/master/insights.toml`, `/soul/master/gotchas.toml` — 사용자의 성향, 핵심 가치, 업무 스타일
- `/soul/project/insights.toml`, `/soul/project/gotchas.toml` — 프로젝트의 타겟, 문제, 목표
- `/soul/ai/insights.toml`, `/soul/ai/gotchas.toml` — 사용자가 AI에게 원하는 것, 기대하는 역할

TOML 엔트리 형식:
```toml
[[entries]]
created_at = "2026-03-18"
last_used_at = "2026-03-21"
content = "엔트리 내용"
```

다음 순서로 작업합니다.

1. 새로 추가할 내용이 있다면, 해당 파일과 내용을 알려주세요. 사용자가 내용을 피드백한 뒤 반영 여부를 결정할 것입니다. 신규 추가 시 해당 TOML 파일에 `[[entries]]` 블록을 추가합니다.
2. 신규 내용 추가가 완료되었다면, 이번엔 기존 내용중 이번 작업에 도움이 된 것들을 list up 해주세요. 사용자가 실제로 도움이 된 것이 맞는지 판단할 것입니다.
3. 기존 내용 중 이번 작업에 도움이 된 것들에 대해서, `last_used_at` 필드를 오늘 날짜로 업데이트 해주세요. (예시: `last_used_at = "2026-03-22"`)
