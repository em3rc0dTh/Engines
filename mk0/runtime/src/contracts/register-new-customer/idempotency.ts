import { normalizeRegistrationDraft } from './normalization.js';
import type { CustomerPhoneDraft, RegisterNewCustomerDraft, RegisterNewCustomerStartEnvelope } from './types.js';

export type RegistrationSessionIdentityMaterial = Readonly<{
  operation: RegisterNewCustomerStartEnvelope['operation'];
  businessSlug: string;
  idempotencyKey: string;
}>;

export type InitialStartFingerprintMaterial = Readonly<{
  operation: RegisterNewCustomerStartEnvelope['operation'];
  businessSlug: string;
  schemaVersion: RegisterNewCustomerStartEnvelope['schemaVersion'];
  draft: ReturnType<typeof normalizeRegistrationDraft>;
}>;

function phoneFingerprintSortKey(phone: CustomerPhoneDraft): string {
  return JSON.stringify([
    phone.normalized ?? '',
    phone.countryCode ?? '',
    phone.number ?? '',
    phone.label ?? '',
    phone.primary ?? false,
    phone.isWhatsapp ?? false,
  ]);
}

function normalizeInitialFingerprintDraft(
  draft: RegisterNewCustomerDraft | undefined,
): ReturnType<typeof normalizeRegistrationDraft> {
  const normalized = normalizeRegistrationDraft(draft);
  const customer = normalized.customer;
  const contact = customer?.contact;
  const phones = contact?.phones;

  if (!customer || !contact || !phones || phones.length < 2) return normalized;

  return {
    ...normalized,
    customer: {
      ...customer,
      contact: {
        ...contact,
        // Ordering is intentionally canonical only inside fingerprint material.
        // The durable Customer draft preserves its user-visible phone[n] slots.
        phones: [...phones].sort((left, right) =>
          phoneFingerprintSortKey(left).localeCompare(phoneFingerprintSortKey(right))),
      },
    },
  };
}

export function buildRegistrationSessionIdentityMaterial(
  start: RegisterNewCustomerStartEnvelope,
): RegistrationSessionIdentityMaterial {
  return {
    operation: start.operation,
    businessSlug: start.businessSlug,
    idempotencyKey: start.request.idempotencyKey,
  };
}

export function buildInitialStartFingerprintMaterial(
  start: RegisterNewCustomerStartEnvelope,
): InitialStartFingerprintMaterial {
  return {
    operation: start.operation,
    businessSlug: start.businessSlug,
    schemaVersion: start.schemaVersion,
    draft: normalizeInitialFingerprintDraft(start.draft),
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function serializeInitialStartFingerprintMaterial(
  start: RegisterNewCustomerStartEnvelope,
): string {
  return canonicalJson(buildInitialStartFingerprintMaterial(start));
}

export function hasSameInitialStartFingerprintMaterial(
  left: RegisterNewCustomerStartEnvelope,
  right: RegisterNewCustomerStartEnvelope,
): boolean {
  return serializeInitialStartFingerprintMaterial(left) === serializeInitialStartFingerprintMaterial(right);
}

export function isSameBusinessScopedSession(
  left: RegisterNewCustomerStartEnvelope,
  right: RegisterNewCustomerStartEnvelope,
): boolean {
  const leftIdentity = buildRegistrationSessionIdentityMaterial(left);
  const rightIdentity = buildRegistrationSessionIdentityMaterial(right);

  return (
    leftIdentity.operation === rightIdentity.operation &&
    leftIdentity.businessSlug === rightIdentity.businessSlug &&
    leftIdentity.idempotencyKey === rightIdentity.idempotencyKey
  );
}

/**
 * B1 deliberately does not hash the opaque idempotency key or fingerprint.
 * Hashing is a boundary/persistence concern introduced by the later adapter/
 * persistence stages. This module freezes the exact deterministic material
 * that those later components must hash without redefining its semantics.
 */
