export function latestReview(item) {
  return item.reviewHistory?.at(-1) || null;
}

export function createReviewEntry({ item, suggestion, confirmedRole, reason, ruleVersion, roles, timestamp = new Date().toISOString() }) {
  const note = String(reason || '').trim();
  if (!note) throw new Error('请填写本次复核理由。');
  if (!Number.isSafeInteger(ruleVersion) || ruleVersion < 1) throw new Error('规则版本无效。');
  if (!Array.isArray(roles) || !roles.length) throw new Error('岗位规则缺失。');
  if (confirmedRole !== 'undetermined' && !roles.some(role => role.id === confirmedRole)) throw new Error('人工类别无效。');
  const previous = latestReview(item);
  return {
    sequence:(item.reviewHistory?.length || 0) + 1,
    timestamp,
    ruleVersion,
    ruleSnapshot:roles.map(role => ({ id:role.id, name:role.name, keywords:[...role.keywords] })),
    suggestedRole:suggestion || null,
    previousRole:previous ? previous.confirmedRole : (suggestion || null),
    confirmedRole,
    reason:note,
  };
}

export function auditExportRows(resumes, label) {
  return resumes.flatMap(item => (item.reviewHistory || []).map(entry => [
    item.id, item.name, item.source, entry.sequence, entry.timestamp, entry.ruleVersion,
    label(entry.suggestedRole), label(entry.previousRole), label(entry.confirmedRole), entry.reason,
    JSON.stringify(entry.ruleSnapshot),
  ]));
}
