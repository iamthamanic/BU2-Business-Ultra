# Feature: Projekte + Aufgaben

## Intent
Area vs custom projects, tasks (inbox when no project), board, my-tasks, recurrence with server-side idempotent materialization. CheckMap untouched.

## Preconditions
- Authenticated member with `projects` tab entitlement
- Editor+ for writes

## Happy Path
- [ ] Projects overview: areas/custom grouped, search, list/cards
- [ ] Create area + custom project
- [ ] Project detail: overview, tasks, board, settings
- [ ] Create task (with/without project); inbox → Meine Aufgaben
- [ ] Kanban status move; comments + checklist
- [ ] Recurrence rule + tick materializes once per (rule, scheduled_for)
- [ ] Custom progress = done/total; areas show open/overdue counts

## Edge Cases
- [ ] Tick idempotent (second call no duplicate)
- [ ] Skip materialize when project archived
- [ ] Cross-tenant project/task ID → 404
- [ ] Complete only on custom projects

## Assumptions
- Recurrence SoR = DB rules + occurrences unique; browser timer never SoR
- No private-project ACL in MVP
