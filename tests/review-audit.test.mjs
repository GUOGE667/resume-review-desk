import test from 'node:test';
import assert from 'node:assert/strict';
import { auditExportRows, createReviewEntry, latestReview } from '../dist/review-audit.mjs';
import { DEFAULT_ROLES } from '../dist/classifier.mjs';

test('each review records the before and after decision with its own rule snapshot', () => {
  const item = { reviewHistory:[] };
  const roles = DEFAULT_ROLES.map(role => ({ ...role, keywords:[...role.keywords] }));
  const first = createReviewEntry({ item, suggestion:'frontend', confirmedRole:'backend', reason:'原文显示主要负责后端接口', ruleVersion:1, roles, timestamp:'2026-10-04T12:00:00.000Z' });
  item.reviewHistory.push(first);
  roles[0].keywords.push('Next.js');
  const second = createReviewEntry({ item, suggestion:'frontend', confirmedRole:'undetermined', reason:'需要补充职责范围', ruleVersion:2, roles, timestamp:'2026-10-04T12:05:00.000Z' });
  item.reviewHistory.push(second);
  assert.equal(first.previousRole, 'frontend');
  assert.equal(first.confirmedRole, 'backend');
  assert.equal(first.ruleSnapshot[0].keywords.includes('Next.js'), false);
  assert.equal(second.previousRole, 'backend');
  assert.equal(second.confirmedRole, 'undetermined');
  assert.equal(second.ruleVersion, 2);
  assert.equal(latestReview(item), second);
  assert.equal(item.reviewHistory.length, 2);
});

test('a review requires a reason and a valid selected category', () => {
  const input = { item:{ reviewHistory:[] }, suggestion:null, confirmedRole:'undetermined', reason:'  ', ruleVersion:1, roles:DEFAULT_ROLES };
  assert.throws(() => createReviewEntry(input), /理由/);
  assert.throws(() => createReviewEntry({ ...input, confirmedRole:'unknown', reason:'待补充材料' }), /类别/);
});

test('audit export includes every event and excludes resume text', () => {
  const item = { id:'demo-01', name:'虚构人物', source:'虚构样本', text:'不应出现在导出中', reviewHistory:[] };
  item.reviewHistory.push(createReviewEntry({ item, suggestion:'frontend', confirmedRole:'frontend', reason:'证据已核对', ruleVersion:1, roles:DEFAULT_ROLES, timestamp:'2026-10-04T12:00:00.000Z' }));
  item.reviewHistory.push(createReviewEntry({ item, suggestion:'frontend', confirmedRole:'undetermined', reason:'还需复核', ruleVersion:1, roles:DEFAULT_ROLES, timestamp:'2026-10-04T12:01:00.000Z' }));
  const rows = auditExportRows([item], id => id || '无岗位建议');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row[3]), [1, 2]);
  assert.equal(rows[1][7], 'frontend');
  assert.equal(JSON.stringify(rows).includes(item.text), false);
});
