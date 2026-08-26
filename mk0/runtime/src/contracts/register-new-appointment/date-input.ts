export type AppointmentDateParseResult =
  | Readonly<{ ok: true; appointmentDate: string }>
  | Readonly<{ ok: false; code: 'INVALID_DATE' | 'PAST_DATE'; message: string }>;

const WEEKDAYS: Readonly<Record<string, number>> = {
  sunday: 0,
  domingo: 0,
  monday: 1,
  lunes: 1,
  tuesday: 2,
  martes: 2,
  wednesday: 3,
  miercoles: 3,
  thursday: 4,
  jueves: 4,
  friday: 5,
  viernes: 5,
  saturday: 6,
  sabado: 6,
};

const MONTHS: Readonly<Record<string, number>> = {
  january: 1,
  enero: 1,
  february: 2,
  febrero: 2,
  march: 3,
  marzo: 3,
  april: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  june: 6,
  junio: 6,
  july: 7,
  julio: 7,
  august: 8,
  agosto: 8,
  september: 9,
  septiembre: 9,
  setiembre: 9,
  october: 10,
  octubre: 10,
  november: 11,
  noviembre: 11,
  december: 12,
  diciembre: 12,
};

function ascii(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseIsoParts(value: string): Readonly<{ year: number; month: number; day: number }> | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };

  const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(value);
  if (dmy) return { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) };

  const words = /^(\d{1,2})\s+(?:of\s+|de\s+)?([a-z]+)\s+(\d{4})$/.exec(value);
  if (words) {
    const month = MONTHS[words[2] ?? ''];
    if (!month) return undefined;
    return { year: Number(words[3]), month, day: Number(words[1]) };
  }

  return undefined;
}

function validDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function nextWeekday(referenceDate: string, targetWeekday: number): string {
  const reference = dateFromIso(referenceDate);
  const delta = (targetWeekday - reference.getUTCDay() + 7) % 7;
  reference.setUTCDate(reference.getUTCDate() + delta);
  return isoDate(reference.getUTCFullYear(), reference.getUTCMonth() + 1, reference.getUTCDate());
}

export function todayInTimeZone(timeZone = 'America/Lima', now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function normalizeAppointmentDateInput(
  rawInput: string,
  referenceDate: string,
): AppointmentDateParseResult {
  const input = ascii(rawInput);
  if (!input) return { ok: false, code: 'INVALID_DATE', message: 'appointment date is required' };

  let canonical: string | undefined;
  const weekday = WEEKDAYS[input];
  if (weekday !== undefined) {
    canonical = nextWeekday(referenceDate, weekday);
  } else {
    const parts = parseIsoParts(input);
    if (!parts || !validDate(parts.year, parts.month, parts.day)) {
      return {
        ok: false,
        code: 'INVALID_DATE',
        message: 'use YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, a supported month name, or an English/Spanish weekday',
      };
    }
    canonical = isoDate(parts.year, parts.month, parts.day);
  }

  if (canonical < referenceDate) {
    return {
      ok: false,
      code: 'PAST_DATE',
      message: `appointment date ${canonical} is before business-local today ${referenceDate}`,
    };
  }

  return { ok: true, appointmentDate: canonical };
}
