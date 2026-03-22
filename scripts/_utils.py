"""
Shared utilities for cc-company scripts.
"""

from pathlib import Path


def find_project_root() -> Path:
    """package.json이 존재하는 폴더를 만날 때까지 위로 이동하여 프로젝트 루트를 반환."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root (no package.json found)")
