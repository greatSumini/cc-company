#!/usr/bin/env python3
"""
cc-company phase runner.
Reads tasks/{task-dir}/index.json, finds the next pending phase,
spawns a Claude Code session with the phase prompt, and updates status.

Usage: python3 run-phases.py <task-dir>
Example: python3 run-phases.py 0-mvp
"""

import json
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
TASKS_DIR = ROOT / "tasks"
TOP_INDEX_FILE = TASKS_DIR / "index.json"

KST = timezone(timedelta(hours=9))


def now_iso() -> str:
    return datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S%z")
    # e.g. 2026-03-19T02:09:18+0900


def get_task_dir() -> Path:
    if len(sys.argv) < 2:
        print("Usage: python3 run-phases.py <task-dir>")
        print("Example: python3 run-phases.py 0-mvp")
        sys.exit(1)
    task_dir = TASKS_DIR / sys.argv[1]
    if not task_dir.is_dir():
        print(f"ERROR: Task directory not found: {task_dir}")
        sys.exit(1)
    return task_dir


def load_index(index_file: Path) -> dict:
    with open(index_file, "r") as f:
        return json.load(f)


def save_index(index_file: Path, data: dict):
    with open(index_file, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def find_next_phase(index: dict) -> dict | None:
    for phase in index["phases"]:
        if phase["status"] == "pending":
            return phase
    return None


def get_last_phase(index: dict) -> dict | None:
    for phase in reversed(index["phases"]):
        if phase["status"] != "pending":
            return phase
    return None


def load_phase_prompt(task_dir: Path, phase_num: int) -> str:
    phase_file = task_dir / f"phase{phase_num}.md"
    if not phase_file.exists():
        print(f"ERROR: {phase_file} not found")
        sys.exit(1)
    return phase_file.read_text()


def build_preamble(project_name: str, task_dir_name: str) -> str:
    return f"""당신은 {project_name} 프로젝트의 개발자입니다. 아래 phase의 작업을 수행하세요.

중요한 규칙:
1. 작업 전에 반드시 문서를 읽고 전체 설계를 이해하세요.
2. 이전 phase에서 작성된 코드를 꼼꼼히 읽고, 기존 코드와의 일관성을 유지하세요.
3. AC 검증을 직접 수행하고, 통과/실패에 따라 /tasks/{task_dir_name}/index.json을 업데이트하세요.
4. 불필요한 파일이나 코드를 추가하지 마세요. phase에 명시된 것만 작업하세요.
5. 기존 테스트를 깨뜨리지 마세요.

아래는 이번 phase의 상세 내용입니다:

"""


def run_phase(task_dir: Path, phase: dict, preamble: str) -> dict:
    phase_num = phase["phase"]
    phase_name = phase["name"]
    prompt_content = load_phase_prompt(task_dir, phase_num)

    full_prompt = preamble + prompt_content

    print(f"\n{'='*60}")
    print(f"  Phase {phase_num}: {phase_name}")
    print(f"{'='*60}\n")

    output_file = task_dir / f"phase{phase_num}-output.json"

    cmd = [
        "claude",
        "-p",
        "--dangerously-skip-permissions",
        "--output-format", "json",
        full_prompt,
    ]

    result = subprocess.run(
        cmd,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=600,  # 10 minutes per phase
    )

    output_data = {
        "phase": phase_num,
        "name": phase_name,
        "exitCode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }

    with open(output_file, "w") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Output saved to {output_file}")

    if result.returncode != 0:
        print(f"\nWARN: Claude exited with code {result.returncode}")
        print(f"stderr: {result.stderr[:500]}")

    return output_data


def check_phase_status(index_file: Path, phase_num: int) -> str:
    fresh_index = load_index(index_file)
    for phase in fresh_index["phases"]:
        if phase["phase"] == phase_num:
            return phase.get("status", "pending")
    return "pending"


def update_top_index_status(task_dir_name: str, status: str):
    if not TOP_INDEX_FILE.exists():
        return
    top_index = load_index(TOP_INDEX_FILE)
    ts = now_iso()
    for task in top_index.get("tasks", []):
        if task.get("dir") == task_dir_name:
            task["status"] = status
            if status == "completed":
                task["completed_at"] = ts
            elif status == "error":
                task["failed_at"] = ts
            break
    save_index(TOP_INDEX_FILE, top_index)


def main():
    task_dir = get_task_dir()
    task_dir_name = task_dir.name
    index_file = task_dir / "index.json"

    if not index_file.exists():
        print(f"ERROR: {index_file} not found")
        sys.exit(1)

    print(f"cc-company Phase Runner — task: {task_dir_name}")
    print("=" * 60)

    index = load_index(index_file)
    project_name = index.get("project", "cc-company")
    preamble = build_preamble(project_name, task_dir_name)

    # Check if last non-pending phase is error
    last = get_last_phase(index)
    if last and last["status"] == "error":
        print(f"\nERROR: Phase {last['phase']} ({last['name']}) failed.")
        if "error_message" in last:
            print(f"Error: {last['error_message']}")
        print(f"Fix the issue and reset the status to 'pending' in {index_file} to retry.")
        sys.exit(1)

    # Set task-level created_at if not already set
    if "created_at" not in index:
        index["created_at"] = now_iso()
        save_index(index_file, index)
    # Set top-level task created_at if not already set
    if TOP_INDEX_FILE.exists():
        top_index = load_index(TOP_INDEX_FILE)
        for task in top_index.get("tasks", []):
            if task.get("dir") == task_dir_name and "created_at" not in task:
                task["created_at"] = index["created_at"]
                save_index(TOP_INDEX_FILE, top_index)
                break

    while True:
        index = load_index(index_file)
        phase = find_next_phase(index)

        if phase is None:
            print("\nAll phases completed!")
            break

        # Record phase created_at (= execution start)
        ts_start = now_iso()
        for p in index["phases"]:
            if p["phase"] == phase["phase"] and "created_at" not in p:
                p["created_at"] = ts_start
                save_index(index_file, index)
                break

        run_phase(task_dir, phase, preamble)

        # Re-read index.json to check what Claude did
        fresh_index = load_index(index_file)
        status = None
        for p in fresh_index["phases"]:
            if p["phase"] == phase["phase"]:
                status = p.get("status", "pending")
                break
        status = status or "pending"

        ts_end = now_iso()

        if status == "error":
            for p in fresh_index["phases"]:
                if p["phase"] == phase["phase"]:
                    p["failed_at"] = ts_end
                    print(f"\nERROR: Phase {phase['phase']} ({phase['name']}) failed.")
                    if "error_message" in p:
                        print(f"Error: {p['error_message']}")
                    break
            save_index(index_file, fresh_index)
            print(f"Fix the issue and reset the status to 'pending' in {index_file} to retry.")
            update_top_index_status(task_dir_name, "error")
            sys.exit(1)

        if status == "completed":
            for p in fresh_index["phases"]:
                if p["phase"] == phase["phase"]:
                    p["completed_at"] = ts_end
                    break
            save_index(index_file, fresh_index)
            print(f"\nPhase {phase['phase']} ({phase['name']}) completed successfully.")
        elif status == "pending":
            print(f"\nWARN: Phase {phase['phase']} status still 'pending' after execution.")
            print("Claude may not have updated index.json. Marking as error.")

            for p in fresh_index["phases"]:
                if p["phase"] == phase["phase"]:
                    p["status"] = "error"
                    p["error_message"] = "Claude did not update index.json status"
                    p["failed_at"] = ts_end
                    break
            save_index(index_file, fresh_index)
            update_top_index_status(task_dir_name, "error")
            sys.exit(1)

    # All phases done — record task-level completed_at and update top-level index
    index = load_index(index_file)
    index["completed_at"] = now_iso()
    save_index(index_file, index)
    update_top_index_status(task_dir_name, "completed")

    print("\n" + "=" * 60)
    print(f"  Task {task_dir_name}: all phases completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
