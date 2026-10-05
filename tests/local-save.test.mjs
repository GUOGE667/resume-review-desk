import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSnapshot, loadSnapshot, purgeLegacySnapshot, saveSnapshot, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../dist/local-save.mjs';
import { DEFAULT_ROLES } from '../dist/classifier.mjs';
import { DEMO_RESUMES } from '../dist/demo-data.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem:key => values.get(key) ?? null,
    setItem:(key, value) => values.set(key, value),
    removeItem:key => values.delete(key),
  };
}

test('browser snapshot saves only fictional demo reviews and rules', () => {
  const storage = memoryStorage();
  storage.setItem('unrelated', 'keep');
  const state = {
    roles:DEFAULT_ROLES,
    ruleVersion:2,
    resumes:[
      { ...DEMO_RESUMES[0], source:'虚构样本',
        reviewHistory:[{ reason:'虚构样本复核', timestamp:'2026-10-05T00:00:00.000Z', confirmedRole:'frontend', ruleSnapshot:DEFAULT_ROLES }] },
      { id:'local-one', name:'private-import.txt', source:'本地导入', text:'SENSITIVE_IMPORTED_TEXT',
        reviewHistory:[{ reason:'SENSITIVE_IMPORT_REVIEW', timestamp:'2026-10-05T00:00:00.000Z', confirmedRole:'frontend', ruleSnapshot:DEFAULT_ROLES }] },
    ],
  };
  saveSnapshot(storage, state);
  const raw = storage.getItem(STORAGE_KEY);
  assert.ok(!raw.includes('private-import.txt'));
  assert.ok(!raw.includes('SENSITIVE_IMPORTED_TEXT'));
  assert.ok(!raw.includes('SENSITIVE_IMPORT_REVIEW'));
  assert.ok(!raw.includes(DEMO_RESUMES[0].text));
  const recovered = loadSnapshot(storage);
  assert.equal(recovered.ruleVersion, 2);
  assert.equal(recovered.reviews[DEMO_RESUMES[0].id][0].reason, '虚构样本复核');
  clearSnapshot(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
});

test('legacy snapshot containing imported text is deleted without loading it', () => {
  const storage = memoryStorage();
  storage.setItem(LEGACY_STORAGE_KEY, '{"resumes":[{"text":"SENSITIVE_IMPORTED_TEXT"}]}');
  assert.equal(purgeLegacySnapshot(storage), true);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), null);
  assert.equal(loadSnapshot(storage), null);
});

test('invalid or oversized snapshots fail closed', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{bad json');
  assert.equal(loadSnapshot(storage), null);
  storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion:2, roles:[], ruleVersion:1, reviews:{} }));
  assert.equal(loadSnapshot(storage), null);
  storage.setItem(STORAGE_KEY, 'x'.repeat(1_000_001));
  assert.equal(loadSnapshot(storage), null);
});
