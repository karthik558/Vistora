# Hospitality operations expansion

Vistora now connects its existing feedback system to guest stays and hotel operations. The reference was the [official FCS1 product overview](https://www.fcshub.com/en/products/fcs1), particularly its housekeeping, service-request, maintenance and inspection workflows. This implementation is an initial operations suite, not a complete PMS or a reproduction of every FCS1 module.

## Available features

Company administrators can open **Hotel operations** from the sidebar:

- **Overview:** actual in-house stays, rooms needing service, open jobs, pending cost decisions and attributed activity. The feedback dashboard also links to these operational counts, respecting its property selection.
- **Guests:** private guest profiles, contact details, preferences and tiers; room reservations; check-in, checkout and cancellation; active-stay feedback links and linked feedback ratings in stay history.
- **Rooms:** property room inventory, capacity, clean/dirty/inspected/out-of-service states. Overlapping reservations are rejected by a database exclusion constraint. Checkout marks the room dirty; completing a cleaning job marks it clean.
- **Service jobs:** guest requests, cleaning, maintenance and inspection work; priority, property-authorized assignees, deadlines, active and closed views, feedback case links, completion and cancellation.
- **Inspections:** configurable checks, inspector attribution and immutable submissions. The server calculates pass/fail; a failed check creates a maintenance follow-up using the configured response target. A passing inspection marks readiness. Inspection-based readiness is required for check-in by default.
- **Cost controls:** a companywide monthly ledger, per-expense caps, automatic approval threshold, pending approvals and explicit approval/rejection. Amounts use integer minor units. Pending and approved entries both reserve budget. Concurrent requests serialize against the same budget, and final decisions are immutable.

These modules, their API routes and new operational tables are restricted to verified company administrators. Job assignment to a staff member records responsibility; it does not grant that staff member access to the admin module. Existing feedback permissions remain separate.

## Configuration and appearance

**Settings** includes all six section accent colors, module switches, inspection requirements and checklist, response target, overdue-alert opt-in, cost currency, budget and approval limits. Organization name, timezone, logo URL and guest welcome message are saved atomically with the configuration. Existing team, automation and integration controls remain in **Workspace**, at the bottom of the sidebar.

Feedback defaults to green. Guest/property/service areas use muted blues; compliance uses a restrained warm accent. Dark mode keeps neutral surfaces and readable text, with contrast-adjusted section accents. Custom dropdown portals inherit their section colors. New forms and controls use compact spacing, small corners and responsive grids; wide ledgers scroll inside their cards on narrow screens.

## Installation

All database additions are appended to the existing **supabase/schema.sql**, sections **20–24**. There is no separate migration file. For an installation already upgraded through section 19, review and apply section 20 onward with the Supabase SQL editor or your database deployment process. The upgrade enables PostgreSQL's `btree_gist` extension for reservation overlap checks.

The upgrade was exercised against a disposable local database. It has **not** been applied to the connected production database. Until it is applied, Hotel operations displays an explicit setup notice. Settings saves require the new `save_hotel_settings` RPC, so deploy the schema before using the new settings form.

After applying the upgrade:

1. Configure positive monthly and per-expense limits if you want to record costs. Zero limits intentionally block new costs. Budgets use UTC calendar months; historical entries remain readable. Currency changes are blocked while current-month costs are reserved or approved.
2. Add rooms and guests, reserve a stay, record the readiness inspection and check in. Use the active-stay feedback link to associate submissions with that stay.
3. Configure a delivery provider and worker schedule before opting into overdue-job alerts. Alerts default to off and are deduplicated per job deadline. No external messages are sent by this upgrade itself.

## Boundaries

Cost caps govern entries recorded in this ledger. They do not cap an external vendor's invoice, make payments, or monitor unrecorded spending. The implementation does not yet integrate a PMS/channel manager, accounting system, telephony/voice provider, wake-up calls or external compliance certification. Those require explicit provider contracts, credentials, event mappings and delivery/pricing requirements. No simulated integrations or invented operating data were added.

The current directory, inventory and history views have stated record limits and guest search; they do not yet provide full pagination or a room availability calendar. Stay operations use local room inventory rather than syncing an external PMS.

## Validation

- `npm test`: configuration/precision, accent contrast, existing platform behavior and API admin restrictions.
- `npm run test:database`: existing workspace and feedback workflows.
- `npm run test:hospitality`: company isolation, staff denial, room overlap, readiness, inspection integrity, stay feedback linkage, cleaning/check-out state changes, immutable costs, atomic configuration and concurrent budget reservations.
- `npm run build`: production compilation and TypeScript validation.

Database tests require a disposable database named `vistora_test` via `VISTORA_TEST_DATABASE_URL`; `PSQL_BIN` can point to a specific PostgreSQL client.
