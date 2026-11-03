# Property questionnaires and short feedback links

## Rollout

Apply `supabase/migrations/20261103_questionnaires_and_short_links.sql` after the existing security-boundaries migration and its prerequisites. This additive migration has been verified in a disposable local PostgreSQL database; it has not been applied to hosted Supabase. Hosted database credentials or management access are required for that step.

The migration copies existing shared/property questions into independent default questionnaires for each relevant property. It preserves the original questions and historical answers and can be applied again safely. Existing encrypted `pf.*`, invitation and stay links remain supported.

Set `APP_URL` to the actual public HTTPS website origin. Generated links use that origin; stale localhost settings are ignored when accessed on a live website. In local development, links can use the current localhost origin.

New links look like `/feedback/property-code-<24 random characters>`. Only the token hash is stored. The server resolves the property and touchpoint; changing or removing the token cannot open another property's form or a property directory. New link generation requires the migration.

## Use

1. Open Questionnaire and select the property.
2. Select a saved questionnaire or create another. Use Edit on an existing question to change its text, type, options or settings.
3. Save the questionnaire name, guest title, introduction and accent color as needed.
4. Choose **Use for guest links** to make that questionnaire the property's guest form.
5. Open QR Studio, select the property and generate its link or QR code. The property's chosen questionnaire and design are used automatically.

Changing the chosen questionnaire updates the form opened by that property's existing reusable QR links as well. Invitation/stay links also use the property's current chosen questionnaire.

## Verification

- 76 unit tests passed; TypeScript and production build passed.
- Questionnaire, security-boundaries and workspace-isolation database suites passed locally, including migration replay and legacy backfill checks.
- Browser checks confirmed question editing opens with existing values, QR Studio navigation works, and touchpoint buttons have transparent backgrounds and no borders. No real guest feedback was submitted.
