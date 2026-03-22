#!/usr/bin/env python3
"""
soul-manager.py — Soul TOML 항목 관리 CLI

Subcommands:
  touch  - 지정 항목의 last_used_at을 오늘 날짜로 갱신
  stale  - last_used_at이 N일 이상 지난 항목 목록 출력
  remove - 지정 항목 제거
  grace  - 지정 항목의 last_used_at을 7일 전으로 갱신
"""

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import tomlkit

from _utils import find_project_root


def parse_entry_ref(ref: str) -> tuple[str, int]:
    """파일경로:id 형식 파싱. (파일경로, id) 튜플 반환."""
    if ":" not in ref:
        raise ValueError(f"Invalid format: {ref}. Expected 'file:id'")
    path, id_str = ref.rsplit(":", 1)
    try:
        entry_id = int(id_str)
    except ValueError:
        raise ValueError(f"Invalid id: {id_str}. Must be an integer")
    return path, entry_id


def load_toml(file_path: Path) -> tomlkit.TOMLDocument:
    """TOML 파일 로드."""
    return tomlkit.parse(file_path.read_text(encoding="utf-8"))


def save_toml(file_path: Path, doc: tomlkit.TOMLDocument) -> None:
    """TOML 파일 저장 (포맷 보존)."""
    file_path.write_text(tomlkit.dumps(doc), encoding="utf-8")


def find_entry_index(entries: list, entry_id: int) -> 'Optional[int]':
    """entries 리스트에서 id가 일치하는 항목의 인덱스 반환. 없으면 None."""
    for i, entry in enumerate(entries):
        if entry.get("id") == entry_id:
            return i
    return None


def cmd_touch(args: argparse.Namespace) -> None:
    """touch 서브커맨드: last_used_at을 오늘 날짜로 갱신."""
    root = find_project_root()
    today = date.today().isoformat()

    for ref in args.refs:
        try:
            path, entry_id = parse_entry_ref(ref)
        except ValueError as e:
            print(f"[ERROR] {e}", file=sys.stderr)
            continue

        file_path = root / path
        if not file_path.exists():
            print(f"[ERROR] File not found: {path}", file=sys.stderr)
            continue

        doc = load_toml(file_path)
        entries = doc.get("entries", [])
        idx = find_entry_index(entries, entry_id)

        if idx is None:
            print(f"[ERROR] Entry id={entry_id} not found in {path}", file=sys.stderr)
            continue

        entries[idx]["last_used_at"] = today
        save_toml(file_path, doc)
        print(f"[OK] {path}:{entry_id} -> last_used_at={today}")


def cmd_stale(args: argparse.Namespace) -> None:
    """stale 서브커맨드: last_used_at이 N일 이상 지난 항목 출력."""
    root = find_project_root()
    threshold = date.today() - timedelta(days=args.days)
    stale_entries = []

    for toml_file in sorted((root / "soul").glob("**/*.toml")):
        doc = load_toml(toml_file)
        entries = doc.get("entries", [])
        rel_path = str(toml_file.relative_to(root))

        for entry in entries:
            last_used = entry.get("last_used_at")
            if not last_used:
                continue
            try:
                last_date = date.fromisoformat(last_used)
            except ValueError:
                continue

            if last_date <= threshold:
                days_since = (date.today() - last_date).days
                stale_entries.append({
                    "file": rel_path,
                    "id": entry.get("id"),
                    "content": entry.get("content", "")[:50],
                    "last_used_at": last_used,
                    "days_since": days_since,
                })

    if args.format == "json":
        print(json.dumps(stale_entries, ensure_ascii=False, indent=2))
    else:
        # human format: 파일별 그룹핑
        by_file: dict[str, list] = {}
        for e in stale_entries:
            by_file.setdefault(e["file"], []).append(e)

        if not by_file:
            print("No stale entries found.")
            return

        for file_path, entries in by_file.items():
            print(f"\n{file_path}")
            print("-" * 80)
            print(f"{'ID':>4}  {'Last Used':>12}  {'Days':>5}  Content")
            print("-" * 80)
            for e in entries:
                content_preview = e["content"].replace("\n", " ")[:50]
                print(f"{e['id']:>4}  {e['last_used_at']:>12}  {e['days_since']:>5}  {content_preview}")


def cmd_remove(args: argparse.Namespace) -> None:
    """remove 서브커맨드: 지정 항목 제거."""
    root = find_project_root()

    for ref in args.refs:
        try:
            path, entry_id = parse_entry_ref(ref)
        except ValueError as e:
            print(f"[ERROR] {e}", file=sys.stderr)
            continue

        file_path = root / path
        if not file_path.exists():
            print(f"[ERROR] File not found: {path}", file=sys.stderr)
            continue

        doc = load_toml(file_path)
        entries = doc.get("entries", [])
        idx = find_entry_index(entries, entry_id)

        if idx is None:
            print(f"[ERROR] Entry id={entry_id} not found in {path}", file=sys.stderr)
            continue

        del entries[idx]
        save_toml(file_path, doc)
        print(f"[OK] Removed {path}:{entry_id}")


def cmd_grace(args: argparse.Namespace) -> None:
    """grace 서브커맨드: last_used_at을 7일 전으로 갱신."""
    root = find_project_root()
    grace_date = (date.today() - timedelta(days=7)).isoformat()

    for ref in args.refs:
        try:
            path, entry_id = parse_entry_ref(ref)
        except ValueError as e:
            print(f"[ERROR] {e}", file=sys.stderr)
            continue

        file_path = root / path
        if not file_path.exists():
            print(f"[ERROR] File not found: {path}", file=sys.stderr)
            continue

        doc = load_toml(file_path)
        entries = doc.get("entries", [])
        idx = find_entry_index(entries, entry_id)

        if idx is None:
            print(f"[ERROR] Entry id={entry_id} not found in {path}", file=sys.stderr)
            continue

        entries[idx]["last_used_at"] = grace_date
        save_toml(file_path, doc)
        print(f"[OK] {path}:{entry_id} -> last_used_at={grace_date}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Soul TOML entry manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # touch
    touch_parser = subparsers.add_parser("touch", help="Update last_used_at to today")
    touch_parser.add_argument(
        "refs",
        nargs="+",
        metavar="FILE:ID",
        help="Entry references (e.g., soul/ai/insights.toml:1)",
    )
    touch_parser.set_defaults(func=cmd_touch)

    # stale
    stale_parser = subparsers.add_parser("stale", help="List stale entries")
    stale_parser.add_argument(
        "--days",
        type=int,
        required=True,
        help="Threshold in days",
    )
    stale_parser.add_argument(
        "--format",
        choices=["json", "human"],
        default="json",
        help="Output format (default: json)",
    )
    stale_parser.set_defaults(func=cmd_stale)

    # remove
    remove_parser = subparsers.add_parser("remove", help="Remove entries")
    remove_parser.add_argument(
        "refs",
        nargs="+",
        metavar="FILE:ID",
        help="Entry references to remove",
    )
    remove_parser.set_defaults(func=cmd_remove)

    # grace
    grace_parser = subparsers.add_parser("grace", help="Set last_used_at to 7 days ago")
    grace_parser.add_argument(
        "refs",
        nargs="+",
        metavar="FILE:ID",
        help="Entry references",
    )
    grace_parser.set_defaults(func=cmd_grace)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
