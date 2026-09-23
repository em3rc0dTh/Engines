import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('./public/app-c1b.js', import.meta.url);

test('WebChat manual trial routes conversational phases through Agent endpoint', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /post\('\/api\/agent\/messages'/);
  assert.match(source, /state\.inputMode === 'agent'/);
  assert.match(source, /renderAgentInteraction\(durable\)/);
  assert.match(source, /runtime\.route/);
  assert.match(source, /modelInvoked/);
});

test('WebChat keeps customer identity intake deterministic before Agent handoff', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /'customer-name': \['PROVIDE_CUSTOMER'/);
  assert.match(source, /'customer-email': \['PROVIDE_CUSTOMER'/);
  assert.match(source, /if \(!customerResolved\(\)\)/);
});
