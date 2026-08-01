# Customer journey smoke test

Use mocked providers in CI (`AI_PROVIDER=mock`, log mail, local storage, Stripe/WordPress fakes). For the optional staging run, set `STAGING_BASE_URL` and explicitly configured test services; never use production billing or customer sites.

- [ ] Register; confirm a session, audit event, welcome mail, and verification mail.
- [ ] Create/switch organization and confirm tenant isolation.
- [ ] Follow the signed email link; also verify resend throttling.
- [ ] Before verification, confirm dashboard/profile and one draft project work; generation, invites, WordPress, deployment, and billing return `email_verification_required`.
- [ ] Create a project and complete every business-profile wizard field.
- [ ] Start mock generation; observe live progress through completion.
- [ ] Open its revision; edit content and replace media; reload to prove persistence.
- [ ] Validate, resolve errors, approve, and record the exact revision/checksums.
- [ ] Add an HTTPS WordPress connection using an Application Password; verify REST, permissions, connector/Elementor versions, media/page/menu/settings/CSS capability, and warnings.
- [ ] Download and inspect the safe diagnostic report.
- [ ] Run deployment preview and confirm the pinned revision and planned changes.
- [ ] Confirm deployment, watch stage progress, and verify retry creates no duplicate pages/media/menu.
- [ ] Open every deployed URL and verify homepage/navigation and final summary.
- [ ] Exercise rollback to the prior approved revision and assignments.
- [ ] Confirm billing entitlement denial and payment-failure/free-plan behavior.
- [ ] Upload an allowed image; verify processing, variants, signed retrieval, usage, and deletion rules.

Record release, commit, environment, timestamps, diagnostic references, result, and tester. The optional staging command is `bash scripts/staging-smoke.sh`; it only probes health/readiness unless `STAGING_RUN_MUTATIONS=1` is deliberately supplied to a future environment-specific harness.
