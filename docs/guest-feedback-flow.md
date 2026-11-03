# Imported guests and feedback

**Import report → guests + stays → Feedback / Guest directory / In-house guests → Take feedback → existing public feedback form → feedback + feedback_answers.**

Imports configure occupancy; they do not create reviews or fabricate responses. The directory reads active stays across assigned properties, includes imported stays, and supports property and guest/room search. Reservations appear after check-in. Checked-out stays leave the in-house list. Existing feedback and invitations remain under a separate tab.

Take feedback opens the existing stay-token form. The server rechecks that the stay is active, belongs to the signed-in company and an assigned property, and that the property is active. Personal links require organization administration or Feedback access, `view_feedback` and `view_guest_pii`. The directory never returns public tokens in bulk or contact details. Each link access is audited. The link is a bearer credential: share it only with the relevant guest.

The public submission resolves the token on the server. Guest name, room, property and `feedback.stay_id` come from that stay. Forged names or rooms in the request do not change the linked identity. Existing questionnaire validation and the `submit_guest_feedback` transaction save feedback and answers together. Multiple feedback responses per stay remain supported. Responses appear in All feedback, the guest's feedback history, analytics and the current stay's response count, subject to property and department access.

The in-house list refreshes on entry, window focus and every 30 seconds while visible. Opening an old link after check-out is rejected. Expired or completed invitation links are also unavailable. No database migration is required for this directory change on an installation with the existing hotel schema through section 24 (stay-linked feedback).

# Database inventory

Run `supabase/audits/table-usage.sql` in the Supabase SQL Editor. It only reads metadata and usage estimates. It catalogues the public tables defined by the repository and flags deployed tables not in that catalogue for investigation. It also lists foreign keys, triggers, view dependencies and usage statistics.

No repository table was proven unused. Queues, delivery attempts, audit records, idempotency receipts, questionnaire answers and operating workflows can be used through SQL functions or background jobs even when there is no obvious screen for them. Empty tables and zero scans are not removal evidence. No DROP, TRUNCATE, DELETE, RLS change or hosted schema change has been performed or recommended.

Before deleting an unknown extra table, establish its owner, inspect its functions/triggers and external integrations, confirm retention requirements, and take a tested backup. The read-only inventory cannot prove that another application does not use it. There is intentionally no blanket cleanup command.
