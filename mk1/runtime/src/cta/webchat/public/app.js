const $ = (id) => document.getElementById(id);

const state = {
  workflowId: new URLSearchParams(location.search).get('workflowId') || localStorage.getItem('engines.webchat.workflowId') || '',
  snapshot: null,
  view: null,
  inputMode: null,
  lastPromptKey: '',
  lastPhaseSignature: '',
  polling: false,
};

function token(label) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `webchat-${label}-${random}`;
}

async function json(path, init = {}) {
  const response = await fetch(path, init);
  const raw = await response.json();
  if (!response.ok) throw new Error(raw.error || raw.code || `HTTP ${response.status}`);
  return raw;
}

function post(path, body) {
  return json(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function appendMessage(kind, text) {
  const node = document.createElement('div');
  node.className = `message ${kind}`;
  node.textContent = text;
  $('messages').append(node);
  $('messages').scrollTop = $('messages').scrollHeight;
}

function promptOnce(key, text) {
  if (state.lastPromptKey === key) return;
  state.lastPromptKey = key;
  appendMessage('system', text);
}

function setInput(mode, placeholder, enabled = true) {
  state.inputMode = mode;
  $('messageInput').placeholder = placeholder;
  $('messageInput').disabled = !enabled;
  $('sendButton').disabled = !enabled;
  if (enabled) $('messageInput').focus();
}

function clearChoices() {
  $('choices').replaceChildren();
}

function choice(label, handler) {
  const button = document.createElement('button');
  button.className = 'choice';
  button.textContent = label;
  button.addEventListener('click', handler);
  $('choices').append(button);
}

function renderSteps(view) {
  const list = $('steps');
  list.replaceChildren();
  for (const step of view?.steps ?? []) {
    const item = document.createElement('li');
    item.className = 'step';
    item.dataset.status = step.status;

    const number = document.createElement('div');
    number.className = 'step-number';
    number.textContent = String(step.number).padStart(2, '0');

    const content = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'step-label';
    label.textContent = step.label;
    content.append(label);
    if (step.value) {
      const value = document.createElement('div');
      value.className = 'step-value';
      value.textContent = step.value;
      content.append(value);
    }

    const status = document.createElement('div');
    status.className = 'step-status';
    status.textContent = step.status;
    item.append(number, content, status);
    list.append(item);
  }
}

function customerDraft() {
  return state.snapshot?.state?.customer?.customer ?? {};
}

function customerResolved() {
  const customer = state.snapshot?.state?.customer ?? {};
  return Boolean(customer.customerId) && ['EXISTING', 'CREATED'].includes(customer.status);
}

function phaseBusy(phase) {
  return [
    'STARTED',
    'RESOLVING_CUSTOMER',
    'CUSTOMER_READY',
    'LOADING_SERVICES',
    'LOADING_PRODUCTS',
    'LOADING_SLOTS',
    'RESERVING_APPOINTMENT',
  ].includes(phase);
}

function renderInteraction() {
  clearChoices();
  if (!state.workflowId || !state.snapshot?.state) {
    setInput(null, 'Start the Workflow first', false);
    return;
  }

  const durable = state.snapshot.state;
  const draft = customerDraft();
  const contact = draft.contact ?? {};
  const phone = contact.phones?.[0]?.number ?? contact.phones?.[0]?.normalized;

  if (durable.workflowStatus === 'FAILED') {
    promptOnce('failed', `Workflow failed: ${durable.failure?.message ?? 'unknown failure'}`);
    setInput(null, 'Workflow failed', false);
    return;
  }

  if (durable.phase === 'CREATED') {
    promptOnce('created', `Appointment created.\nAppointment ID: ${durable.result?.appointmentId ?? '—'}`);
    setInput(null, 'Workflow completed', false);
    return;
  }

  if (!customerResolved()) {
    if (!draft.name) {
      promptOnce('customer-name', 'Step 02 — Enter the customer name. This will send the same ProvideAppointmentCustomer update used by the CLI.');
      setInput('customer-name', 'Customer name');
      return;
    }
    if (!contact.email) {
      promptOnce('customer-email', 'Step 03 — Enter the customer email.');
      setInput('customer-email', 'Customer email');
      return;
    }
    if (!phone) {
      promptOnce('customer-phone', 'Step 04 — Enter the customer phone number.');
      setInput('customer-phone', 'Customer phone');
      return;
    }
    if (durable.phase === 'WAITING_FOR_CUSTOMER') {
      promptOnce('resolve-customer', 'Step 05 — Customer data is captured. Resolve the customer through Temporal.');
      setInput(null, 'Use Resolve Customer', false);
      choice('Resolve Customer', () => runAction('resolve-customer'));
      return;
    }
  }

  if (durable.nextAction === 'SELECT_SERVICE') {
    promptOnce('select-service', 'Step 06 — Select a Service loaded by the Workflow.');
    setInput(null, 'Choose a Service', false);
    for (const service of durable.services ?? []) {
      choice(service.name, () => runAction('service', service.serviceId));
    }
    return;
  }

  if (durable.nextAction === 'SELECT_PRODUCT') {
    promptOnce('select-product', 'Step 07 — Select an Offering / Product for the selected Service.');
    setInput(null, 'Choose an Offering', false);
    for (const product of durable.products ?? []) {
      choice(`${product.name} · ${product.durationMinutes} min`, () => runAction('product', product.productId));
    }
    return;
  }

  if (durable.nextAction === 'PROVIDE_DATE') {
    promptOnce('date', 'Step 08 — Enter the appointment date. The CTA accepts the same human date forms as the CLI, for example: viernes or 2026-09-04.');
    setInput('date', 'viernes / Friday / YYYY-MM-DD');
    return;
  }

  if (durable.nextAction === 'SELECT_SLOT') {
    promptOnce('slot', 'Step 10 — Available slots are loaded. Select one.');
    setInput(null, 'Choose a slot', false);
    for (const slot of durable.availableSlots ?? []) {
      choice(`${slot.start}–${slot.end}`, () => runAction('slot', slot.start));
    }
    return;
  }

  if (durable.nextAction === 'FINALIZE_APPOINTMENT') {
    promptOnce('finalize', 'Step 11 — The Workflow is READY_TO_FINALIZE. Persist the Appointment explicitly.');
    setInput(null, 'Use Finalize Appointment', false);
    choice('Finalize Appointment', () => runAction('finalize'));
    return;
  }

  if (phaseBusy(durable.phase)) {
    promptOnce(`busy-${durable.phase}`, `Temporal phase: ${durable.phase}. Waiting for durable progress…`);
    setInput(null, `Temporal: ${durable.phase}`, false);
    return;
  }

  promptOnce(`phase-${durable.phase}`, `Temporal phase: ${durable.phase}. Next action: ${durable.nextAction}.`);
  setInput(null, 'Waiting for Workflow state', false);
}

function render(snapshot) {
  state.snapshot = snapshot;
  state.view = snapshot.view;
  const durable = snapshot.state ?? {};
  $('workflowId').textContent = snapshot.workflowId ?? state.workflowId ?? '—';
  $('workflowStatus').textContent = durable.workflowStatus ?? '—';
  $('phase').textContent = durable.phase ?? '—';
  $('nextAction').textContent = durable.nextAction ?? '—';
  $('rawState').textContent = JSON.stringify(snapshot, null, 2);
  renderSteps(snapshot.view);

  const signature = `${durable.workflowStatus}|${durable.phase}|${durable.nextAction}`;
  if (signature !== state.lastPhaseSignature) {
    state.lastPhaseSignature = signature;
    appendMessage('meta', `${durable.workflowStatus ?? '?'} / ${durable.phase ?? '?'} / next=${durable.nextAction ?? 'NONE'}`);
  }

  const inspector = $('inspectorLink');
  inspector.href = `/webchat/workflow.html?workflowId=${encodeURIComponent(state.workflowId)}`;
  inspector.classList.remove('disabled');
  renderInteraction();
}

async function refresh() {
  if (!state.workflowId || state.polling) return;
  state.polling = true;
  try {
    const snapshot = await json(`/api/appointments/${encodeURIComponent(state.workflowId)}/view`);
    render(snapshot);
    $('connectionStatus').textContent = 'Temporal connected';
  } catch (error) {
    $('connectionStatus').textContent = 'state unavailable';
    console.error(error);
  } finally {
    state.polling = false;
  }
}

async function startWorkflow() {
  const businessSlug = $('businessSlug').value.trim();
  if (!businessSlug) return;
  const key = token('start');
  const receipt = await post('/api/cta/mk0/register-new-appointment', {
    businessSlug,
    idempotencyKey: key,
    correlationId: key,
  });
  state.workflowId = receipt.workflowId;
  localStorage.setItem('engines.webchat.workflowId', state.workflowId);
  const url = new URL(location.href);
  url.searchParams.set('workflowId', state.workflowId);
  history.replaceState({}, '', url);
  $('startButton').disabled = true;
  $('businessSlug').disabled = true;
  appendMessage('system', `Step 01 — Workflow started.\n${state.workflowId}`);
  await refresh();
}

async function runAction(action, value) {
  if (!state.workflowId) return;
  const id = encodeURIComponent(state.workflowId);
  const inputId = token(action);

  if (action === 'resolve-customer') {
    appendMessage('user', 'Resolve Customer');
    await post(`/api/cta/mk0/register-new-appointment/${id}/resolve-customer`, { inputId });
  }
  if (action === 'service') {
    const selected = state.snapshot.state.services.find((item) => item.serviceId === value);
    appendMessage('user', selected?.name ?? value);
    await post(`/api/cta/mk0/register-new-appointment/${id}/service`, { inputId, serviceId: value });
  }
  if (action === 'product') {
    const selected = state.snapshot.state.products.find((item) => item.productId === value);
    appendMessage('user', selected?.name ?? value);
    await post(`/api/cta/mk0/register-new-appointment/${id}/product`, { inputId, productId: value });
  }
  if (action === 'slot') {
    appendMessage('user', value);
    await post(`/api/cta/mk0/register-new-appointment/${id}/slot`, { inputId, slotStart: value });
  }
  if (action === 'finalize') {
    appendMessage('user', 'Finalize Appointment');
    await post(`/api/cta/mk0/register-new-appointment/${id}/finalize`, { inputId });
  }

  // Keep the last prompt key until the durable Workflow actually changes.
  // Clearing it here can re-render the same prompt while Temporal is still
  // completing an accepted Update, which produced duplicate Step 08/11 text
  // during the first human C1A verification.
  await refresh();
}

async function sendInput() {
  const value = $('messageInput').value.trim();
  if (!value || !state.inputMode || !state.workflowId) return;
  $('messageInput').value = '';
  appendMessage('user', value);
  const id = encodeURIComponent(state.workflowId);
  const inputId = token(state.inputMode);

  if (state.inputMode === 'customer-name') {
    await post(`/api/cta/mk0/register-new-appointment/${id}/customer-data`, {
      inputId,
      customerPatch: { name: value },
    });
  }
  if (state.inputMode === 'customer-email') {
    await post(`/api/cta/mk0/register-new-appointment/${id}/customer-data`, {
      inputId,
      customerPatch: { contact: { email: value } },
    });
  }
  if (state.inputMode === 'customer-phone') {
    await post(`/api/cta/mk0/register-new-appointment/${id}/customer-data`, {
      inputId,
      customerPatch: {
        contact: {
          phones: [{ number: value, normalized: value.replace(/\D/g, ''), primary: true }],
        },
      },
    });
  }
  if (state.inputMode === 'date') {
    await post(`/api/cta/mk0/register-new-appointment/${id}/date`, {
      inputId,
      dateInput: value,
    });
  }

  // Do not reset the prompt key before durable state advances. The next
  // legitimate interaction has a different prompt key and will render once.
  await refresh();
}

$('startButton').addEventListener('click', () => startWorkflow().catch((error) => appendMessage('system', `ERROR: ${error.message}`)));
$('sendButton').addEventListener('click', () => sendInput().catch((error) => appendMessage('system', `ERROR: ${error.message}`)));
$('messageInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('sendButton').click();
});

async function boot() {
  try {
    const health = await json('/health');
    $('connectionStatus').textContent = health.ok ? 'CTA ready' : 'CTA unavailable';
  } catch {
    $('connectionStatus').textContent = 'CTA unavailable';
  }

  if (state.workflowId) {
    $('startButton').disabled = true;
    $('businessSlug').disabled = true;
    await refresh();
  } else {
    appendMessage('system', 'No Agent. No MCP. This WebChat drives the same explicit CTA → Temporal flow as the CLI. Start the Workflow to begin.');
  }

  setInterval(refresh, 750);
}

boot().catch((error) => appendMessage('system', `BOOT ERROR: ${error.message}`));
