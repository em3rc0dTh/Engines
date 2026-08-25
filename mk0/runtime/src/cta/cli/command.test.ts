import assert from 'node:assert/strict';
import test from 'node:test';
import { executeCliInvocation } from './command.js';

const command = 'register-new-customer';

test('B3 accepts intent-only CLI input and injects channel metadata', () => {
  const result = executeCliInvocation(command, {
    businessSlug: ' golden-business ',
    idempotencyKey: ' cli-intent-001 ',
    correlationId: ' corr-001 ',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.status, 'READY_FOR_ORCHESTRATION');
  assert.equal(result.envelope.operation, 'RegisterNewCustomer');
  assert.equal(result.envelope.schemaVersion, 'mk0.register-customer.v0');
  assert.equal(result.envelope.businessSlug, 'golden-business');
  assert.equal(result.envelope.request.idempotencyKey, 'cli-intent-001');
  assert.equal(result.envelope.request.correlationId, 'corr-001');
  assert.equal(result.envelope.request.channel, 'cli');
  assert.deepEqual(result.envelope.draft, { customer: {} });
});

test('B3 accepts full Customer draft and delegates normalization to B1 contract', () => {
  const result = executeCliInvocation(command, {
    businessSlug: 'golden-business',
    idempotencyKey: 'cli-full-001',
    draft: {
      customer: {
        name: '  Ada Lovelace  ',
        type: ' person ',
        document: { type: ' dni ', country: ' pe ', value: ' 12345678 ' },
        contact: {
          email: ' ADA@EXAMPLE.COM ',
          phones: [{ countryCode: '+51', number: '999 888 777', primary: true }],
        },
      },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.envelope.draft?.customer?.name, 'Ada Lovelace');
  assert.equal(result.envelope.draft?.customer?.type, 'person');
  assert.equal(result.envelope.draft?.customer?.document?.type, 'DNI');
  assert.equal(result.envelope.draft?.customer?.document?.country, 'PE');
  assert.equal(result.envelope.draft?.customer?.contact?.email, 'ada@example.com');
  assert.equal(result.envelope.draft?.customer?.contact?.phones?.[0]?.normalized, '51999888777');
});

test('B3 rejects unknown CLI command before orchestration handoff', () => {
  const result = executeCliInvocation('delete-customer', {
    businessSlug: 'golden-business',
    idempotencyKey: 'cli-unknown-001',
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.issues[0]?.code, 'UNKNOWN_OPERATION');
});

test('B3 rejects missing businessSlug structurally', () => {
  const result = executeCliInvocation(command, { idempotencyKey: 'cli-no-business' });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_BUSINESS_SLUG'));
});

test('B3 rejects missing idempotency identity structurally', () => {
  const result = executeCliInvocation(command, { businessSlug: 'golden-business' });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_IDEMPOTENCY_KEY'));
});

test('B3 rejects malformed draft structure', () => {
  const result = executeCliInvocation(command, {
    businessSlug: 'golden-business',
    idempotencyKey: 'cli-bad-draft',
    draft: { customer: 'not-an-object' },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_DRAFT'));
});

test('B3 does not invent Customer completeness requirements at CTA boundary', () => {
  const result = executeCliInvocation(command, {
    businessSlug: 'golden-business',
    idempotencyKey: 'cli-incomplete-customer',
    draft: { customer: { notes: 'intent captured before customer details' } },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.status, 'READY_FOR_ORCHESTRATION');
  assert.equal(result.envelope.draft?.customer?.notes, 'intent captured before customer details');
  assert.equal(result.envelope.draft?.customer?.name, undefined);
});
