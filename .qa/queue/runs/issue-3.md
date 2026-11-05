# Issue #3 — arch-customers-service-split

## Pipeline log
- 2026-11-05: claimed; branch `issue/3-arch-customers-service-split`
- implement: split customers God-file → service + crud/note/engagement routes (template match projects)

## Ship
- PR: https://github.com/iamthamanic/BU2-Business-Ultra/pull/10
- Merged SHA: 9451bac63cf821627e48cddd3e50934002e90457
- CI: build-test SUCCESS
- Composition gate: SKIPPED (API structural split)
- Verify: PASS (`pnpm run checks`)
- Review: ACCEPT (mechanical template match #2; AuthZ preserved)
- ECC: READY
