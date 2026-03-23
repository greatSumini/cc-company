# spec-diff: soul-manager

Baseline: `588b045`

## `docs/adr.md`

```diff
diff --git a/spec/adr.md b/spec/adr.md
index 33aebcc..bfa380c 100644
--- a/spec/adr.md
+++ b/spec/adr.md
@@ -207,3 +207,19 @@
 **결정**: `--add-dir`을 cc-company 내부 전용으로 사용. 사용자가 passthrough로 전달하면 에러. `--add-dir` 차단 검증은 run.service(서비스 레이어)에서 수행 — command 레이어가 아닌 서비스 레이어에서 검증해야 테스트 가능.
 
 **임시 디렉토리**: `.cc-company/.tmp/run-{uuid}/.claude/skills/`에 skill 디렉토리 복사. `try/finally`로 정리 + 다음 run 시 1시간 이상 stale 디렉토리 자동 삭제.
+
+---
+
+## ADR-015: Soul entry 식별 방식 — 파일별 auto-increment 정수 ID
+
+**상태**: 확정 (2026-03-22)
+
+**맥락**: soul TOML 파일(`/soul/` 하위)의 `[[entries]]` 항목을 스크립트로 조작할 때, 개별 항목을 안정적으로 참조할 방법이 필요. 선택지: (1) 배열 인덱스 기반, (2) 파일별 auto-increment 정수 ID, (3) UUID/해시.
+
+**결정**: 파일별 auto-increment 정수 ID (`id` 필드)
+
+**근거**:
+- 인덱스 기반은 삭제 시 뒤 항목의 인덱스가 밀려 배치 처리에서 불안정
+- 정수 ID는 삭제 후에도 기존 항목의 ID가 변하지 않아 안정적 참조 가능
+- UUID/해시는 이 규모에서 과잉. 파일 내 유니크면 충분
+- 새 항목 추가 시 `max(id) + 1`로 부여. AI가 파일을 읽고 직접 할당
```
