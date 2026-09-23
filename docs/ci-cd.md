# CI/CD and releases

## Normal changes

Create a feature branch, open a pull request into main, and wait for all nine
required checks: three Maven test jobs, one dashboard test job, four container build jobs, and deployment
manifest validation (which also tests promotion logic). Keep the PR up to date
with main. Required checks apply to administrators too. A second reviewer is not
required for this single-maintainer repository.

PR builds have read-only token permissions and do not publish images or deploy.
A separate main-only publishing job receives package write permission. After merge, CI tests again and
publishes all four images with the full main commit SHA. The mutable latest tag
is no longer published; deployment always uses SHA tags.

## Promotion

Promotion is two-stage: every main merge automatically deploys to **staging**;
shipping to **production** is a separate, deliberate step.

Argo CD watches two branches: deploy/staging (path gitops/behavior-staging,
namespace behavior-staging) and deploy/homelab (path gitops/behavior, namespace
behavior — production). Both promotion jobs are the normal writers of their
respective branches; do not merge either back into main.

`.github/scripts/promote.py <source-sha> <environment>` (`environment` is
`staging` or `homelab`) does the actual work, run only after all main checks and
image publications succeed:
1. Fetch main and the target deploy branch.
2. Skip if the build SHA is no longer the tip of main.
3. Prepare a deployment commit containing the exact tested source snapshot,
   with all four image tags set to the build SHA. This promotes configuration
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

**Staging** (`.github/workflows/java-ci.yml`'s `promote` job) runs automatically
on every push to main, invoking `promote.py "$SOURCE_SHA" staging`. It runs the
full pipeline in `behavior-staging` with its own TimescaleDB and Kafka topics,
sharing only the Kafka cluster (namespace `kafka`) and the k3s node:

- `ingestion-api` (node port 18090) writes only to `staging.app-usage-events.raw.v1`.
- `stream-processor` reads production's `app-usage-events.raw.v1` (your real
  iPhone events) and `staging.app-usage-events.raw.v1` (test events) under its
  own consumer group `raw-event-persistence-staging-v1`, so production's group
  keeps every event; it dead-letters to `staging.app-usage-events.dlq.v1`.
- `analytics-api` and `dashboard` read staging's own database, which is filled
  from every event Kafka still retains the first time the staging consumer group starts.

Kafka has no ACLs, so only configuration keeps staging off production's topics.
CI's `validate` job renders both overlays and runs
`.github/scripts/check_staging_isolation.py`, which fails the build if staging
would write to a production topic, share production's consumer group, point at
production's namespace, or reuse one of production's node ports. A
ResourceQuota, LimitRange and low PriorityClass (`gitops/behavior-staging/`)
cap staging's share of the node and make it the first to be evicted.

Write-side changes (ingestion, sessionization, rollups) are therefore testable
on staging against real events before production. See `kubernetes/README.md`
for staging's secrets and sending a test event.

**Production** (`.github/workflows/promote-production.yml`) only runs on manual
`workflow_dispatch`, invoking `promote.py "$(git rev-parse HEAD)" homelab` against
whatever is currently the tip of main — i.e. whatever staging is already running.
Because `promote.py` always operates on the current tip of main (aborting as
superseded otherwise), there's no way to cherry-pick an older commit. It also
refuses (the run fails) unless all four image tags on deploy/staging already
equal that commit, so production promotion always means "ship what's currently
in staging." If it refuses, wait for the main CI run to finish its staging
promotion, check staging, then run it again.

Each environment has its own dashboard URL, and a URL is only ever served by its
own environment's `dashboard` Service: staging at `https://chris.taildcd567.ts.net/`
(tailnet only) and production at `https://behavior-dashboard.taildcd567.ts.net/`
(public). See the Dashboard URLs section of `kubernetes/README.md` for setup.

## Operations

The deploy/homelab branch is bootstrapped from the previous main snapshot so the
Argo switch preserves the existing release. No application rebuild is needed for
that switch. New successful main runs then advance the deployment branch.

A green Actions run confirms tests, images and promotion, not end-to-end runtime
health. Check Argo CD Synced/Healthy and the deployed image tags for both the
`behavior` and `behavior-staging` Applications. Automated runtime smoke tests and
failure notifications are not yet implemented.

For rollback, revert the relevant promotion commit on the affected deploy branch
with a normal commit, and verify Argo synchronization. Pause or account for active
promotions first: a later successful main run will deploy its own tested snapshot
to staging regardless. A permanent fix should also be made through a PR to main.
Never force-push any deploy branch.
