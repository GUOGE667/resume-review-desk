import test from 'node:test';
import assert from 'node:assert/strict';
import { runOfflineWorkflow } from '../dist/workflow.mjs';
import { OFFLINE_TOOLS } from '../dist/workflow-tools.mjs';
import { BENCHMARK_CASES } from '../dist/benchmark-data.mjs';

const byId = id => BENCHMARK_CASES.find(item => item.id === id);

test('supported suggestion travels through four tools and still waits for a person', () => {
  const record = byId('F01');
  const result = runOfflineWorkflow(record);
  assert.deepEqual(result.trace.map(step => step.tool), ['read_text', 'propose_category', 'verify_evidence', 'route_human_review']);
  assert.deepEqual(result.trace.map(step => step.status), ['ok', 'ok', 'ok', 'ok']);
  assert.equal(result.final.suggestion, 'frontend');
  assert.equal(result.final.priority, '常规复核');
  assert.equal(result.final.requiresHumanConfirmation, true);
  assert.equal(result.trace[2].output.verified, true);
});

test('missing evidence skips verification and escalates without an automatic category', () => {
  const result = runOfflineWorkflow(byId('B07'));
  assert.equal(result.trace[2].status, 'skipped');
  assert.equal(result.final.suggestion, null);
  assert.equal(result.final.priority, '优先复核');
});

test('replay exposes a semantic false positive instead of claiming to detect it', () => {
  const result = runOfflineWorkflow(byId('R06'));
  assert.equal(result.final.suggestion, 'data');
  assert.equal(result.trace[2].output.verified, true);
  assert.equal(result.final.requiresHumanConfirmation, true);
});

test('insufficient text fails closed and expected labels never enter tool inputs', () => {
  const result = runOfflineWorkflow({ id:'short', text:'React', expected:'frontend' });
  assert.deepEqual(result.trace.map(step => step.tool), ['read_text', 'route_human_review']);
  assert.equal(result.trace[0].status, 'error');
  assert.equal(result.final.suggestion, null);
  assert.equal(JSON.stringify(result).includes('expected'), false);
});

test('evidence tool rejects a quote that does not support its keyword', () => {
  const check = OFFLINE_TOOLS.verify_evidence({
    text:'React TypeScript are used for this interface.',
    proposal:{ evidence:[{ keyword:'React', quote:'React TypeScript' }, { keyword:'TypeScript', quote:'unsupported quote' }] },
  });
  assert.equal(check.verified, false);
  assert.match(check.issues[0], /TypeScript/);
});
