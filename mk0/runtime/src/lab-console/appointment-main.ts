import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const baseUrl = (process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

type JsonRecord = Record<string, unknown>;
type Session = Readonly<{ alias: string; workflowId: string; runId: string }>;

const sessions = new Map<string, Session>();
let activeAlias: string | undefined;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function requestJson(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const raw = await response.json() as unknown;
  const body = record(raw) ?? {};
  if (!response.ok) {
    throw new Error(`${String(body.code ?? `HTTP_${response.status}`)}: ${String(body.error ?? JSON.stringify(body))}`);
  }
  return body;
}

function active(): Session {
  if (!activeAlias) throw new Error('No active appointment. Use: new <alias> or use <alias>');
  const session = sessions.get(activeAlias);
  if (!session) throw new Error(`Unknown alias ${activeAlias}`);
  return session;
}

function header(title: string): void {
  output.write(`\n${title}\n${'─'.repeat(Math.max(28, title.length))}\n`);
}

function compact(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function state(body: JsonRecord): JsonRecord {
  return record(body.state) ?? record(record(body.trace)?.conversation) ?? {};
}

async function fetchState(session = active()): Promise<JsonRecord> {
  return requestJson(`/mk0/register-new-appointment/${encodeURIComponent(session.workflowId)}`);
}

function render(body: JsonRecord): void {
  const s = state(body);
  const customer = record(s.customer) ?? {};
  const customerDraft = record(customer.customer) ?? {};
  const contact = record(customerDraft.contact) ?? {};
  const selectedService = record(s.selectedService);
  const selectedProduct = record(s.selectedProduct);
  const selectedSlot = record(s.selectedSlot);

  header('REGISTER NEW APPOINTMENT');
  output.write(`workflowId : ${String(body.workflowId ?? '?')}\n`);
  output.write(`runId      : ${String(body.runId ?? '?')}\n`);
  output.write(`status     : ${String(s.workflowStatus ?? '?')}\n`);
  output.write(`phase      : ${String(s.phase ?? '?')}\n`);
  output.write(`nextAction : ${String(s.nextAction ?? 'NONE')}\n`);

  header('1 — CUSTOMER');
  output.write(`resolution : ${String(customer.status ?? 'EMPTY')}\n`);
  output.write(`customerId : ${String(customer.customerId ?? '—')}\n`);
  output.write(`name       : ${String(customerDraft.name ?? '—')}\n`);
  output.write(`email      : ${String(contact.email ?? '—')}\n`);
  output.write(`phones     : ${array(contact.phones).length ? compact(contact.phones) : '—'}\n`);
  if (array(customer.candidateCustomerIds).length) {
    output.write(`candidates : ${array(customer.candidateCustomerIds).join(', ')}\n`);
  }

  header('2 — SERVICE');
  const services = array(s.services).map((item) => record(item) ?? {});
  if (services.length === 0) output.write('No services loaded yet.\n');
  services.forEach((service, index) => {
    const mark = selectedService?.serviceId === service.serviceId ? '✓' : ' ';
    output.write(`${mark} [${index + 1}] ${String(service.name)}  (${String(service.serviceId)})\n`);
  });

  header('3 — PRODUCT');
  const products = array(s.products).map((item) => record(item) ?? {});
  if (products.length === 0) output.write('No products loaded yet.\n');
  products.forEach((product, index) => {
    const mark = selectedProduct?.productId === product.productId ? '✓' : ' ';
    output.write(`${mark} [${index + 1}] ${String(product.name)} — ${String(product.durationMinutes)} min  (${String(product.productId)})\n`);
  });

  header('4 — DATE');
  output.write(`date       : ${String(s.appointmentDate ?? '—')}\n`);

  header('5 — AVAILABLE SLOTS');
  const slots = array(s.availableSlots).map((item) => record(item) ?? {});
  if (slots.length === 0) output.write('No slots loaded yet.\n');
  slots.forEach((slot, index) => {
    const mark = selectedSlot?.start === slot.start ? '✓' : ' ';
    output.write(`${mark} [${index + 1}] ${String(slot.start)}–${String(slot.end)} (${String(slot.durationMinutes)} min)\n`);
  });

  const issues = array(s.issues);
  if (issues.length) {
    header('ISSUES');
    output.write(`${compact(issues)}\n`);
  }
  if (s.result) {
    header('APPOINTMENT RESULT');
    output.write(`${compact(s.result)}\n`);
  }
}

function token(alias: string, action: string): string {
  return `lab-appt-${alias}-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function newAppointment(alias: string): Promise<void> {
  if (!alias) throw new Error('Usage: new <alias>');
  if (sessions.has(alias)) throw new Error(`Alias already exists: ${alias}`);
  const requestToken = token(alias, 'start');
  const body = await requestJson('/mk0/register-new-appointment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessSlug: 'golden-business',
      idempotencyKey: requestToken,
      correlationId: requestToken,
    }),
  });
  const session: Session = {
    alias,
    workflowId: String(body.workflowId),
    runId: String(body.runId),
  };
  sessions.set(alias, session);
  activeAlias = alias;
  output.write(`\n✓ appointment session ${alias} started\n`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  render(await fetchState(session));
}

async function postActive(suffix: string, body: JsonRecord): Promise<JsonRecord> {
  const session = active();
  return requestJson(`/mk0/register-new-appointment/${encodeURIComponent(session.workflowId)}${suffix}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function customerCommand(parts: string[]): Promise<void> {
  const action = parts[0];
  if (action === 'resolve') {
    const response = await postActive('/resolve-customer', { inputId: token(active().alias, 'resolve-customer') });
    output.write(`\n→ ResolveAppointmentCustomer ${record(response.result)?.ok === false ? 'REJECTED' : 'ACCEPTED'}\n`);
    await watchUntilStable(8);
    return;
  }
  const value = parts.slice(1).join(' ').trim();
  if (!action || !value) throw new Error('Usage: customer name|email|phone|id <value> OR customer resolve');
  let payload: JsonRecord;
  if (action === 'id') {
    payload = { inputId: token(active().alias, 'customer-id'), customerId: value };
  } else if (action === 'name') {
    payload = { inputId: token(active().alias, 'customer-name'), customerPatch: { name: value } };
  } else if (action === 'email') {
    payload = { inputId: token(active().alias, 'customer-email'), customerPatch: { contact: { email: value } } };
  } else if (action === 'phone') {
    const normalized = value.replace(/\D/g, '');
    payload = {
      inputId: token(active().alias, 'customer-phone'),
      customerPatch: { contact: { phones: [{ number: value, normalized, primary: true }] } },
    };
  } else {
    throw new Error('Customer fields: name, email, phone, id, resolve');
  }
  const response = await postActive('/customer-data', payload);
  const result = record(response.result) ?? {};
  output.write(`\n→ Appointment customer ${action} ${result.ok === false ? 'REJECTED' : 'ACCEPTED'}\n`);
  if (result.ok === false) output.write(`${compact(result.issues)}\n`);
  render(await fetchState());
}

function selectFrom(items: JsonRecord[], raw: string, idField: string, codeField: string): string {
  const numeric = Number.parseInt(raw, 10);
  if (Number.isInteger(numeric) && String(numeric) === raw && numeric >= 1 && numeric <= items.length) {
    return String(items[numeric - 1]?.[idField]);
  }
  const match = items.find((item) => item[idField] === raw || item[codeField] === raw || String(item.name).toLowerCase() === raw.toLowerCase());
  return match ? String(match[idField]) : raw;
}

async function selectService(raw: string): Promise<void> {
  if (!raw) throw new Error('Usage: service <number|serviceId|code|name>');
  const current = state(await fetchState());
  const services = array(current.services).map((item) => record(item) ?? {});
  const serviceId = selectFrom(services, raw, 'serviceId', 'code');
  const response = await postActive('/service', { inputId: token(active().alias, 'service'), serviceId });
  output.write(`\n→ SelectAppointmentService ${record(response.result)?.ok === false ? 'REJECTED' : 'ACCEPTED'}\n`);
  await watchUntilStable(5);
}

async function selectProduct(raw: string): Promise<void> {
  if (!raw) throw new Error('Usage: product <number|productId|code|name>');
  const current = state(await fetchState());
  const products = array(current.products).map((item) => record(item) ?? {});
  const productId = selectFrom(products, raw, 'productId', 'code');
  const response = await postActive('/product', { inputId: token(active().alias, 'product'), productId });
  output.write(`\n→ SelectAppointmentProduct ${record(response.result)?.ok === false ? 'REJECTED' : 'ACCEPTED'}\n`);
  await watchUntilStable(5);
}

async function setDate(raw: string): Promise<void> {
  if (!raw) throw new Error('Usage: date <Friday|viernes|YYYY-MM-DD|DD/MM/YYYY>');
  const response = await postActive('/date', { inputId: token(active().alias, 'date'), dateInput: raw });
  const result = record(response.result) ?? {};
  output.write(`\n→ SetAppointmentDate ${result.ok === false ? 'REJECTED' : 'ACCEPTED'}${response.normalizedAppointmentDate ? ` → ${String(response.normalizedAppointmentDate)}` : ''}\n`);
  if (result.ok === false) output.write(`${compact(result.issues)}\n`);
  if (result.ok === false) render(await fetchState());
  else await watchUntilStable(5);
}

async function selectSlot(raw: string): Promise<void> {
  if (!raw) throw new Error('Usage: slot <number|HH:MM>');
  const current = state(await fetchState());
  const slots = array(current.availableSlots).map((item) => record(item) ?? {});
  const numeric = Number.parseInt(raw, 10);
  const slotStart = Number.isInteger(numeric) && String(numeric) === raw && numeric >= 1 && numeric <= slots.length
    ? String(slots[numeric - 1]?.start)
    : raw;
  const response = await postActive('/slot', { inputId: token(active().alias, 'slot'), slotStart });
  output.write(`\n→ SelectAppointmentSlot ${record(response.result)?.ok === false ? 'REJECTED' : 'ACCEPTED'}\n`);
  await watchUntilStable(4);
}

async function finish(): Promise<void> {
  const response = await postActive('/finalize', { inputId: token(active().alias, 'finalize') });
  const result = record(response.result) ?? {};
  output.write(`\n→ FinalizeAppointment ${result.ok === false ? 'REJECTED' : 'ACCEPTED'}\n`);
  if (result.ok === false) output.write(`${compact(result.issues)}\n`);
  await watchUntilStable(8);
}

async function watchUntilStable(seconds: number): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  let previous = '';
  let stable = 0;
  let latest: JsonRecord = await fetchState();
  while (Date.now() < deadline) {
    latest = await fetchState();
    const s = state(latest);
    const signature = `${String(s.workflowStatus)}|${String(s.phase)}|${String(s.nextAction)}|${array(s.services).length}|${array(s.products).length}|${array(s.availableSlots).length}`;
    if (signature !== previous) {
      output.write(`[${new Date().toISOString().slice(11, 23)}] ${String(s.workflowStatus)} / ${String(s.phase)} / next=${String(s.nextAction)}\n`);
      previous = signature;
      stable = 0;
    } else {
      stable += 1;
    }
    if (s.workflowStatus !== 'RUNNING' || stable >= 3) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  render(latest);
}

function help(): void {
  output.write(`
ENGINES APPOINTMENT LAB
────────────────────────────────────────────────────────
new <alias>                     start RegisterNewAppointment
sessions                        list local appointment aliases
use <alias>                     switch active appointment
show                            show complete durable appointment state
customer name <value>           set Customer name
customer email <value>          set Customer email
customer phone <value>          set Customer phone
customer id <customerId>        choose known Customer explicitly
customer resolve                resolve existing Customer or run child RegisterNewCustomer
services                        show Services loaded from PostgreSQL
service <n|id|code|name>        select Service
products                        show Products loaded from PostgreSQL
product <n|id|code|name>        select Product
date <human date>               Friday/viernes/YYYY-MM-DD/DD/MM/YYYY
slots                           show available slots read through Temporal Activity
slot <n|HH:MM>                  select one available slot
finish                          atomically persist the Appointment
watch [seconds]                 watch phase progression
trace                           raw appointment evidence projection
help                            show commands
exit                            close console

Suggested first run:
  new wash01
  customer name Eduardo
  customer email eduardo.appointment@example.test
  customer resolve
  services
  service 1
  products
  product 1
  date viernes
  slots
  slot 2
  show
  finish
`);
}

async function main(): Promise<void> {
  output.write('ENGINES APPOINTMENT LAB CONSOLE\n══════════════════════════════════════════\n');
  output.write(`CTA : ${baseUrl}\n`);
  help();
  const rl = createInterface({ input, output });
  try {
    while (true) {
      const line = (await rl.question(`engines-appt${activeAlias ? `[${activeAlias}]` : ''}> `)).trim();
      if (!line) continue;
      const [command, ...parts] = line.split(/\s+/);
      const rest = line.slice(command!.length).trim();
      try {
        if (command === 'exit' || command === 'quit') break;
        if (command === 'help') { help(); continue; }
        if (command === 'new') { await newAppointment(parts[0] ?? ''); continue; }
        if (command === 'sessions') {
          header('APPOINTMENT SESSIONS');
          for (const session of sessions.values()) output.write(`${session.alias === activeAlias ? '●' : ' '} ${session.alias}  ${session.workflowId}\n`);
          continue;
        }
        if (command === 'use') {
          const alias = parts[0] ?? '';
          if (!sessions.has(alias)) throw new Error(`Unknown alias ${alias}`);
          activeAlias = alias;
          render(await fetchState());
          continue;
        }
        if (command === 'show' || command === 'services' || command === 'products' || command === 'slots') {
          render(await fetchState());
          continue;
        }
        if (command === 'customer') { await customerCommand(parts); continue; }
        if (command === 'service') { await selectService(rest); continue; }
        if (command === 'product') { await selectProduct(rest); continue; }
        if (command === 'date') { await setDate(rest); continue; }
        if (command === 'slot') { await selectSlot(rest); continue; }
        if (command === 'finish' || command === 'submit') { await finish(); continue; }
        if (command === 'watch') { await watchUntilStable(Math.max(1, Number.parseInt(parts[0] ?? '10', 10) || 10)); continue; }
        if (command === 'trace') {
          const session = active();
          output.write(`${compact(await requestJson(`/mk0/executions/${encodeURIComponent(session.workflowId)}/trace`))}\n`);
          continue;
        }
        output.write(`Unknown command: ${command}. Type help.\n`);
      } catch (error) {
        output.write(`ERROR ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  } finally {
    rl.close();
  }
}

await main();
