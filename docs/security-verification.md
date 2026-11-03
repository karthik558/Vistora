# Security fixes and verification — 3 November 2026

## Guest feedback contract

- `/feedback` and unsigned `?property=…` URLs show a generic link-required message. They do not request or disclose a property directory.
- Public property enumeration is removed from `/api/properties`, including `?public=true`. A verified workspace session is required.
- Authorized generators obtain a short property-prefixed random token from `POST /api/feedback-links`; only its hash and server-side scope are stored. Server-side property access and feedback-module permission checks run before generation. Existing authenticated-encryption `pf.*` tokens remain valid. See `docs/feedback-questionnaires.md` for the additional migration and rollout.
- Property, room/touchpoint and preview mode are bound to the token. Guest form metadata, questions and submissions resolve the property from that token. A conflicting submitted property ID is rejected.
- Guests see the relevant property name/code at the top and have no property selector.
- Existing random invitation/stay tokens remain supported. Query parameters cannot override their property, guest or room. Expired/used invitations and inactive stays cannot open new public submissions.
- Invitation, stay, QR, room and worker-generated links use the scoped routes. Guest names/contact details are no longer embedded in newly generated invitation URLs.
- Public submissions return a receipt ID rather than the internal feedback record. Link-bearing pages and APIs use no-store/no-referrer policies.

## Other verified fixes

- Each protected API requires a provider-verified session. Display cookies never authorize operations. Membership and rights are checked afresh; the cross-request authorization cache was removed.
- New signups remain unassigned until explicit onboarding or invitation acceptance. The database trigger no longer falls back to the first company.
- Database policies prevent delegated managers from bypassing the API to promote profiles, administer properties/settings or configure escalation rules outside their property scope.
- One-time invitation completion, feedback and questionnaire answers commit atomically. Stay row locking prevents concurrent duplicate stay submissions. The existing in-flight checkout behavior is preserved behind the service-only RPC and the public API's active-stay check.
- The migration preserves all supported notification types, so low-rating escalation and guest acknowledgements work together.
- JSON API bodies have streaming byte limits, require JSON objects/media types and reject malformed content. Guest report imports retain a larger bounded allowance. Case multipart uploads are bounded before parsing.
- Browser mutations reject cross-origin, opaque and malformed Origin values and cross-site Fetch Metadata. Non-browser requests still require the endpoint's session, integration key or public token.
- Authentication/public submission throttles apply even to loopback requests. Limiter memory is bounded. Forwarded-IP headers are trusted only when explicitly configured.
- Removed the known development encryption-key fallback. Malformed encrypted tokens, including extra token components, are rejected.
- Unexpected exceptions do not return their internal messages. Authenticated API responses are non-cacheable. CSP blocks framing, restricts base/form destinations and permits eval only in development.

## Verification completed

- `npm test`: 73 passing tests, including the new `tests/security-boundaries.test.cjs` suite.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities reported by npm.
- Six database suites passed against an isolated local PostgreSQL database using synthetic fixtures: security boundaries, workspace isolation, hospitality, role mappings, escalation and guest imports.
- Eighteen HTTP smoke checks against localhost passed for unauthenticated/forged-cookie requests, bare feedback URLs, unsigned property/question requests, invalid public tokens, disabled role switching, worker/integration access, login validation and cross-origin rejection.
- Browser check: an authenticated administrator generated a scoped QR link; the guest form opened the matching property and questionnaire without a property selector. No real feedback, accounts or messages were submitted.

## Required production rollout

1. Back up and apply `supabase/migrations/20261103_security_boundaries.sql` after the existing OmniOps, guest automation, granular-rights, feedback-collection and guest-import migrations. The new migration was tested locally; it has **not been applied to the hosted Supabase project**. `schema.sql` includes the same final definitions for fresh installations.
2. Deploy the application changes with the existing stable `WORKSPACE_ENCRYPTION_KEY`. Do not rotate that key casually: existing encrypted links and integration secrets depend on it. There is no public/default key fallback.
3. Regenerate previously printed/shared URLs containing only `?property=…`. They are intentionally rejected. Existing opaque invitation/stay links continue to work.
4. Set `TRUSTED_CLIENT_IP_HEADER` only when the production ingress overwrites that header with the actual client IP. Supported headers are `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip`. Without a trusted header, callers share a conservative quota rather than being allowed to forge individual IP quotas.
5. The current rate limiter is per process. Multi-instance production deployments need equivalent shared/gateway limits, particularly for login and guest submissions.

This is a verified set of fixes, not a certification that no unknown vulnerabilities remain. Hosted RLS/configuration and production ingress behavior must be verified after rollout. Tests did not create production accounts, send production messages or run destructive production scans. Existing orphaned visitor profiles were not reassigned automatically.
