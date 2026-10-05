import { DEMO_RESUMES } from './demo-data.mjs';

// Persist only rules and reviews of built-in fictional records. Imported
// resumes, their names, extracted text, and their reviews remain in memory.
export const STORAGE_KEY = 'resume-review-desk:local-snapshot:v2';
export const LEGACY_STORAGE_KEY = 'resume-review-desk:local-snapshot:v1';
const ROLE_IDS = ['frontend', 'backend', 'data', 'ai'];
const DEMO_IDS = DEMO_RESUMES.map(item => item.id);
const MAX_SNAPSHOT_LENGTH = 1_000_000;

export function createSnapshot({ roles, ruleVersion, resumes }) {
  const reviews = Object.fromEntries(DEMO_IDS.map(id => {
    const item = resumes.find(candidate => candidate.id === id && candidate.source === '虚构样本');
    return [id, item?.reviewHistory.map(entry => structuredClone(entry)) || []];
  }));
  return {
    schemaVersion:2,
    savedAt:new Date().toISOString(),
    roles:roles.map(role => ({ id:role.id, name:role.name, keywords:[...role.keywords] })),
    ruleVersion,
    reviews,
  };
}

export function parseSnapshot(raw) {
  if (!raw || raw.length > MAX_SNAPSHOT_LENGTH) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (data?.schemaVersion !== 2 || !Number.isSafeInteger(data.ruleVersion) || data.ruleVersion < 1) return null;
  if (!Array.isArray(data.roles) || data.roles.length !== ROLE_IDS.length) return null;
  for (let i = 0; i < ROLE_IDS.length; i++) {
    const role = data.roles[i];
    if (role?.id !== ROLE_IDS[i] || typeof role.name !== 'string' || !Array.isArray(role.keywords) || role.keywords.length < 2 ||
      !role.keywords.every(term => typeof term === 'string' && term.length <= 80)) return null;
  }
  if (!data.reviews || typeof data.reviews !== 'object' || Array.isArray(data.reviews) ||
    Object.keys(data.reviews).some(id => !DEMO_IDS.includes(id))) return null;
  for (const id of DEMO_IDS) {
    const history = data.reviews[id];
    if (!Array.isArray(history) || history.length > 100) return null;
    if (!history.every(entry => entry && typeof entry === 'object' &&
      typeof entry.reason === 'string' && typeof entry.timestamp === 'string' &&
      typeof entry.confirmedRole === 'string' && Array.isArray(entry.ruleSnapshot))) return null;
  }
  return data;
}

export function purgeLegacySnapshot(storage) {
  try {
    const present = storage.getItem(LEGACY_STORAGE_KEY) !== null;
    if (present) storage.removeItem(LEGACY_STORAGE_KEY);
    return present;
  } catch { return false; }
}

export function loadSnapshot(storage) {
  try { return parseSnapshot(storage.getItem(STORAGE_KEY)); } catch { return null; }
}

export function saveSnapshot(storage, state) {
  const snapshot = createSnapshot(state);
  const serialized = JSON.stringify(snapshot);
  if (serialized.length > MAX_SNAPSHOT_LENGTH) throw new Error('虚构样本复核记录超过本机保存上限；请先导出复核日志。');
  purgeLegacySnapshot(storage);
  storage.setItem(STORAGE_KEY, serialized);
  return snapshot;
}

export function clearSnapshot(storage) {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(LEGACY_STORAGE_KEY);
}
