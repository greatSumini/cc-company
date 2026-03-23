---
name: submit-pr-review
description: PR 리뷰를 인라인 코멘트와 함께 GitHub에 제출
---

PR 리뷰를 GitHub에 제출하는 skill이다. `../scripts/submit-pr-review.py` 스크립트를 사용한다.

## 사용법

리뷰 분석이 끝나면, 아래 형식의 JSON을 구성하여 스크립트에 stdin으로 전달하라:

```bash
echo '{"pr": 1, "event": "COMMENT", "body": "종합 리뷰 본문", "comments": [{"path": "src/foo.ts", "line": 42, "body": "p2: 코멘트"}]}' | python3 .cc-company/scripts/submit-pr-review.py
```

## Input JSON 스키마

- `pr` (int, 필수): PR 번호
- `event` (string, 필수): `COMMENT`, `APPROVE`, `REQUEST_CHANGES` 중 하나
- `body` (string, 필수): 종합 리뷰 본문
- `comments` (array, 선택): 인라인 코멘트 배열
  - `path` (string): 파일 경로 (repo root 기준)
  - `line` (int): 코멘트 대상 끝 줄 번호
  - `start_line` (int, 선택): 멀티라인 코멘트의 시작 줄 번호
  - `body` (string): 코멘트 내용 (markdown 지원)

## 주의사항

- `line`은 반드시 PR diff에 포함된 줄이어야 한다. diff에 없는 줄에 코멘트하면 API가 거부한다.
- 멀티라인은 `start_line`과 `line`이 모두 diff 범위 내에 있어야 한다.
- JSON은 반드시 유효해야 한다. 특수문자는 이스케이프하라.
- 한 번의 호출로 모든 인라인 코멘트를 일괄 제출한다. 개별 호출하지 마라.
