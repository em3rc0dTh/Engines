const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
const state = {
  conversationId: params.get('conversationId') || localStorage.getItem('engines.webchat.conversationId') || '',
  workflowId: params.get('workflowId') || '',
  snapshot: null,
  view: null,
  inputMode: null,
  lastPromptKey: '',
  lastPhaseSignature: '',
  polling: false,
  submitting: false,
};

function randomId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function transportMessageId(label) {
  return randomId(`webchat-${label}`);
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
  $('messageInput').disabled = !enabled || state.submitting;
  $('sendButton').disabled = !enabled || state.submitting;
  if (enabled && !state.submitting) $('messageInput').focus();
}

function clearChoices() {
  $('choices').replaceChildren();
}

function choice(label, handler) {
  const button = document.createElement('button');
  button.className = 'choice';
  button.textContent = label;
  button.disabled = state.submitting;
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
  if (!state.conversationId || !state.snapshot?.state) {
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
      promptOnce('customer-name', 'Step 02 — Enter the customer name.');
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
      choice('Resolve Customer', () => runAction('RESOLVE_CUSTOMER', {}, 'Resolve Customer'));
      return;
    }
  }

  if (durable.nextAction === 'SELECT_SERVICE') {
    promptOnce('select-service', 'Step 06 — Select a Service loaded by the Workflow.');
    setInput(null, 'Choose a Service', false);
    for (const service of durable.services ?? []) {
      choice(service.name, () => runAction('SELECT_SERVICE', { serviceId: service.serviceId }, service.name));
    }
    return;
  }

  if (durable.nextAction === 'SELECT_PRODUCT') {
    promptOnce('select-product', 'Step 07 — Select an Offering / Product for the selected Service.');
    setInput(null, 'Choose an Offering', false);
    for (const product of durable.products ?? []) {
      choice(`${product.name} · ${product.durationMinutes} min`, () => runAction('SELECT_OFFERING', { productId: product.productId }, product.name));
    }
    return;
  }

  if (durable.nextAction === 'PROVIDE_DATE') {
    promptOnce('date', 'Step 08 — Enter the appointment date. The CTA accepts the same human date forms as the CLI.');
    setInput('date', 'viernes / Friday / YYYY-MM-DD');
    return;
  }

  if (durable.nextAction === 'SELECT_SLOT') {
    promptOnce('slot', 'Step 10 — Available slots are loaded. Select one.');
    setInput(null, 'Choose a slot', false);
    for (const slot of durable.availableSlots ?? []) {
      choice(`${slot.start}–${slot.end}`, () => runAction('SELECT_SLOT', { slotStart: slot.start }, slot.start));
    }
    return;
  }

  if (durable.nextAction === 'FINALIZE_APPOINTMENT') {
    promptOnce('finalize', 'Step 11 — The Workflow is READY_TO_FINALIZE. Persist the Appointment explicitly.');
    setInput(null, 'Use Finalize Appointment', false);
    choice('Finalize Appointment', () => runAction('FINALIZE_APPOINTMENT', {}, 'Finalize Appointment'));
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
  state.workflowId = snapshot.workflowId ?? state.workflowId;
  const durable = snapshot.state ?? {};
  $('workflowId').textContent = state.workflowId || '—';
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
  if (!state.conversationId || state.polling) return;
  state.polling = true;
  try {
    const snapshot = await json(`/api/channel/conversations/${encodeURIComponent(state.conversationId)}/view`);
    render(snapshot);
    $('connectionStatus').textContent = 'Temporal + durable channel connected';
  } catch (error) {
    if (String(error.message).includes('CHANNEL_CONVERSATION_NOT_BOUND')) return;
    $('connectionStatus').textContent = 'state unavailable';
    console.error(error);
  } finally {
    state.polling = false;
  }
}

async function sendChannel(operation, data = {}, messageId = transportMessageId(operation.toLowerCase())) {
  return post('/api/channel/events', {
    conversationId: state.conversationId,
    messageId,
    senderId: 'webchat-browser',
    operation,
    data,
  });
}

async function withSubmission(task) {
  if (state.submitting) return;
  state.submitting = true;
  renderInteraction();
  try {
    await task();
  } finally {
    state.submitting = false;
  }
}

async function startWorkflow() {
  await withSubmission(async () => {
    state.conversationId = state.conversationId || randomId('webchat-conversation');
    localStorage.setItem('engines.webchat.conversationId', state.conversationId);
    const url = new URL(location.href);
    url.searchParams.set('conversationId', state.conversationId);
    history.replaceState({}, '', url);

    const receipt = await sendChannel('START_APPOINTMENT');
    state.workflowId = receipt.workflowId ?? state.workflowId;
    $('startButton').disabled = true;
    $('businessSlug').disabled = true;
    appendMessage('system', `Step 01 — Durable channel conversation started.\nConversation: ${state.conversationId}\nWorkflow: ${state.workflowId}`);
    await refresh();
  });
}

async function runAction(operation, data, label) {
  await withSubmission(async () => {
    appendMessage('user', label);
    await sendChannel(operation, data);
    await refresh();
  });
}

async function sendInput() {
  const value = $('messageInput').value.trim();
  if (!value || !state.inputMode || !state.conversationId) return;
  $('messageInput').value = '';
  appendMessage('user', value);

  const actions = {
    'customer-name': ['PROVIDE_CUSTOMER', { customerPatch: { name: value } }],
    'customer-email': ['PROVIDE_CUSTOMER', { customerPatch: { contact: { email: value } } }],
    'customer-phone': ['PROVIDE_CUSTOMER', {
      customerPatch: {
        contact: { phones: [{ number: value, normalized: value.replace(/\D/g, ''), primary: true }] },
      },
    }],
    date: ['SET_DATE', { dateInput: value }],
  };
  const selected = actions[state.inputMode];
  if (!selected) return;

  await withSubmission(async () => {
    await sendChannel(selected[0], selected[1]);
    await refresh();
  });
}

$('startButton').addEventListener('click', () => startWorkflow().catch((error) => appendMessage('system', `ERROR: ${error.message}`)));
$('sendButton').addEventListener('click', () => sendInput().catch((error) => appendMessage('system', `ERROR: ${error.message}`)));
$('messageInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('sendButton').click();
});

async function boot() {
  try {
    const health = await json('/health');
    $('connectionStatus').textContent = health.ok ? 'CTA + channel ready' : 'CTA unavailable';
    if (health.trustedBusinessSlug) $('businessSlug').value = health.trustedBusinessSlug;
  } catch {
    $('connectionStatus').textContent = 'CTA unavailable';
  }

  if (state.conversationId) {
    $('startButton').disabled = true;
    $('businessSlug').disabled = true;
    await refresh();
  } else {
    appendMessage('system', 'No Agent. No MCP. Durable WebChat channel → Temporal. Start the Workflow to begin.');
  }

  setInterval(refresh, 750);
}

boot().catch((error) => appendMessage('system', `BOOT ERROR: ${error.message}`));
