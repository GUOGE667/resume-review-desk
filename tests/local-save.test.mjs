import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSnapshot, loadSnapshot, saveSnapshot, STORAGE_KEY } from '../dist/local-save.mjs';
import { DEFAULT_ROLES } from '../dist/classifier.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem:key => values.get(key) ?? null,
    setItem:(key, value) => values.set(key, value),
    removeItem:key => values.delete(key),
  };
}

test('browser snapshot restores text, rules and review history, then clears only its own key', () => {
  const storage = memoryStorage();
  storage.setItem('unrelated', 'keep');
  const state = {
    roles:DEFAULT_ROLES,
    ruleVersion:2,
    resumes:[{ id:'local-one', name:'fictional.txt', source:'本地导入', text:'React TypeScript CSS project experience.',
      reviewHistory:[{ reason:'人工核对原文', timestamp:'2026-10-05T00:00:00.000Z', confirmedRole:'frontend', ruleSnapshot:DEFAULT_ROLES }] }],
  };
  saveSnapshot(storage, state);
  const recovered = loadSnapshot(storage);
  assert.equal(recovered.ruleVersion, 2);
  assert.equal(recovered.resumes[0].text, state.resumes[0].text);
  assert.equal(recovered.resumes[0].reviewHistory[0].reason, '人工核对原文');
  clearSnapshot(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
});

test('invalid or oversized snapshots fail closed', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{bad json');
  assert.equal(loadSnapshot(storage), null);
  storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion:1, roles:[], ruleVersion:1, resumes:[] }));
  assert.equal(loadSnapshot(storage), null);
  storage.setItem(STORAGE_KEY, 'x'.repeat(5_000_001));
  assert.equal(loadSnapshot(storage), null);
});
