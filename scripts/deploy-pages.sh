#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
npm test
npm run build
touch dist/.nojekyll

# Build the publishing commit with a temporary index. Keep the current branch,
# working files, and normal Git index intact. Never force-push a deployment.
publish_index=$(mktemp)
rm "$publish_index"
trap 'rm -f "$publish_index"' EXIT
export GIT_INDEX_FILE="$publish_index"
git read-tree --empty
git --work-tree=dist add --all --force -- .
publish_tree=$(git write-tree)

remote_branch=$(git ls-remote origin refs/heads/gh-pages)
publish_parents=()
if [[ -n "$remote_branch" ]]; then
  git fetch origin refs/heads/gh-pages
  publish_parents=(-p "$(git rev-parse FETCH_HEAD)")
fi
publish_commit=$(git commit-tree "$publish_tree" "${publish_parents[@]}" -m "Publish Elemental combat prototype")
git push origin "$publish_commit:refs/heads/gh-pages"
