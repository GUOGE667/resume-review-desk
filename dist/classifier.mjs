export const DEFAULT_ROLES = [
  { id: 'frontend', name: '前端工程', keywords: ['React', 'Vue', 'TypeScript', 'JavaScript', 'CSS', '前端', '组件'] },
  { id: 'backend', name: '后端工程', keywords: ['Java', 'Spring', 'Python', 'FastAPI', 'Node.js', 'PostgreSQL', '后端', 'API'] },
  { id: 'data', name: '数据分析', keywords: ['SQL', 'Pandas', 'ETL', 'Tableau', 'Power BI', '数据分析', '数据仓库'] },
  { id: 'ai', name: 'AI / 算法', keywords: ['PyTorch', 'TensorFlow', '机器学习', '模型训练', 'LLM', 'RAG', 'Agent', '算法'] },
];

const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
const boundaryPattern = /[a-z0-9]/i;

function findTerm(text, term) {
  const haystack = normalize(text);
  const needle = normalize(term).trim();
  if (!needle) return -1;
  let from = 0;
  while (from < haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return -1;
    const before = index > 0 ? haystack[index - 1] : '';
    const after = haystack[index + needle.length] || '';
    const startsWord = boundaryPattern.test(needle[0]);
    const endsWord = boundaryPattern.test(needle[needle.length - 1]);
    if ((!startsWord || !boundaryPattern.test(before)) && (!endsWord || !boundaryPattern.test(after))) return index;
    from = index + needle.length;
  }
  return -1;
}

function excerpt(text, index, length) {
  const start = Math.max(0, index - 35);
  const end = Math.min(text.length, index + length + 45);
  return `${start ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

export function classifyResume(text, roles = DEFAULT_ROLES) {
  const content = String(text || '').slice(0, 150_000);
  const matches = roles.map(role => {
    const seen = new Set();
    const evidence = [];
    for (const raw of role.keywords || []) {
      const keyword = String(raw).trim();
      const normalized = normalize(keyword);
      if (!keyword || seen.has(normalized)) continue;
      seen.add(normalized);
      const index = findTerm(content, keyword);
      if (index >= 0) evidence.push({ keyword, quote: excerpt(content, index, keyword.length) });
    }
    return { roleId: role.id, roleName: role.name, evidence, count: evidence.length };
  }).sort((a, b) => b.count - a.count);
  const top = matches[0];
  const second = matches[1];
  const needsReview = !top || top.count < 2 || (second && second.count === top.count);
  return {
    suggestion: needsReview ? null : top.roleId,
    label: needsReview ? '待人工复核' : top.roleName,
    reason: !top || top.count === 0 ? '未找到岗位关键词' : top.count < 2 ? '证据不足：只找到一个关键词' : second && second.count === top.count ? '多个岗位类别的证据数量相同' : '找到多项岗位相关证据',
    matches,
    evidence: top?.evidence || [],
    needsReview,
  };
}

export function evaluateSamples(samples, roles = DEFAULT_ROLES) {
  const rows = samples.filter(item => Object.hasOwn(item, 'expected'));
  const correct = rows.filter(item => classifyResume(item.text, roles).suggestion === item.expected).length;
  const expectedReview = rows.filter(item => item.expected === null);
  const reviewCorrect = expectedReview.filter(item => classifyResume(item.text, roles).needsReview).length;
  return { total: rows.length, correct, accuracy: rows.length ? correct / rows.length : 0, reviewTotal: expectedReview.length, reviewCorrect };
}
