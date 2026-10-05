import test from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_CASES } from '../dist/benchmark-data.mjs';
import { evaluateBenchmark } from '../dist/benchmark.mjs';
import { DEMO_RESUMES } from '../dist/demo-data.mjs';
import { DEVELOPMENT_CASES } from '../dist/development-data.mjs';
import { DEFAULT_ROLES as BASELINE_ROLES, classifyResume as classifyBaseline } from '../dist/baseline-classifier.mjs';

test('challenge set stays separate, balanced, and frozen for a reproducible before and after comparison', () => {
  assert.equal(BENCHMARK_CASES.length, 40);
  assert.equal(new Set(BENCHMARK_CASES.map(item => item.id)).size, 40);
  assert.equal(new Set(BENCHMARK_CASES.map(item => item.text)).size, 40);
  assert.ok(BENCHMARK_CASES.every(item => !DEMO_RESUMES.some(demo => demo.text === item.text)));
  for (const expected of ['frontend', 'backend', 'data', 'ai', null]) {
    assert.equal(BENCHMARK_CASES.filter(item => item.expected === expected).length, 8);
  }
  const baseline = evaluateBenchmark(BENCHMARK_CASES, BASELINE_ROLES, classifyBaseline);
  assert.equal(baseline.total, 40);
  assert.equal(baseline.correct, 22);
  assert.equal(baseline.autoCoverage, 21 / 40);
  assert.equal(baseline.autoAccuracy, 17 / 21);
  assert.equal(baseline.wrongAutoSuggestions, 4);
  assert.equal(baseline.reviewRecall, 5 / 8);
  const improved = evaluateBenchmark(BENCHMARK_CASES);
  assert.equal(improved.correct, 37);
  assert.equal(improved.autoCoverage, 31 / 40);
  assert.equal(improved.autoAccuracy, 30 / 31);
  assert.equal(improved.wrongAutoSuggestions, 1);
  assert.equal(improved.reviewRecall, 7 / 8);
  assert.deepEqual(improved.rows.filter(row => !row.correct).map(row => row.id), ['B07', 'A04', 'R06']);
});

test('development cases are distinct and validate aliases, mixed experience, and non-practice language', () => {
  assert.equal(DEVELOPMENT_CASES.length, 25);
  assert.equal(new Set(DEVELOPMENT_CASES.map(item => item.text)).size, 25);
  assert.ok(DEVELOPMENT_CASES.every(item => !BENCHMARK_CASES.some(challenge => challenge.text === item.text)));
  const baseline = evaluateBenchmark(DEVELOPMENT_CASES, BASELINE_ROLES, classifyBaseline);
  const improved = evaluateBenchmark(DEVELOPMENT_CASES);
  assert.equal(baseline.correct, 11);
  assert.equal(improved.correct, 25);
  assert.equal(improved.wrongAutoSuggestions, 0);
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
