import { MongoClient } from 'mongodb';

const observerUrl = (process.env.ENGINES_OBSERVER_URL ?? 'http://127.0.0.1:8890').replace(/\/$/, '');
const prometheusUrl = (process.env.ENGINES_PROMETHEUS_URL ?? 'http://127.0.0.1:9090').replace(/\/$/, '');
const grafanaUrl = (process.env.ENGINES_GRAFANA_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const otelUrl = (process.env.ENGINES_OTEL_HEALTH_URL ?? 'http://127.0.0.1:13133').replace(/\/$/, '');
const mongoUrl = process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017';
const mongoDb = process.env.MONGO_DB ?? 'engines_mk0';
const adminToken = process.env.ENGINES_OBSERVER_ADMIN_TOKEN ?? '';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PLATFORM_OG0_ASSERTION_FAILED:${message}`);
}
async function response(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
}
async function json(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const r = await response(url, init);
  assert(r.ok, `HTTP_${r.status}:${url}`);
  return await r.json() as Record<string, unknown>;
}

const health = await json(`${observerUrl}/health`);
assert(health.ok === true, 'observer health not green');

const metricsResponse = await response(`${observerUrl}/metrics`);
assert(metricsResponse.ok, 'metrics endpoint failed');
const metrics = await metricsResponse.text();
for (const component of ['cta', 'channel-core', 'temporal', 'postgres', 'mongo', 'minio']) {
  assert(metrics.includes(`engines_component_up{component="${component}"} 1`), `component metric not up: ${component}`);
}
assert(!metrics.includes(adminToken), 'operator token leaked into metrics');
assert(!/api[_-]?key|webhook[_-]?secret|bearer\s+/i.test(metrics), 'secret-like material leaked into metrics');
console.log('OBSERVABILITY_COMPONENT_METRICS_PASS');

const unauth = await response(`${observerUrl}/governance/status`);
assert(unauth.status === 401, `unauthenticated governance status=${unauth.status}`);
const denied = await response(`${observerUrl}/governance/status`, { headers: { authorization: 'Bearer incorrect-token' } });
assert(denied.status === 403, `wrong-token governance status=${denied.status}`);
const governance = await json(`${observerUrl}/governance/status`, { headers: { authorization: `Bearer ${adminToken}` } });
assert(governance.ok === true && governance.role === 'platform-operator', 'operator governance boundary failed');
const boundaries = governance.boundaries as Record<string, unknown>;
assert(boundaries.agent === false && boundaries.mcp === false, 'Agent/MCP boundary changed');
assert(boundaries.secretsExposed === false && boundaries.rawProviderPayloadsExposed === false, 'governance truth boundary failed');
console.log('GOVERNANCE_OPERATOR_ACCESS_BOUNDARY_PASS');

const promQuery = await json(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent('min(engines_component_up)')}`);
const promData = promQuery.data as Record<string, unknown>;
const promResult = promData.result as Array<Record<string, unknown>>;
const promValue = promResult?.[0]?.value as [number, string] | undefined;
assert(promValue?.[1] === '1', `Prometheus did not observe all components up: ${JSON.stringify(promResult)}`);
const rules = await json(`${prometheusUrl}/api/v1/rules`);
assert(JSON.stringify(rules).includes('EnginesComponentDown'), 'component-down alert rule missing');
console.log('PROMETHEUS_ALERT_RULES_PASS');

const grafana = await json(`${grafanaUrl}/api/health`);
assert(String(grafana.database).toLowerCase() === 'ok', 'Grafana database health not ok');
console.log('GRAFANA_HEALTH_PASS');

const otel = await response(`${otelUrl}/`);
assert(otel.ok, `OpenTelemetry collector health=${otel.status}`);
console.log('OPENTELEMETRY_PIPELINE_HEALTH_PASS');

const mongo = new MongoClient(mongoUrl);
try {
  await mongo.connect();
  const audit = mongo.db(mongoDb).collection('appointment_audit');
  const correlated = await audit.countDocuments({ correlationId: { $type: 'string', $ne: '' } });
  assert(correlated > 0, 'no correlated appointment audit evidence found');
} finally {
  await mongo.close();
}
console.log('GOVERNANCE_CORRELATED_AUDIT_PASS');
console.log('OBSERVABILITY_GOVERNANCE_CORE_PASS');
