#!/usr/bin/env bash
set -euo pipefail
set -x

commit_message="${1:-update code}"
work_branch="force-cover-public"
remote_name="public_researvo"
remote_branch="main"

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  set +x
  echo "Error: working tree has uncommitted changes. Commit or stash them before running $0." >&2
  git status --short
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${work_branch}"; then
  set +x
  echo "Error: local branch '${work_branch}' already exists. Delete or rename it before running $0." >&2
  exit 1
fi

### 1. 确保在 B 的 main 分支，切出全新覆盖分支

git checkout main
git checkout -b "$work_branch"

### 2. 联网获取 A 的最新状态，并将历史起点“偷梁换柱”成 A

git fetch "$remote_name"
git reset --soft "${remote_name}/${remote_branch}"

### 3. 重新打包并强推覆盖

git commit -m "$commit_message"
git push "$remote_name" "${work_branch}:${remote_branch}" --force

# 4. 清理现场回到日常开发

git checkout main
git branch -D "$work_branch"
