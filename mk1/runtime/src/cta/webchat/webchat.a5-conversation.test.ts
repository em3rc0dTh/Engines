import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publicRoot = new URL('./public/', import.meta.url);

test('A5 WebChat begins from free-form text without requiring Start Workflow', async () => {
  const source = await readFile(new URL('app-c1b.js', publicRoot), 'utf8');
  assert.match(source, /agentExperienceEnabled/);
  assert.match(source, /\/api\/agent\/experience\/messages/);
  assert.match(source, /ensureConversationSession\(\)/);
  assert.match(source, /setInput\('agent-experience', 'Cuéntame qué necesitas…'\)/);
  assert.match(source, /\$\('startButton'\)\.style\.display = 'none'/);
});

test('A5 WebChat keeps progressive distillation outside the human chat stream', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('app-c1b.js', publicRoot), 'utf8'),
    readFile(new URL('chat.html', publicRoot), 'utf8'),
  ]);
  assert.match(source, /renderDistillation\(result\.distillation, result\.confirmed\)/);
  assert.match(html, /A5 progressive distillation/);
  assert.match(html, /id="distillationState"/);
});
