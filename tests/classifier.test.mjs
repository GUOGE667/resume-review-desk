import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyResume, evaluateSamples } from '../dist/classifier.mjs';
import { DEMO_RESUMES } from '../dist/demo-data.mjs';

test('synthetic evaluation has documented results', () => {
  const result = evaluateSamples(DEMO_RESUMES);
  assert.deepEqual(result, { total:10, correct:10, accuracy:1, reviewTotal:2, reviewCorrect:2 });
});

test('name and contact details do not affect the suggested category', () => {
  const experience = '使用 React、TypeScript 和 CSS 开发组件。';
  const first = classifyResume(`张明，男，22 岁。电话 123456。${experience}`);
  const second = classifyResume(`李华，女，35 岁。电话 999999。${experience}`);
  assert.equal(first.suggestion, 'frontend');
  assert.equal(second.suggestion, first.suggestion);
  assert.deepEqual(first.matches.map(item => item.count), second.matches.map(item => item.count));
});

test('isolated English terms do not match inside other words', () => {
  assert.equal(classifyResume('I enjoy reacting quickly and learning javabeans.').suggestion, null);
});

test('ambiguous and missing evidence require review', () => {
  assert.equal(classifyResume('React Vue Java Spring').suggestion, null);
  assert.equal(classifyResume('擅长沟通和文档整理').suggestion, null);
});
