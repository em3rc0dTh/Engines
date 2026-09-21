const $ = (id) => document.getElementById(id);
const workflowId = new URLSearchParams(location.search).get('workflowId') || localStorage.getItem('engines.webchat.workflowId') || '';
let refreshing = false;

async function json(path) {
  const response = await fetch(path);
  const raw = await response.json();
  if (!response.ok) throw new Error(raw.error || raw.code || `HTTP ${response.status}`);
  return raw;
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

function businessProjection(state) {
  return {
    customer: state.customer,
    selectedService: state.selectedService,
    selectedProduct: state.selectedProduct,
    appointmentDate: state.appointmentDate,
    availableSlots: state.availableSlots,
    selectedSlot: state.selectedSlot,
    issues: state.issues,
    result: state.result,
  };
}

async function refresh() {
  if (!workflowId || refreshing) return;
  refreshing = true;
  try {
    const snapshot = await json(`/api/appointments/${encodeURIComponent(workflowId)}/view`);
    const durable = snapshot.state ?? {};
    $('workflowId').textContent = snapshot.workflowId ?? workflowId;
    $('runId').textContent = snapshot.runId ?? '—';
    $('workflowStatus').textContent = durable.workflowStatus ?? '—';
    $('phase').textContent = durable.phase ?? '—';
    $('nextAction').textContent = durable.nextAction ?? '—';
    $('lastRefresh').textContent = new Date().toLocaleTimeString();
    $('businessState').textContent = JSON.stringify(businessProjection(durable), null, 2);
    $('rawState').textContent = JSON.stringify(snapshot, null, 2);
    renderSteps(snapshot.view);
    $('connectionStatus').textContent = 'live';
  } catch (error) {
    $('connectionStatus').textContent = 'unavailable';
    $('rawState').textContent = String(error);
  } finally {
    refreshing = false;
  }
}

if (!workflowId) {
  $('connectionStatus').textContent = 'workflowId required';
  $('rawState').textContent = 'Open this page from an active WebChat session or provide ?workflowId=<id>.';
  $('refreshButton').disabled = true;
} else {
  $('chatLink').href = `/webchat/?workflowId=${encodeURIComponent(workflowId)}`;
  $('refreshButton').addEventListener('click', refresh);
  refresh();
  setInterval(refresh, 750);
}
