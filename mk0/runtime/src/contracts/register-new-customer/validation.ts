import { normalizeRegistrationDraft } from './normalization.js';
import {
  REGISTER_NEW_CUSTOMER_OPERATION,
  REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  type AttachmentIngressDraft,
  type ContractIssue,
  type ContractValidationResult,
  type CustomerDraft,
  type ProvideCustomerDataInput,
  type RegisterNewCustomerDraft,
  type RegisterNewCustomerStartEnvelope,
  type RegistrationCompletionMode,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalStringIsValid(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalBooleanIsValid(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function emailLooksValid(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 254) return false;

  const at = normalized.indexOf('@');
  if (at <= 0 || at !== normalized.lastIndexOf('@') || at === normalized.length - 1) return false;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (/\s/.test(local) || /\s/.test(domain)) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (labels.some((label) => (
    label.length === 0 ||
    label.length > 63 ||
    label.startsWith('-') ||
    label.endsWith('-') ||
    !/^[A-Za-z0-9-]+$/.test(label)
  ))) return false;

  const suffix = labels.at(-1) ?? '';
  return /^[A-Za-z]{2,63}$/.test(suffix) || /^xn--[A-Za-z0-9-]{2,59}$/.test(suffix);
}

function formattedPhoneLooksValid(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 32) return false;
  if (!/^\+?[0-9\s().-]+$/.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function normalizedPhoneLooksValid(value: string): boolean {
  return /^\d{7,15}$/.test(value.trim());
}

function countryCodeLooksValid(value: string): boolean {
  return /^\+?\d{1,3}$/.test(value.trim());
}

function completionModeIsValid(value: unknown): value is RegistrationCompletionMode {
  return value === 'AUTO_WHEN_COMPLETE' || value === 'EXPLICIT_FINALIZE';
}

function validateCustomerDraftShape(value: unknown, path: string): readonly ContractIssue[] {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    return [{ code: 'INVALID_DRAFT', path, message: 'customer must be an object when provided' }];
  }

  const issues: ContractIssue[] = [];

  for (const key of ['type', 'name', 'notes'] as const) {
    if (!optionalStringIsValid(value[key])) {
      issues.push({ code: 'INVALID_DRAFT', path: `${path}.${key}`, message: `${key} must be a string` });
    }
  }

  if (value.document !== undefined) {
    if (!isRecord(value.document)) {
      issues.push({ code: 'INVALID_DRAFT', path: `${path}.document`, message: 'document must be an object' });
    } else {
      for (const key of ['type', 'value', 'country'] as const) {
        if (!optionalStringIsValid(value.document[key])) {
          issues.push({
            code: 'INVALID_DRAFT',
            path: `${path}.document.${key}`,
            message: `document.${key} must be a string`,
          });
        }
      }
    }
  }

  if (value.contact !== undefined) {
    if (!isRecord(value.contact)) {
      issues.push({ code: 'INVALID_DRAFT', path: `${path}.contact`, message: 'contact must be an object' });
    } else {
      if (!optionalStringIsValid(value.contact.email)) {
        issues.push({ code: 'INVALID_DRAFT', path: `${path}.contact.email`, message: 'email must be a string' });
      } else if (
        typeof value.contact.email === 'string' &&
        value.contact.email.trim().length > 0 &&
        !emailLooksValid(value.contact.email)
      ) {
        issues.push({
          code: 'INVALID_DRAFT',
          path: `${path}.contact.email`,
          message: 'email must contain one @ and a valid dotted domain, for example user@example.com',
        });
      }

      if (value.contact.phones !== undefined) {
        if (!Array.isArray(value.contact.phones)) {
          issues.push({ code: 'INVALID_DRAFT', path: `${path}.contact.phones`, message: 'phones must be an array' });
        } else {
          value.contact.phones.forEach((phone, index) => {
            const phonePath = `${path}.contact.phones[${index}]`;
            if (!isRecord(phone)) {
              issues.push({ code: 'INVALID_DRAFT', path: phonePath, message: 'phone must be an object' });
              return;
            }

            for (const key of ['label', 'countryCode', 'number', 'normalized'] as const) {
              if (!optionalStringIsValid(phone[key])) {
                issues.push({
                  code: 'INVALID_DRAFT',
                  path: `${phonePath}.${key}`,
                  message: `${key} must be a string`,
                });
              }
            }

            const number = typeof phone.number === 'string' ? phone.number : undefined;
            const normalized = typeof phone.normalized === 'string' ? phone.normalized : undefined;
            const countryCode = typeof phone.countryCode === 'string' ? phone.countryCode : undefined;

            if (!nonEmptyString(number) && !nonEmptyString(normalized)) {
              issues.push({
                code: 'INVALID_DRAFT',
                path: `${phonePath}.number`,
                message: 'phone requires number or normalized digits',
              });
            }
            if (nonEmptyString(number) && !formattedPhoneLooksValid(number)) {
              issues.push({
                code: 'INVALID_DRAFT',
                path: `${phonePath}.number`,
                message: 'phone number may contain digits and common formatting (+, spaces, parentheses, hyphens, dots) and must contain 7 to 15 digits',
              });
            }
            if (nonEmptyString(normalized) && !normalizedPhoneLooksValid(normalized)) {
              issues.push({
                code: 'INVALID_DRAFT',
                path: `${phonePath}.normalized`,
                message: 'normalized phone must contain only 7 to 15 digits',
              });
            }
            if (nonEmptyString(countryCode) && !countryCodeLooksValid(countryCode)) {
              issues.push({
                code: 'INVALID_DRAFT',
                path: `${phonePath}.countryCode`,
                message: 'countryCode must contain 1 to 3 digits with an optional leading +',
              });
            }

            for (const key of ['isWhatsapp', 'primary'] as const) {
              if (!optionalBooleanIsValid(phone[key])) {
                issues.push({
                  code: 'INVALID_DRAFT',
                  path: `${phonePath}.${key}`,
                  message: `${key} must be a boolean`,
                });
              }
            }
          });
        }
      }
    }
  }

  return issues;
}

function validateAttachment(value: unknown, path: string): readonly ContractIssue[] {
  if (!isRecord(value)) {
    return [{ code: 'INVALID_ATTACHMENT_ENVELOPE', path, message: 'attachment must be an object' }];
  }

  const issues: ContractIssue[] = [];
  if (!nonEmptyString(value.ingressRef)) {
    issues.push({
      code: 'INVALID_ATTACHMENT_ENVELOPE',
      path: `${path}.ingressRef`,
      message: 'ingressRef is required',
    });
  }

  for (const key of ['kind', 'displayName', 'mediaType', 'sha256'] as const) {
    if (!optionalStringIsValid(value[key])) {
      issues.push({
        code: 'INVALID_ATTACHMENT_ENVELOPE',
        path: `${path}.${key}`,
        message: `${key} must be a string`,
      });
    }
  }

  if (
    value.byteLength !== undefined &&
    (typeof value.byteLength !== 'number' || !Number.isSafeInteger(value.byteLength) || value.byteLength < 0)
  ) {
    issues.push({
      code: 'INVALID_ATTACHMENT_ENVELOPE',
      path: `${path}.byteLength`,
      message: 'byteLength must be a non-negative safe integer',
    });
  }

  if (
    typeof value.sha256 === 'string' &&
    value.sha256.trim().length > 0 &&
    !/^[a-fA-F0-9]{64}$/.test(value.sha256.trim())
  ) {
    issues.push({
      code: 'INVALID_ATTACHMENT_ENVELOPE',
      path: `${path}.sha256`,
      message: 'sha256 must be a 64-character hexadecimal digest when provided',
    });
  }

  return issues;
}

function validateDraftShape(value: unknown): readonly ContractIssue[] {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    return [{ code: 'INVALID_DRAFT', path: 'draft', message: 'draft must be an object when provided' }];
  }

  const issues = [...validateCustomerDraftShape(value.customer, 'draft.customer')];
  if (value.attachments !== undefined) {
    if (!Array.isArray(value.attachments)) {
      issues.push({
        code: 'INVALID_ATTACHMENT_ENVELOPE',
        path: 'draft.attachments',
        message: 'attachments must be an array',
      });
    } else {
      value.attachments.forEach((attachment, index) => {
        issues.push(...validateAttachment(attachment, `draft.attachments[${index}]`));
      });
    }
  }

  return issues;
}

export function validateRegisterNewCustomerStart(
  input: unknown,
): ContractValidationResult<RegisterNewCustomerStartEnvelope> {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ code: 'INVALID_ENVELOPE', path: '$', message: 'start envelope must be an object' }],
    };
  }

  const issues: ContractIssue[] = [];

  if (input.operation !== REGISTER_NEW_CUSTOMER_OPERATION) {
    issues.push({
      code: 'UNKNOWN_OPERATION',
      path: 'operation',
      message: `operation must be ${REGISTER_NEW_CUSTOMER_OPERATION}`,
    });
  }

  if (!nonEmptyString(input.businessSlug)) {
    issues.push({
      code: 'MISSING_BUSINESS_SLUG',
      path: 'businessSlug',
      message: 'businessSlug is required',
    });
  }

  if (input.schemaVersion !== REGISTER_NEW_CUSTOMER_SCHEMA_VERSION) {
    issues.push({
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      path: 'schemaVersion',
      message: `schemaVersion must be ${REGISTER_NEW_CUSTOMER_SCHEMA_VERSION}`,
    });
  }

  if (!isRecord(input.request)) {
    issues.push({ code: 'INVALID_ENVELOPE', path: 'request', message: 'request must be an object' });
  } else {
    if (!nonEmptyString(input.request.idempotencyKey)) {
      issues.push({
        code: 'MISSING_IDEMPOTENCY_KEY',
        path: 'request.idempotencyKey',
        message: 'request.idempotencyKey is required',
      });
    }
    for (const key of ['correlationId', 'channel'] as const) {
      if (!optionalStringIsValid(input.request[key])) {
        issues.push({
          code: 'INVALID_ENVELOPE',
          path: `request.${key}`,
          message: `request.${key} must be a string`,
        });
      }
    }
    if (
      input.request.completionMode !== undefined &&
      !completionModeIsValid(input.request.completionMode)
    ) {
      issues.push({
        code: 'INVALID_ENVELOPE',
        path: 'request.completionMode',
        message: 'request.completionMode must be AUTO_WHEN_COMPLETE or EXPLICIT_FINALIZE',
      });
    }
  }

  issues.push(...validateDraftShape(input.draft));

  if (issues.length > 0) return { ok: false, issues };

  const request = input.request as Record<string, unknown>;
  const rawDraft = input.draft as RegisterNewCustomerDraft | undefined;
  const correlationId = typeof request.correlationId === 'string' ? request.correlationId.trim() : undefined;
  const channel = typeof request.channel === 'string' ? request.channel.trim() : undefined;
  const completionMode = completionModeIsValid(request.completionMode)
    ? request.completionMode
    : undefined;

  const value: RegisterNewCustomerStartEnvelope = {
    operation: REGISTER_NEW_CUSTOMER_OPERATION,
    businessSlug: (input.businessSlug as string).trim(),
    draft: normalizeRegistrationDraft(rawDraft),
    request: {
      idempotencyKey: (request.idempotencyKey as string).trim(),
      ...(correlationId ? { correlationId } : {}),
      ...(channel ? { channel } : {}),
      ...(completionMode ? { completionMode } : {}),
    },
    schemaVersion: REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  };

  return { ok: true, value };
}

export function validateProvideCustomerData(
  input: unknown,
): ContractValidationResult<ProvideCustomerDataInput> {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ code: 'INVALID_CUSTOMER_PATCH', path: '$', message: 'Update input must be an object' }],
    };
  }

  const issues: ContractIssue[] = [];
  if (!nonEmptyString(input.inputId)) {
    issues.push({ code: 'INVALID_INPUT_ID', path: 'inputId', message: 'inputId is required' });
  }

  issues.push(...validateCustomerDraftShape(input.customerPatch, 'customerPatch'));
  if (!isRecord(input.customerPatch)) {
    issues.push({
      code: 'INVALID_CUSTOMER_PATCH',
      path: 'customerPatch',
      message: 'customerPatch must be an object',
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      inputId: (input.inputId as string).trim(),
      customerPatch: input.customerPatch as CustomerDraft,
    },
  };
}

export type ValidatedAttachmentIngress = AttachmentIngressDraft;
