#!/usr/bin/env bash
set -euo pipefail
set -x

commit_message="${1:-update code}"

### 1. 确保在 B 的 main 分支，切出全新覆盖分支

git checkout main
git checkout -b force-cover-public

### 2. 联网获取 A 的最新状态，并将历史起点“偷梁换柱”成 A

git fetch public_researvo
git reset --soft public_researvo/main

### 3. 重新打包并强推覆盖

git commit -m "$commit_message"
git push public_researvo force-cover-public:main --force

# 4. 清理现场回到日常开发

git checkout main
git branch -D force-cover-public
