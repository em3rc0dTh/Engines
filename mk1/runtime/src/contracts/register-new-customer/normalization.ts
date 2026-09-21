import type {
  AttachmentIngressDraft,
  CustomerContactDraft,
  CustomerDocumentDraft,
  CustomerDraft,
  CustomerPhoneDraft,
  RegisterNewCustomerDraft,
} from './types.js';

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function digitsOnly(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\D/g, '');
  return cleaned ? cleaned : undefined;
}

function normalizeEmail(value: string | undefined): string | undefined {
  const cleaned = cleanText(value);
  return cleaned?.toLowerCase();
}

function normalizeCountryCode(value: string | undefined): string | undefined {
  const digits = digitsOnly(value);
  return digits ? `+${digits}` : undefined;
}

function normalizePhone(phone: CustomerPhoneDraft): CustomerPhoneDraft | undefined {
  const label = cleanText(phone.label);
  const countryCode = normalizeCountryCode(phone.countryCode);
  const number = digitsOnly(phone.number);
  const explicitNormalized = digitsOnly(phone.normalized);
  const derivedNormalized =
    explicitNormalized ??
    (countryCode || number
      ? `${digitsOnly(countryCode) ?? ''}${number ?? ''}` || undefined
      : undefined);

  const normalized: CustomerPhoneDraft = {
    ...(label ? { label } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(number ? { number } : {}),
    ...(derivedNormalized ? { normalized: derivedNormalized } : {}),
    ...(typeof phone.isWhatsapp === 'boolean' ? { isWhatsapp: phone.isWhatsapp } : {}),
    ...(typeof phone.primary === 'boolean' ? { primary: phone.primary } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeContact(contact: CustomerContactDraft | undefined): CustomerContactDraft | undefined {
  if (!contact) return undefined;

  // Customer phone order is semantic because downstream persistence stores an
  // explicit phone_index and interactive clients expose stable phone[n] slots.
  // Do not canonical-sort here. Fingerprint-only canonical ordering belongs in
  // the idempotency layer, where a sorted copy can be produced without mutating
  // the durable Customer draft's user-visible slot order.
  const phones = (contact.phones ?? [])
    .map(normalizePhone)
    .filter((phone): phone is CustomerPhoneDraft => Boolean(phone));
  const email = normalizeEmail(contact.email);

  if (phones.length === 0 && !email) return undefined;

  return {
    ...(phones.length > 0 ? { phones } : {}),
    ...(email ? { email } : {}),
  };
}

function normalizeDocument(document: CustomerDocumentDraft | undefined): CustomerDocumentDraft | undefined {
  if (!document) return undefined;

  const type = cleanText(document.type)?.toUpperCase();
  const value = cleanText(document.value);
  const country = cleanText(document.country)?.toUpperCase();

  if (!type && !value && !country) return undefined;

  return {
    ...(type ? { type } : {}),
    ...(value ? { value } : {}),
    ...(country ? { country } : {}),
  };
}

export function normalizeCustomerDraft(customer: CustomerDraft | undefined): CustomerDraft {
  if (!customer) return {};

  const type = cleanText(customer.type);
  const name = cleanText(customer.name);
  const document = normalizeDocument(customer.document);
  const contact = normalizeContact(customer.contact);
  const notes = cleanText(customer.notes);

  return {
    ...(type ? { type } : {}),
    ...(name ? { name } : {}),
    ...(document ? { document } : {}),
    ...(contact ? { contact } : {}),
    ...(notes ? { notes } : {}),
  };
}

function normalizeAttachment(attachment: AttachmentIngressDraft): AttachmentIngressDraft {
  const ingressRef = attachment.ingressRef.trim();
  const kind = cleanText(attachment.kind);
  const displayName = cleanText(attachment.displayName);
  const mediaType = cleanText(attachment.mediaType)?.toLowerCase();
  const sha256 = cleanText(attachment.sha256)?.toLowerCase();

  return {
    ingressRef,
    ...(kind ? { kind } : {}),
    ...(displayName ? { displayName } : {}),
    ...(mediaType ? { mediaType } : {}),
    ...(sha256 ? { sha256 } : {}),
    ...(typeof attachment.byteLength === 'number' ? { byteLength: attachment.byteLength } : {}),
  };
}

function attachmentSortKey(attachment: AttachmentIngressDraft): string {
  return JSON.stringify([
    attachment.ingressRef,
    attachment.kind ?? '',
    attachment.sha256 ?? '',
    attachment.byteLength ?? -1,
    attachment.mediaType ?? '',
    attachment.displayName ?? '',
  ]);
}

export function normalizeRegistrationDraft(draft: RegisterNewCustomerDraft | undefined): RegisterNewCustomerDraft {
  const customer = normalizeCustomerDraft(draft?.customer);
  const attachments = (draft?.attachments ?? [])
    .map(normalizeAttachment)
    .sort((left, right) => attachmentSortKey(left).localeCompare(attachmentSortKey(right)));

  return {
    customer,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
}

export function mergeCustomerDraft(current: CustomerDraft, patch: CustomerDraft): CustomerDraft {
  const normalizedCurrent = normalizeCustomerDraft(current);
  const normalizedPatch = normalizeCustomerDraft(patch);

  const merged: CustomerDraft = {
    ...normalizedCurrent,
    ...normalizedPatch,
    ...(normalizedCurrent.document || normalizedPatch.document
      ? { document: { ...normalizedCurrent.document, ...normalizedPatch.document } }
      : {}),
    ...(normalizedCurrent.contact || normalizedPatch.contact
      ? {
          contact: {
            ...normalizedCurrent.contact,
            ...normalizedPatch.contact,
            ...(normalizedPatch.contact?.phones
              ? { phones: normalizedPatch.contact.phones }
              : normalizedCurrent.contact?.phones
                ? { phones: normalizedCurrent.contact.phones }
                : {}),
          },
        }
      : {}),
  };

  return normalizeCustomerDraft(merged);
}
