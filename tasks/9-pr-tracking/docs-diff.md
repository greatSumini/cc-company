# docs-diff: pr-tracking

Baseline: `d7e87fc`

## `docs/spec.md`

```diff
diff --git a/docs/spec.md b/docs/spec.md
index e4fea98..5fe860c 100644
--- a/docs/spec.md
+++ b/docs/spec.md
@@ -280,6 +280,32 @@ Hook은 config 필드가 구조화된 JSON이므로 `.json` 형식을 유지한
 - `mode`: `"interactive"` 또는 `"print"`. `-p` flag 유무로 결정.
 - `prompt`: interactive mode에서 prompt 없이 시작한 경우 `null`.
 
+## Task Index 스키마
+
+### `/tasks/index.json` (top-level)
+
+```json
+{
+  "repositoryUrl": "https://github.com/owner/repo",
+  "tasks": [
+    {
+      "id": 0,
+      "name": "mvp",
+      "dir": "0-mvp",
+      "status": "completed",
+      "created_at": "2026-03-19T01:55:23+09:00",
+      "completed_at": "2026-03-19T02:29:19+09:00",
+      "pr_number": 1,
+      "pr_url": "https://github.com/owner/repo/pull/1"
+    }
+  ]
+}
+```
+
+- `repositoryUrl`: GitHub repository URL. 최초 PR 생성 시 자동 추가.
+- `pr_number`: PR 번호. PR 생성 시 자동 기록.
+- `pr_url`: PR 전체 URL. PR 생성 시 자동 기록.
+
 ## Claude Code 플래그 매핑
 
 | agent 설정 | Claude Code 플래그 |
```
