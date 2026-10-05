// Browser-only prototype storage. Nothing is sent to a server.
export const STORAGE_KEY = 'resume-review-desk:local-snapshot:v1';
const MAX_TEXT = 150_000;
const ROLE_IDS = ['frontend', 'backend', 'data', 'ai'];

export function createSnapshot({ roles, ruleVersion, resumes }) {
  return {
    schemaVersion:1,
    savedAt:new Date().toISOString(),
    roles:roles.map(role => ({ id:role.id, name:role.name, keywords:[...role.keywords] })),
    ruleVersion,
    resumes:resumes.map(item => ({
      id:item.id, name:item.name, source:item.source, text:item.text,
      reviewHistory:item.reviewHistory.map(entry => structuredClone(entry)),
    })),
  };
}

export function parseSnapshot(raw) {
  if (!raw || raw.length > 5_000_000) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (data?.schemaVersion !== 1 || !Number.isSafeInteger(data.ruleVersion) || data.ruleVersion < 1) return null;
  if (!Array.isArray(data.roles) || data.roles.length !== ROLE_IDS.length) return null;
  for (let i = 0; i < ROLE_IDS.length; i++) {
    const role = data.roles[i];
    if (role?.id !== ROLE_IDS[i] || typeof role.name !== 'string' || !Array.isArray(role.keywords) || role.keywords.length < 2 ||
      !role.keywords.every(term => typeof term === 'string' && term.length <= 80)) return null;
  }
  if (!Array.isArray(data.resumes) || data.resumes.length > 100) return null;
  for (const item of data.resumes) {
    if (typeof item?.id !== 'string' || typeof item.name !== 'string' || typeof item.source !== 'string' ||
      typeof item.text !== 'string' || item.text.length > MAX_TEXT || !Array.isArray(item.reviewHistory) ||
      item.reviewHistory.length > 100) return null;
    if (!item.reviewHistory.every(entry => entry && typeof entry === 'object' &&
      typeof entry.reason === 'string' && typeof entry.timestamp === 'string' &&
      typeof entry.confirmedRole === 'string' && Array.isArray(entry.ruleSnapshot))) return null;
  }
  return data;
}

export function loadSnapshot(storage) {
  try { return parseSnapshot(storage.getItem(STORAGE_KEY)); } catch { return null; }
}

export function saveSnapshot(storage, state) {
  if (state.resumes.length > 100) throw new Error('本机保存最多支持 100 份简历；请先导出复核日志。');
  const snapshot = createSnapshot(state);
  const serialized = JSON.stringify(snapshot);
  if (serialized.length > 5_000_000) throw new Error('本地保存空间不足；请先导出复核日志并减少导入数量。');
  storage.setItem(STORAGE_KEY, serialized);
  return snapshot;
}

export function clearSnapshot(storage) {
  storage.removeItem(STORAGE_KEY);
}
