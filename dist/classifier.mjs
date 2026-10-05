export const DEFAULT_ROLES = [
  { id:'frontend', name:'前端工程', keywords:['React', 'Vue', 'TypeScript', 'JavaScript', 'CSS', '前端', '组件', 'Angular', 'Svelte', 'HTML', 'SCSS', 'RxJS', 'Vite', '界面开发'] },
  { id:'backend', name:'后端工程', keywords:['Java', 'Spring', 'Python', 'FastAPI', 'Node.js', 'PostgreSQL', '后端', 'API', 'Go', 'gRPC', 'Redis', 'Kotlin', 'Ktor', 'MySQL', '服务端', '微服务', '鉴权'] },
  { id:'data', name:'数据分析', keywords:['SQL', 'Pandas', 'ETL', 'Tableau', 'Power BI', '数据分析', '数据仓库', 'Spark', 'Hive', 'Excel', '商业分析', 'A/B 实验', '可视化', '报表'] },
  { id:'ai', name:'AI / 算法', keywords:['PyTorch', 'TensorFlow', '机器学习', '模型训练', 'LLM', 'RAG', 'Agent', '算法', 'Hugging Face', 'LoRA', 'LangChain', '向量检索', '大模型', '模型'] },
];

const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
const boundaryPattern = /[a-z0-9]/i;
const unprovenPattern = /不熟悉|尚未|尚无|没有|未参加|未使用|计划(?:以后|将来)?|希望将来|培训(?:介绍|大纲|清单)|听过(?:一次)?|只参加过/;
const secondaryPattern = /偶尔|也曾|曾经|过去|旧项目|入门|培训|练习|接触过/;
const primaryPattern = /主要|负责|长期|目标岗位|希望继续/;
const undecidedPattern = /(?:尚未|未|没有).{0,6}(?:确定|明确)(?:目标|方向|岗位|主攻)|希望(?:进一步)?确认(?:目标)?岗位/;

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

function clauses(text) {
  const output = [];
  for (const sentence of text.matchAll(/[^，。；;!?！？\n]+/g)) {
    const piece = sentence[0];
    const parts = piece.split(/但是|不过|然而|但/);
    let from = 0;
    for (const part of parts) {
      const local = piece.indexOf(part, from);
      if (part.trim()) output.push({ text:part, start:sentence.index + local });
      from = local + part.length;
    }
  }
  return output;
}

function weightFor(clause) {
  if (secondaryPattern.test(clause)) return 0.35;
  if (primaryPattern.test(clause)) return 1.5;
  return 1;
}

export function classifyResume(text, roles = DEFAULT_ROLES) {
  const content = String(text || '').slice(0, 150_000);
  const usableClauses = clauses(content).filter(clause => !unprovenPattern.test(clause.text));
  const matches = roles.map(role => {
    const seen = new Set();
    const evidence = [];
    let score = 0;
    for (const raw of role.keywords || []) {
      const keyword = String(raw).trim();
      const normalized = normalize(keyword);
      if (!keyword || seen.has(normalized)) continue;
      seen.add(normalized);
      const found = usableClauses.find(clause => findTerm(clause.text, keyword) >= 0);
      if (!found) continue;
      const index = found.start + findTerm(found.text, keyword);
      const weight = weightFor(found.text);
      score += weight;
      evidence.push({ keyword, quote:excerpt(content, index, keyword.length), weight });
    }
    return { roleId:role.id, roleName:role.name, evidence, count:evidence.length, score:Math.round(score * 100) / 100 };
  }).sort((a, b) => b.score - a.score || b.count - a.count);
  const top = matches[0];
  const second = matches[1];
  const insufficient = !top || top.count < 2 || top.score < 1.5;
  const ambiguous = second && top.score - second.score < 0.5;
  const undecided = undecidedPattern.test(content);
  const needsReview = insufficient || ambiguous || undecided;
  return {
    suggestion:needsReview ? null : top.roleId,
    label:needsReview ? '待人工复核' : top.roleName,
    reason:undecided ? '文本表明目标岗位尚未确定' : !top || top.count === 0 ? '未找到可用于建议的实践证据' : insufficient ? '证据不足：需要至少两项岗位线索' : ambiguous ? '多个岗位的有效证据接近' : '找到多项岗位相关的实践证据',
    matches,
    evidence:top?.evidence || [],
    needsReview,
  };
}

export function evaluateSamples(samples, roles = DEFAULT_ROLES) {
  const rows = samples.filter(item => Object.hasOwn(item, 'expected'));
  const correct = rows.filter(item => classifyResume(item.text, roles).suggestion === item.expected).length;
  const expectedReview = rows.filter(item => item.expected === null);
  const reviewCorrect = expectedReview.filter(item => classifyResume(item.text, roles).needsReview).length;
  return { total:rows.length, correct, accuracy:rows.length ? correct / rows.length : 0, reviewTotal:expectedReview.length, reviewCorrect };
}
