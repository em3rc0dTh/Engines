import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInitialStartFingerprintMaterial,
  hasSameInitialStartFingerprintMaterial,
  isSameBusinessScopedSession,
  serializeInitialStartFingerprintMaterial,
} from './idempotency.js';
import { mergeCustomerDraft, normalizeCustomerDraft } from './normalization.js';
import {
  evaluateRegistrationCompleteness,
  GOLDEN_REGISTRATION_POLICY_V1,
  validateRegistrationPolicy,
} from './registration-policy.js';
import {
  REGISTER_NEW_CUSTOMER_OPERATION,
  REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  type RegisterNewCustomerStartEnvelope,
} from './types.js';
import { validateProvideCustomerData, validateRegisterNewCustomerStart } from './validation.js';

function startEnvelope(overrides: Partial<RegisterNewCustomerStartEnvelope> = {}): RegisterNewCustomerStartEnvelope {
  return {
    operation: REGISTER_NEW_CUSTOMER_OPERATION,
    businessSlug: 'golden-business',
    draft: { customer: {} },
    request: { idempotencyKey: 'session-key', channel: 'cli', correlationId: 'corr-1' },
    schemaVersion: REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
    ...overrides,
  };
}

test('GD-015: legal intent-only start is accepted before Customer completeness exists', () => {
  const result = validateRegisterNewCustomerStart({
    operation: 'RegisterNewCustomer',
    businessSlug: 'golden-business',
    draft: { customer: {} },
    request: { idempotencyKey: 'gd-015-session', channel: 'postman' },
    schemaVersion: 'mk0.register-customer.v0',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const completeness = evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V1, result.value.draft);
  assert.equal(completeness.complete, false);
  assert.deepEqual(completeness.missingFields, [
    'customer.name',
    'customer.contact.phoneOrEmail',
  ]);
});

test('GD-007: missing businessSlug is rejected before Workflow start', () => {
  const result = validateRegisterNewCustomerStart({
    operation: 'RegisterNewCustomer',
    draft: { customer: {} },
    request: { idempotencyKey: 'gd-007-session' },
    schemaVersion: 'mk0.register-customer.v0',
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.issues.some((issue) => issue.code === 'MISSING_BUSINESS_SLUG'), true);
});

test('start validation rejects unknown operation, missing idempotency identity and unsupported schema', () => {
  const result = validateRegisterNewCustomerStart({
    operation: 'CreateAppointment',
    businessSlug: 'golden-business',
    request: { idempotencyKey: '' },
    schemaVersion: 'mk0.register-customer.v999',
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    new Set(result.issues.map((issue) => issue.code)),
    new Set(['UNKNOWN_OPERATION', 'MISSING_IDEMPOTENCY_KEY', 'UNSUPPORTED_SCHEMA_VERSION']),
  );
});

test('normalization is deterministic without inventing missing business data', () => {
  const normalized = normalizeCustomerDraft({
    type: '  person ',
    name: '  Ana Torres  ',
    document: { type: ' dni ', country: ' pe ', value: ' 00000001 ' },
    contact: {
      email: ' ANA.TORRES@EXAMPLE.TEST ',
      phones: [
        { countryCode: '+51', number: '900-000-001', primary: true },
        { normalized: '51 911 000 002' },
      ],
    },
  });

  assert.equal(normalized.type, 'person');
  assert.equal(normalized.name, 'Ana Torres');
  assert.deepEqual(normalized.document, { type: 'DNI', country: 'PE', value: '00000001' });
  assert.equal(normalized.contact?.email, 'ana.torres@example.test');
  assert.deepEqual(
    normalized.contact?.phones?.map((phone) => phone.normalized),
    ['51900000001', '51911000002'],
  );
});

test('GD-016: multi-round Customer patches evolve the draft without creating a new start', () => {
  const initial = {};
  const afterName = mergeCustomerDraft(initial, { name: 'Iris Sol' });
  const roundOne = evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V1, { customer: afterName });

  assert.equal(roundOne.complete, false);
  assert.deepEqual(roundOne.missingFields, ['customer.contact.phoneOrEmail']);

  const afterContact = mergeCustomerDraft(afterName, {
    contact: { phones: [], email: 'IRIS.SOL@EXAMPLE.TEST' },
  });
  const roundTwo = evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V1, { customer: afterContact });

  assert.equal(roundTwo.complete, true);
  assert.deepEqual(roundTwo.missingFields, []);
  assert.equal(afterContact.contact?.email, 'iris.sol@example.test');
});

test('Golden RegistrationPolicy is valid and preserves duplicate classifications', () => {
  assert.deepEqual(validateRegistrationPolicy(GOLDEN_REGISTRATION_POLICY_V1), []);
  assert.deepEqual(GOLDEN_REGISTRATION_POLICY_V1.duplicatePolicy.hardUnique, [
    'customer.document.type+customer.document.country+customer.document.value',
  ]);
  assert.deepEqual(GOLDEN_REGISTRATION_POLICY_V1.duplicatePolicy.softMatch, [
    'customer.contact.phones[].normalized',
    'customer.contact.email',
  ]);
  assert.deepEqual(GOLDEN_REGISTRATION_POLICY_V1.duplicatePolicy.nonUnique, ['customer.name']);
});

test('policy can require document or attachments without making them universal requirements', () => {
  const stricterPolicy = {
    ...GOLDEN_REGISTRATION_POLICY_V1,
    policyId: 'stricter-policy',
    documentRequired: true,
    attachmentsRequired: true,
  } as const;

  const incomplete = evaluateRegistrationCompleteness(stricterPolicy, {
    customer: {
      name: 'Mara Rios',
      contact: { email: 'mara.rios@example.test' },
    },
  });

  assert.deepEqual(incomplete.missingFields, ['customer.document', 'draft.attachments']);

  const complete = evaluateRegistrationCompleteness(stricterPolicy, {
    customer: {
      name: 'Mara Rios',
      contact: { email: 'mara.rios@example.test' },
      document: { type: 'DNI', country: 'PE', value: '12345678' },
    },
    attachments: [{ ingressRef: 'ing_001' }],
  });

  assert.equal(complete.complete, true);
});

test('GD-006: same business + same key + different initial material is a fingerprint conflict', () => {
  const first = startEnvelope({
    request: { idempotencyKey: 'gd-006-session', channel: 'cli' },
    draft: { customer: { name: 'Initial Name' } },
  });
  const exactReplay = startEnvelope({
    request: { idempotencyKey: 'gd-006-session', channel: 'postman', correlationId: 'different-correlation' },
    draft: { customer: { name: ' Initial Name ' } },
  });
  const conflictingStart = startEnvelope({
    request: { idempotencyKey: 'gd-006-session', channel: 'cli' },
    draft: { customer: { name: 'Different Initial Name' } },
  });

  assert.equal(isSameBusinessScopedSession(first, exactReplay), true);
  assert.equal(hasSameInitialStartFingerprintMaterial(first, exactReplay), true);
  assert.equal(isSameBusinessScopedSession(first, conflictingStart), true);
  assert.equal(hasSameInitialStartFingerprintMaterial(first, conflictingStart), false);
});

test('same opaque idempotency key in another business is a different business-scoped session', () => {
  const first = startEnvelope({ request: { idempotencyKey: 'shared-key' } });
  const second = startEnvelope({
    businessSlug: 'different-business',
    request: { idempotencyKey: 'shared-key' },
  });

  assert.equal(isSameBusinessScopedSession(first, second), false);
});

test('channel/correlation metadata is excluded from initial start fingerprint material', () => {
  const first = startEnvelope({
    request: { idempotencyKey: 'same-key', channel: 'cli', correlationId: 'one' },
  });
  const second = startEnvelope({
    request: { idempotencyKey: 'same-key', channel: 'postman', correlationId: 'two' },
  });

  assert.equal(serializeInitialStartFingerprintMaterial(first), serializeInitialStartFingerprintMaterial(second));
  assert.deepEqual(buildInitialStartFingerprintMaterial(first), buildInitialStartFingerprintMaterial(second));
});

test('phone and attachment ordering does not change normalized initial fingerprint material', () => {
  const first = startEnvelope({
    draft: {
      customer: {
        contact: {
          phones: [{ normalized: '51922222222' }, { normalized: '51911111111' }],
        },
      },
      attachments: [
        { ingressRef: 'ing_b', kind: 'supporting_document' },
        { ingressRef: 'ing_a', kind: 'identity_document' },
      ],
    },
  });
  const second = startEnvelope({
    draft: {
      customer: {
        contact: {
          phones: [{ normalized: '51911111111' }, { normalized: '51922222222' }],
        },
      },
      attachments: [
        { ingressRef: 'ing_a', kind: 'identity_document' },
        { ingressRef: 'ing_b', kind: 'supporting_document' },
      ],
    },
  });

  assert.equal(hasSameInitialStartFingerprintMaterial(first, second), true);
});

test('attachment envelope rejects malformed integrity metadata without requiring attachments universally', () => {
  const invalid = validateRegisterNewCustomerStart({
    operation: 'RegisterNewCustomer',
    businessSlug: 'golden-business',
    draft: {
      customer: {},
      attachments: [{ ingressRef: 'ing_1', sha256: 'not-a-digest' }],
    },
    request: { idempotencyKey: 'attachment-case' },
    schemaVersion: 'mk0.register-customer.v0',
  });

  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.issues.some((issue) => issue.code === 'INVALID_ATTACHMENT_ENVELOPE'), true);
  }

  const noAttachment = validateRegisterNewCustomerStart({
    operation: 'RegisterNewCustomer',
    businessSlug: 'golden-business',
    draft: { customer: {} },
    request: { idempotencyKey: 'no-attachment-case' },
    schemaVersion: 'mk0.register-customer.v0',
  });
  assert.equal(noAttachment.ok, true);
});

test('ProvideCustomerData requires stable input identity and a structural Customer patch', () => {
  const valid = validateProvideCustomerData({
    inputId: 'gd-016-input-1',
    customerPatch: { name: ' Iris Sol ' },
  });
  assert.equal(valid.ok, true);

  const invalid = validateProvideCustomerData({ inputId: '', customerPatch: 'not-an-object' });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.issues.some((issue) => issue.code === 'INVALID_INPUT_ID'), true);
    assert.equal(invalid.issues.some((issue) => issue.code === 'INVALID_CUSTOMER_PATCH'), true);
  }
});
