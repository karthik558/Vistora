const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { parseGuestReportCsv } = require('../lib/hospitality/guestReportParser.ts');
const header = 'guest_name,room_number,check_in_date,check_out_date,guest_count,preferences,status\n';
test('quoted commas, apostrophes, multiline notes and reservations survive CSV parsing', () => {
 const [row] = parseGuestReportCsv(header + '"O\'Brien, Alex",101,2026-11-03,2026-11-05,2,"Quiet room\nLate arrival",reserved');
 assert.equal(row.guest_name, "O'Brien, Alex"); assert.equal(row.preferences, 'Quiet room\nLate arrival'); assert.equal(row.status, 'reserved');
});
test('unsafe malformed occupancy rows fail instead of being dropped or invented', () => {
 for (const row of ['Alex,,2026-11-03,2026-11-05,2,,', 'Alex,101,2026-02-30,2026-03-05,2,,', 'Alex,101,2026-11-05,2026-11-03,2,,', 'Alex,101,2026-11-03,2026-11-05,1.5,,', 'Alex,101,2026-11-03,2026-11-05,2,,checked_out']) assert.throws(() => parseGuestReportCsv(header + row));
 assert.throws(() => parseGuestReportCsv('guest_name,room_number\nAlex,101'));
 assert.throws(() => parseGuestReportCsv(header + '"Alex,101,2026-11-03'));
});
test('TSV and UTF-8 BOM reports parse', () => {
 assert.equal(parseGuestReportCsv('\uFEFFguest_name\troom_number\tcheck_in_date\tcheck_out_date\nAlex\t101\t2026-11-03\t2026-11-05')[0].room_number, '101');
});
