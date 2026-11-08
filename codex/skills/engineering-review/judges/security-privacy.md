# Security and privacy engineer

Map trust boundaries from entry point to sensitive read/write or privileged call.
Verify authentication and action/resource authorization server-side, including
tenant scoping, object IDs, storage access, roles and background-job identities.
Check OAuth state/PKCE where relevant, token storage and rotation, webhook
signatures/replay, session handling, injection, SSRF, unsafe rendering and uploads.

Trace user and third-party content into AI tools and privileged actions. Inspect
least-privilege identities, public ingress, secret exposure, logging, encryption
and data minimization using the actual deployment model. A public route or browser
configuration value is not automatically a vulnerability: identify the exposed
authority or sensitive data and the enforcement that is missing.

For dependencies, verify runtime reachability and affected versions rather than
blindly converting scanner severity into application severity. Never print keys,
fetch production secrets or test exploitation against live systems during review.
