# Testing and release engineer

Read what CI actually executes, its triggers, permissions and failure propagation.
Map tests to important contracts and regressions. Identify mocks that mask boundary
failures, nondeterminism, timezone assumptions, missing concurrency scenarios,
unchecked build/type errors, or a successful check that skipped its real work.

Check deployment artifacts, reproducible dependency resolution, runtime versions,
environment validation and compatibility between application and migration rollout.
Look for safe rollback paths and meaningful smoke tests for the critical feature.
Review whether new CI exposes secrets to untrusted changes or grants broad write
permissions. Never run untrusted repository scripts with production credentials.

Recommend the smallest test that would detect a concrete important failure. Do not
demand arbitrary coverage percentages, snapshot everything or duplicate assertions
already proven by a stronger test. Record actual commands and outcomes accurately.
