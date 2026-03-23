#!/usr/bin/env python3
"""
cc-company release script.
Bumps version, builds, tests, commits, and tags.

Usage: python3 scripts/release.py <patch|minor|major>
"""

import json
import subprocess
import sys
from pathlib import Path

from _utils import find_project_root

ROOT = find_project_root()


# ---------------------------------------------------------------------------
# Version helpers
# ---------------------------------------------------------------------------

def read_version() -> str:
    """Read current version from package.json."""
    package_json = ROOT / "package.json"
    with open(package_json, "r") as f:
        data = json.load(f)
    return data["version"]


def bump_version(current: str, bump_type: str) -> str:
    """Bump version according to semver rules."""
    parts = current.split(".")
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])

    bump_type = bump_type.lower()
    if bump_type == "patch":
        patch += 1
    elif bump_type == "minor":
        minor += 1
        patch = 0
    elif bump_type == "major":
        major += 1
        minor = 0
        patch = 0

    return f"{major}.{minor}.{patch}"


def update_package_json(new_version: str):
    """Update version field in package.json."""
    package_json = ROOT / "package.json"
    with open(package_json, "r") as f:
        data = json.load(f)

    data["version"] = new_version

    with open(package_json, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


# ---------------------------------------------------------------------------
# Command execution
# ---------------------------------------------------------------------------

def run_cmd(cmd: list[str], description: str) -> bool:
    """Run a command and return True on success, False on failure."""
    result = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    if result.returncode != 0:
        print(f"{description} failed.")
        if result.stderr:
            print(result.stderr)
        return False
    return True


def rollback_package_json(staged: bool = False):
    """Restore package.json to HEAD state.

    Args:
        staged: If True, also unstage the file before restoring.
    """
    if staged:
        subprocess.run(
            ["git", "reset", "HEAD", "package.json"],
            cwd=str(ROOT),
            capture_output=True,
        )
    subprocess.run(
        ["git", "checkout", "--", "package.json"],
        cwd=str(ROOT),
        capture_output=True,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def print_usage():
    print("Usage: python3 scripts/release.py <patch|minor|major>")
    print("")
    print("Bumps version, builds, tests, commits, and tags.")
    print("")
    print("Arguments:")
    print("  patch   Bump patch version (0.2.0 -> 0.2.1)")
    print("  minor   Bump minor version (0.2.0 -> 0.3.0)")
    print("  major   Bump major version (0.2.0 -> 1.0.0)")


def main():
    # CLI argument parsing
    if len(sys.argv) < 2 or sys.argv[1] in ("--help", "-h"):
        print_usage()
        sys.exit(1)

    bump_type = sys.argv[1].lower()
    if bump_type not in ("patch", "minor", "major"):
        print(f"Invalid bump type: {sys.argv[1]}")
        print_usage()
        sys.exit(1)

    # Version bump
    current = read_version()
    new_version = bump_version(current, bump_type)
    print(f"  {current} → {new_version}")

    update_package_json(new_version)

    # Build
    if not run_cmd(["npm", "run", "build"], "Build"):
        print("Build failed. Rolled back package.json.")
        rollback_package_json()
        sys.exit(1)

    # Test
    if not run_cmd(["npm", "test"], "Tests"):
        print("Tests failed. Rolled back package.json.")
        rollback_package_json()
        sys.exit(1)

    # Git add package.json
    subprocess.run(
        ["git", "add", "package.json"],
        cwd=str(ROOT),
        capture_output=True,
    )

    # Check if CHANGELOG.md exists and is modified
    changelog_path = ROOT / "CHANGELOG.md"
    if changelog_path.exists():
        # Check git status for CHANGELOG.md
        result = subprocess.run(
            ["git", "status", "--porcelain", "CHANGELOG.md"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        # If modified (M) or added (A), include in staging
        status_line = result.stdout.strip()
        if status_line and status_line[0] in ("M", "A", " ") and len(status_line) > 1:
            subprocess.run(
                ["git", "add", "CHANGELOG.md"],
                cwd=str(ROOT),
                capture_output=True,
            )

    # Git commit
    commit_msg = f"chore(release): v{new_version}"
    result = subprocess.run(
        ["git", "commit", "-m", commit_msg],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        rollback_package_json(staged=True)
        print(f"Commit failed. Rolled back package.json.\n{result.stderr}")
        sys.exit(1)

    # Git tag
    tag = f"v{new_version}"
    result = subprocess.run(
        ["git", "tag", tag],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Tag failed: {result.stderr}")
        sys.exit(1)

    # Output new version
    print(new_version)


if __name__ == "__main__":
    main()
