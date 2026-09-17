# CI/CD and releases

## Normal changes

Create a feature branch, open a pull request into main, and wait for all seven
required checks: three Maven test jobs, three container build jobs, and deployment
manifest validation (which also tests promotion logic). Keep the PR up to date
with main. Required checks apply to administrators too. A second reviewer is not
required for this single-maintainer repository.

PR builds do not publish images or deploy. After merge, CI tests again and
publishes all three images with the full main commit SHA. The mutable latest tag
is no longer published; deployment always uses SHA tags.

## Promotion

Argo CD watches deploy/homelab, path gitops/behavior. The promotion job is the
normal writer of this branch; do not merge it back into main.

Promotion runs only after all main checks and image publications succeed:
1. Fetch main and deploy/homelab.
2. Skip if the build SHA is no longer the tip of main.
3. Prepare a deployment commit containing the exact tested source snapshot,
   with all three image tags set to the build SHA. This promotes configuration
   changes together with code, retaining the deployment branch's commit history.
4. Fetch and check main again immediately before pushing.
5. Push without force. On conflict, fetch and repeat, up to three attempts.

Superseded runs report a successful skip in the Actions summary. A failing newer
build does not permit an older build to promote; the prior deployed release stays
in place. PR runs cancel older runs for the same PR. Promotion jobs use normal Git push conflicts
to coordinate, avoiding concurrency queues that can discard pending releases.

The main check and deployment push are separate Git operations. A source commit
arriving after the final check can start the next release cycle while the checked
release is being pushed. This is not a cross-branch atomic transaction.

## Operations

The deploy/homelab branch is bootstrapped from the previous main snapshot so the
Argo switch preserves the existing release. No application rebuild is needed for
that switch. New successful main runs then advance the deployment branch.

A green Actions run confirms tests, images and promotion, not end-to-end runtime
health. Check Argo CD Synced/Healthy and the deployed image tags. Automated runtime
smoke tests and failure notifications are not yet implemented.

For rollback, revert the relevant promotion commit on deploy/homelab with a normal
commit, and verify Argo synchronization. Pause or account for active promotions
first: a later successful main run will deploy its own tested snapshot. A permanent
fix should also be made through a PR to main. Never force-push either branch.
