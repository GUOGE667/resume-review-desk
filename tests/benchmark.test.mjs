import test from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_CASES } from '../dist/benchmark-data.mjs';
import { evaluateBenchmark } from '../dist/benchmark.mjs';
import { DEMO_RESUMES } from '../dist/demo-data.mjs';

test('challenge set stays separate, balanced, and frozen at the documented baseline', () => {
  assert.equal(BENCHMARK_CASES.length, 40);
  assert.equal(new Set(BENCHMARK_CASES.map(item => item.id)).size, 40);
  assert.equal(new Set(BENCHMARK_CASES.map(item => item.text)).size, 40);
  assert.ok(BENCHMARK_CASES.every(item => !DEMO_RESUMES.some(demo => demo.text === item.text)));
  for (const expected of ['frontend', 'backend', 'data', 'ai', null]) {
    assert.equal(BENCHMARK_CASES.filter(item => item.expected === expected).length, 8);
  }
  const result = evaluateBenchmark(BENCHMARK_CASES);
  assert.equal(result.total, 40);
  assert.equal(result.correct, 22);
  assert.equal(result.exactAccuracy, 22 / 40);
  assert.equal(result.autoCoverage, 21 / 40);
  assert.equal(result.autoAccuracy, 17 / 21);
  assert.equal(result.reviewPrecision, 5 / 19);
  assert.equal(result.reviewRecall, 5 / 8);
  assert.equal(result.confusion.review.backend, 1);
  assert.equal(result.confusion.review.data, 1);
  assert.equal(result.confusion.review.frontend, 1);
});

test('metric denominators handle abstention and wrong automatic suggestions', () => {
  const cases = [
    { id:'one', scenario:'test', expected:'frontend', text:'React TypeScript CSS' },
    { id:'two', scenario:'test', expected:'backend', text:'No technical terms here' },
    { id:'three', scenario:'test', expected:null, text:'React TypeScript CSS' },
  ];
  const result = evaluateBenchmark(cases);
  assert.equal(result.exactAccuracy, 1 / 3);
  assert.equal(result.autoCoverage, 2 / 3);
  assert.equal(result.autoAccuracy, 1 / 2);
  assert.equal(result.reviewPrecision, 0);
  assert.equal(result.reviewRecall, 0);
  assert.deepEqual(result.confusion.backend, { frontend:0, backend:0, data:0, ai:0, review:1 });
});
