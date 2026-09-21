import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAppointmentDateInput } from './date-input.js';

test('Friday and viernes resolve to the same next business date', () => {
  assert.deepEqual(
    normalizeAppointmentDateInput('Friday', '2026-08-26'),
    { ok: true, appointmentDate: '2026-08-28' },
  );
  assert.deepEqual(
    normalizeAppointmentDateInput('viernes', '2026-08-26'),
    { ok: true, appointmentDate: '2026-08-28' },
  );
});

test('canonical and Peru-style numeric dates normalize identically', () => {
  const expected = { ok: true, appointmentDate: '2026-08-28' } as const;
  assert.deepEqual(normalizeAppointmentDateInput('2026-08-28', '2026-08-26'), expected);
  assert.deepEqual(normalizeAppointmentDateInput('28/08/2026', '2026-08-26'), expected);
  assert.deepEqual(normalizeAppointmentDateInput('28-08-2026', '2026-08-26'), expected);
  assert.deepEqual(normalizeAppointmentDateInput('28 August 2026', '2026-08-26'), expected);
  assert.deepEqual(normalizeAppointmentDateInput('28 agosto 2026', '2026-08-26'), expected);
});

test('past date is rejected before Temporal appointment Update', () => {
  const result = normalizeAppointmentDateInput('25/08/2026', '2026-08-26');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'PAST_DATE');
});

test('yesterday and ayer resolve to a past date and are rejected', () => {
  for (const input of ['yesterday', 'ayer']) {
    const result = normalizeAppointmentDateInput(input, '2026-08-26');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PAST_DATE');
      assert.match(result.message, /2026-08-25/);
    }
  }
});

test('today/hoy and tomorrow/mañana are accepted relative inputs', () => {
  assert.deepEqual(
    normalizeAppointmentDateInput('hoy', '2026-08-26'),
    { ok: true, appointmentDate: '2026-08-26' },
  );
  assert.deepEqual(
    normalizeAppointmentDateInput('mañana', '2026-08-26'),
    { ok: true, appointmentDate: '2026-08-27' },
  );
});

test('malformed calendar dates are rejected', () => {
  const result = normalizeAppointmentDateInput('31/02/2026', '2026-08-26');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'INVALID_DATE');
});
