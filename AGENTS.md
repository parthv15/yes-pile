# Agent instructions

Yes Pile is a client-only React + Vite + TypeScript app (Tailwind CSS, Dexie for IndexedDB storage). See [README.md](README.md) for what it does and how to run it.

## Workflow for every task

1. **Pull main first.** From the main checkout, run `git switch main && git pull --ff-only` before starting anything new.
2. **Work in a worktree.** Create one next to the main checkout, named after the task in short kebab-case, with a branch of the same name. Don't use `claude/`, `codex/` or other agent prefixes.

   ```sh
   git worktree add ../yes-pile-<task-name> -b <task-name>
   cd ../yes-pile-<task-name> && npm install
   ```

3. **Push and open a PR.** Commit in the worktree, push the branch, and open a pull request against `main` with `gh pr create`.
4. **Merge it.** Merge with a merge commit so each commit in the PR stays separate:

   ```sh
   gh pr merge <number> --merge
   ```

   Don't pass `--delete-branch`: it fails while the worktree still has the branch checked out, and then skips deleting the remote branch too.

5. **Clean up.** Back in the main checkout, remove the worktree, pull the merged change, and delete the branch locally and on GitHub:

   ```sh
   git worktree remove ../yes-pile-<task-name>
   git pull --ff-only
   git branch -d <task-name>
   git push origin --delete <task-name>
   ```

Every merge to `main` deploys to GitHub Pages, so a merged PR goes live straight away.

## Checks before pushing

- `npm run build` must pass (it type-checks too).
- Check UI changes in the browser at desktop and phone widths.
