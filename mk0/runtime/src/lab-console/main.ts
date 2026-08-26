import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const baseUrl = (process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

type Session = Readonly<{
  alias: string;
  workflowId: string;
  runId: string;
}>;

type JsonRecord = Record<string, unknown>;

const sessions = new Map<string, Session>();
let activeAlias: string | undefined;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? value as JsonRecord : undefined;
}

async function requestJson(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json() as unknown;
  const body = record(payload) ?? {};
  if (!response.ok) {
    const code = typeof body.code === 'string' ? body.code : `HTTP_${response.status}`;
    const message = typeof body.error === 'string' ? body.error : JSON.stringify(body);
    throw new Error(`${code}: ${message}`);
  }
  return body;
}

function activeSession(): Session {
  if (!activeAlias) throw new Error('No active session. Use: new <alias>, attach <alias> <workflowId>, or use <alias>');
  const session = sessions.get(activeAlias);
  if (!session) throw new Error(`Unknown active session: ${activeAlias}`);
  return session;
}

function compact(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function header(title: string): void {
  output.write(`\n${title}\n${'─'.repeat(Math.max(24, title.length))}\n`);
}

function traceObject(body: JsonRecord): JsonRecord {
  return record(body.trace) ?? {};
}

function patchSummary(input: unknown): string {
  const update = record(input) ?? {};
  const patch = record(update.customerPatch) ?? {};
  const contact = record(patch.contact) ?? {};
  const parts: string[] = [];
  if (typeof patch.name === 'string') parts.push(`name=${patch.name}`);
  if (typeof contact.email === 'string') parts.push(`email=${contact.email}`);
  if (Array.isArray(contact.phones) && contact.phones.length > 0) {
    const phone = record(contact.phones[0]) ?? {};
    parts.push(`phone=${String(phone.normalized ?? phone.number ?? '?')}`);
  }
  return parts.length > 0 ? parts.join(' ') : compact(patch);
}

function renderTrace(body: JsonRecord, options: Readonly<{ timelineLimit?: number }> = {}): void {
  const trace = traceObject(body);
  const workflow = record(trace.workflow) ?? {};
  const conversation = record(trace.conversation) ?? {};
  const currentStep = record(workflow.currentStep) ?? {};
  const evidence = record(trace.evidence) ?? {};
  const sourceStatus = record(evidence.sourceStatus) ?? {};
  const draft = record(conversation.currentDraft) ?? {};
  const customer = record(draft.customer) ?? {};
  const contact = record(customer.contact) ?? {};

  header('CURRENT WORKFLOW');
  output.write(`workflowId : ${String(workflow.workflowId ?? '?')}\n`);
  output.write(`runId      : ${String(workflow.runId ?? '?')}\n`);
  output.write(`status     : ${String(workflow.workflowStatus ?? '?')}\n`);
  output.write(`phase      : ${String(workflow.phase ?? '?')}\n`);
  output.write(`step       : ${String(currentStep.ordinal ?? '?')} — ${String(currentStep.label ?? '?')}\n`);

  header('DURABLE CUSTOMER DRAFT');
  output.write(`name       : ${String(customer.name ?? '—')}\n`);
  output.write(`email      : ${String(contact.email ?? '—')}\n`);
  const phones = Array.isArray(contact.phones) ? contact.phones : [];
  output.write(`phones     : ${phones.length ? compact(phones) : '—'}\n`);

  const known = Array.isArray(conversation.knownFields) ? conversation.knownFields : [];
  const missing = Array.isArray(conversation.missingFields) ? conversation.missingFields : [];
  output.write(`\nknown      : ${known.length ? known.join(', ') : '—'}\n`);
  output.write(`missing    : ${missing.length ? missing.join(', ') : '—'}\n`);
  output.write(`nextAction : ${String(conversation.nextAction ?? 'NONE')}\n`);

  const updates = Array.isArray(conversation.updates) ? conversation.updates : [];
  header(`PING-PONG UPDATES (${updates.length})`);
  if (updates.length === 0) {
    output.write('No ProvideCustomerData Updates yet.\n');
  } else {
    for (const raw of updates) {
      const update = record(raw) ?? {};
      const at = typeof update.at === 'string' ? update.at.slice(11, 23) : '            ';
      output.write(`${at}  ${String(update.application ?? 'UNKNOWN').padEnd(22)} ${patchSummary(update.input)}\n`);
    }
  }

  header('EVIDENCE PLANES');
  output.write(`Temporal        : ${String(sourceStatus.temporal ?? (evidence.temporal ? 'AVAILABLE' : 'UNKNOWN'))}\n`);
  output.write(`Mongo audit     : ${String(sourceStatus.mongo ?? (evidence.mongo ? 'AVAILABLE' : 'UNKNOWN'))}\n`);
  output.write(`PostgreSQL      : ${String(sourceStatus.postgres ?? (evidence.postgres ? 'AVAILABLE' : 'UNKNOWN'))}\n`);
  output.write(`AttachmentStore : ${String(sourceStatus.attachmentStore ?? evidence.attachmentStore ?? 'UNKNOWN')}\n`);
  const warnings = Array.isArray(evidence.warnings) ? evidence.warnings : [];
  if (warnings.length > 0) {
    output.write(`warnings        : ${warnings.join(' | ')}\n`);
  }

  const timeline = Array.isArray(trace.timeline) ? trace.timeline : [];
  const limit = options.timelineLimit ?? 16;
  header(`LATEST TRACE (${Math.min(limit, timeline.length)}/${timeline.length})`);
  for (const raw of timeline.slice(-limit)) {
    const item = record(raw) ?? {};
    const at = typeof item.at === 'string' ? item.at.slice(11, 23) : '            ';
    const actor = String(item.actor ?? '?');
    const target = typeof item.target === 'string' ? ` → ${item.target}` : '';
    output.write(`${at}  ${String(item.source ?? '?').padEnd(12)} ${actor}${target}  ${String(item.action ?? '?')}\n`);
  }
}

async function fetchTrace(session: Session): Promise<JsonRecord> {
  return requestJson(`/mk0/executions/${encodeURIComponent(session.workflowId)}/trace`);
}

async function newSession(alias: string): Promise<void> {
  if (!alias) throw new Error('Usage: new <alias>');
  if (sessions.has(alias)) throw new Error(`Alias already exists in this console: ${alias}`);
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const idempotencyKey = `lab-${alias}-${token}`;
  const body = await requestJson('/mk0/register-new-customer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessSlug: 'golden-business',
      idempotencyKey,
      correlationId: `lab-${alias}-${token}`,
      draft: { customer: {} },
    }),
  });

  const workflowId = String(body.workflowId ?? '');
  const runId = String(body.runId ?? '');
  if (!workflowId || !runId) throw new Error(`CTA did not return workflow identity: ${compact(body)}`);
  const session: Session = { alias, workflowId, runId };
  sessions.set(alias, session);
  activeAlias = alias;
  output.write(`\n✓ session ${alias} created\n`);
  renderTrace(await fetchTrace(session));
}

async function attachSession(alias: string, workflowId: string): Promise<void> {
  if (!alias || !workflowId) throw new Error('Usage: attach <alias> <workflowId>');
  if (sessions.has(alias)) throw new Error(`Alias already exists in this console: ${alias}`);
  const provisional: Session = { alias, workflowId, runId: '?' };
  const body = await fetchTrace(provisional);
  const workflow = record(traceObject(body).workflow) ?? {};
  const runId = String(workflow.runId ?? '');
  if (!runId) throw new Error(`Trace did not return a runId for ${workflowId}`);
  const session: Session = { alias, workflowId, runId };
  sessions.set(alias, session);
  activeAlias = alias;
  output.write(`\n✓ attached ${alias} to durable Workflow ${workflowId}\n`);
  renderTrace(body);
}

async function setField(field: string, value: string): Promise<void> {
  const session = activeSession();
  if (!value) throw new Error(`Usage: set ${field} <value>`);
  let customerPatch: JsonRecord;
  if (field === 'name') customerPatch = { name: value };
  else if (field === 'email') customerPatch = { contact: { email: value } };
  else if (field === 'phone') customerPatch = { contact: { phones: [{ number: value, normalized: value, primary: true }] } };
  else throw new Error('Supported fields: name, email, phone');

  const inputId = `lab-${session.alias}-${field}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const body = await requestJson(`/mk0/register-new-customer/${encodeURIComponent(session.workflowId)}/customer-data`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputId, customerPatch }),
  });
  const result = record(body.result) ?? {};
  const ok = result.ok;
  output.write(`\n→ ProvideCustomerData(${field}) ${ok === false ? 'REJECTED' : 'ACCEPTED'}\n`);
  await new Promise((resolve) => setTimeout(resolve, 120));
  renderTrace(await fetchTrace(session));
}

function showSessions(): void {
  header('SESSIONS');
  if (sessions.size === 0) {
    output.write('No sessions in this console.\n');
    return;
  }
  for (const session of sessions.values()) {
    const marker = session.alias === activeAlias ? '●' : ' ';
    output.write(`${marker} ${session.alias.padEnd(16)} ${session.runId.padEnd(38)} ${session.workflowId}\n`);
  }
}

async function useSession(alias: string): Promise<void> {
  if (!sessions.has(alias)) throw new Error(`Unknown alias: ${alias}`);
  activeAlias = alias;
  output.write(`\n✓ active session: ${alias}\n`);
  renderTrace(await fetchTrace(activeSession()));
}

async function watch(secondsText?: string): Promise<void> {
  const session = activeSession();
  const seconds = Math.max(1, Math.min(120, Number.parseInt(secondsText ?? '10', 10) || 10));
  const deadline = Date.now() + seconds * 1000;
  let lastSignature = '';
  output.write(`\nWatching ${session.alias} for up to ${seconds}s...\n`);
  while (Date.now() < deadline) {
    const body = await fetchTrace(session);
    const trace = traceObject(body);
    const workflow = record(trace.workflow) ?? {};
    const conversation = record(trace.conversation) ?? {};
    const timeline = Array.isArray(trace.timeline) ? trace.timeline : [];
    const updates = Array.isArray(conversation.updates) ? conversation.updates : [];
    const signature = `${String(workflow.workflowStatus)}|${String(workflow.phase)}|${timeline.length}|${updates.length}`;
    if (signature !== lastSignature) {
      const now = new Date().toISOString().slice(11, 23);
      output.write(`[${now}] ${String(workflow.workflowStatus)} / ${String(workflow.phase)} / trace=${timeline.length} / updates=${updates.length}\n`);
      lastSignature = signature;
    }
    if (workflow.workflowStatus === 'COMPLETED' || workflow.workflowStatus === 'FAILED') {
      renderTrace(body);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  renderTrace(await fetchTrace(session));
}

function help(): void {
  output.write(`
Commands
────────
new <alias>                         start a new intent-only RegisterNewCustomer Workflow
attach <alias> <workflowId>         reconnect this console to an existing durable Workflow
resume <alias> <workflowId>         alias for attach
sessions                            list local aliases/workflows
use <alias>                         switch active Workflow
show                                current durable state + ping-pong + evidence + trace
set name <value>                    ProvideCustomerData Update
set email <value>                   ProvideCustomerData Update
set phone <value>                   ProvideCustomerData Update
trace                               print the complete unified evidence JSON
watch [seconds]                     observe phase/timeline changes (default 10s)
raw                                 alias for trace
help                                show commands
exit                                close console

Try one Workflow with several revisions:
  new test01
  set name Pepito
  set name Juancito
  set name Andresito
  show
  set email andresito@example.test
  watch 5
  trace

Try several durable Workflows:
  new pepito
  new juancito
  sessions
  use pepito
  use juancito

Close the console, reopen it, then reconnect:
  attach old-flow register-customer:golden-business:...
`);
}

async function main(): Promise<void> {
  const health = await requestJson('/health');
  output.write(`ENGINES LAB CONSOLE\n${'═'.repeat(42)}\n`);
  output.write(`CTA      : ${baseUrl}\n`);
  output.write(`Service  : ${String(health.service ?? '?')}\n`);
  output.write(`Temporal : ${String(health.temporalAddress ?? '?')}\n`);
  help();

  const readline = createInterface({ input, output });
  try {
    while (true) {
      const prompt = activeAlias ? `engines[${activeAlias}]> ` : 'engines> ';
      const line = (await readline.question(prompt)).trim();
      if (!line) continue;
      const [command, first, ...rest] = line.split(/\s+/);
      try {
        if (command === 'exit' || command === 'quit') break;
        if (command === 'help' || command === '?') help();
        else if (command === 'new') await newSession(first ?? '');
        else if (command === 'attach' || command === 'resume') await attachSession(first ?? '', rest[0] ?? '');
        else if (command === 'sessions') showSessions();
        else if (command === 'use') await useSession(first ?? '');
        else if (command === 'show') renderTrace(await fetchTrace(activeSession()));
        else if (command === 'set') await setField(first ?? '', rest.join(' '));
        else if (command === 'watch') await watch(first);
        else if (command === 'trace' || command === 'raw') output.write(`${compact(await fetchTrace(activeSession()))}\n`);
        else output.write(`Unknown command: ${command}. Type help.\n`);
      } catch (error) {
        output.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  } finally {
    readline.close();
  }
}

main().catch((error: unknown) => {
  console.error(`LAB_CONSOLE_FAILED ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
