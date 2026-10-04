import { DEFAULT_ROLES, classifyResume } from './classifier.mjs';
import { DEMO_RESUMES } from './demo-data.mjs';
import { BENCHMARK_CASES } from './benchmark-data.mjs';
import { evaluateBenchmark } from './benchmark.mjs';
import { runOfflineWorkflow } from './workflow.mjs';

const $ = id => document.getElementById(id);
const roleName = id => state.roles.find(role => role.id === id)?.name || '待定';
const cloneRoles = () => DEFAULT_ROLES.map(role => ({ ...role, keywords:[...role.keywords] }));
const makeSamples = () => DEMO_RESUMES.map(item => ({ ...item, source:'虚构样本', reviewed:false, reviewedRole:null, reviewNote:'' }));
const state = { roles:cloneRoles(), resumes:makeSamples(), activeView:'overview', selectedId:null };
let toastTimer;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}
function analysis(item) { return classifyResume(item.text, state.roles); }
function statusOf(item) { return item.reviewed ? 'approved' : analysis(item).needsReview ? 'review' : 'suggested'; }
function statusLabel(item) { return item.reviewed ? '人工已确认' : analysis(item).needsReview ? '待人工复核' : '有分类建议'; }
function categoryLabel(item) { return item.reviewed ? roleName(item.reviewedRole) : analysis(item).label; }
function setView(view) {
  if (!$(`view-${view}`)) return;
  state.activeView = view;
  if (window.location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  const names = { overview:'总览',queue:'简历队列',rules:'岗位规则',evaluation:'离线评测',workflow:'Agent 回放',privacy:'数据与边界' };
  const titles = { overview:'招聘审核总览',queue:'简历队列',rules:'岗位规则',evaluation:'离线样本评测',workflow:'离线 Agent 工作流',privacy:'数据与使用边界' };
  document.querySelectorAll('.view').forEach(node => node.classList.toggle('hidden', node.id !== `view-${view}`));
  document.querySelectorAll('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.view === view));
  $('crumb').textContent = names[view]; $('page-title').textContent = titles[view];
  if (view === 'rules') renderRules();
  if (view === 'evaluation') renderEvaluation();
  if (view === 'workflow') renderWorkflow();
  if (view === 'queue') renderQueue();
  window.scrollTo({ top:0, behavior:'instant' });
}

function renderOverview() {
  $('nav-count').textContent = state.resumes.length;
  $('metric-total').textContent = state.resumes.length;
  $('metric-review').textContent = state.resumes.filter(item => statusOf(item) === 'review').length;
  $('metric-suggested').textContent = state.resumes.filter(item => statusOf(item) === 'suggested').length;
  $('metric-approved').textContent = state.resumes.filter(item => item.reviewed).length;
  const counts = Object.fromEntries(state.roles.map(role => [role.id, 0]));
  for (const item of state.resumes) {
    const id = item.reviewed ? item.reviewedRole : analysis(item).suggestion;
    if (id && Object.hasOwn(counts, id)) counts[id]++;
  }
  const maximum = Math.max(1, ...Object.values(counts));
  const bars = $('distribution-bars'); bars.replaceChildren();
  for (const role of state.roles) {
    const row = el('div', undefined, 'dist-row');
    row.append(el('span', role.name));
    const track = el('div', undefined, 'bar-track');
    const fill = el('div', undefined, 'bar-fill'); fill.style.width = `${Math.round(counts[role.id] / maximum * 100)}%`;
    track.append(fill); row.append(track, el('strong', String(counts[role.id]))); bars.append(row);
  }
  const preview = $('review-preview'); preview.replaceChildren();
  const waiting = state.resumes.filter(item => statusOf(item) === 'review').slice(0, 4);
  if (!waiting.length) preview.append(el('p', '当前没有待复核简历。', 'panel-note'));
  for (const item of waiting) {
    const row = el('div', undefined, 'review-entry');
    row.append(el('div', item.name.slice(0, 1), 'avatar'));
    const main = el('div', undefined, 'review-entry-main'); main.append(el('strong', item.name), el('span', analysis(item).reason));
    const button = el('button', '查看'); button.type = 'button'; button.addEventListener('click', () => openDetail(item.id));
    row.append(main, button); preview.append(row);
  }
}

function filteredResumes() {
  const search = $('queue-search').value.trim().toLocaleLowerCase();
  const filter = $('queue-filter').value;
  return state.resumes.filter(item => {
    const searchMatch = !search || `${item.id} ${item.name} ${item.text}`.toLocaleLowerCase().includes(search);
    return searchMatch && (filter === 'all' || statusOf(item) === filter);
  });
}
function renderQueue() {
  const body = $('queue-body'); body.replaceChildren();
  const rows = filteredResumes(); $('queue-empty').classList.toggle('hidden', rows.length > 0);
  for (const item of rows) {
    const result = analysis(item);
    const tr = el('tr');
    const nameCell = el('td'); nameCell.append(el('strong', item.name), el('span', item.id, 'muted'));
    tr.append(nameCell, el('td', item.source));
    const category = el('td'); category.append(el('strong', categoryLabel(item)));
    if (item.reviewed) category.append(el('span', '人工结果', 'muted'));
    tr.append(category, el('td', `${result.evidence.length} 处`));
    const status = el('td'); status.append(el('span', statusLabel(item), `status ${statusOf(item)}`)); tr.append(status);
    const action = el('td'); const button = el('button', '查看详情', 'row-open'); button.type='button'; button.addEventListener('click', () => openDetail(item.id)); action.append(button); tr.append(action);
    body.append(tr);
  }
}

function openDetail(id) {
  const item = state.resumes.find(candidate => candidate.id === id); if (!item) return;
  state.selectedId = id;
  const result = analysis(item); const content = $('detail-content'); content.replaceChildren();
  $('detail-title').textContent = item.name;
  const body = el('div', undefined, 'detail-body');
  const summary = el('div', undefined, 'detail-summary');
  for (const value of [item.id, item.source, `建议：${result.label}`, statusLabel(item)]) summary.append(el('span', value));
  body.append(summary);
  const evidenceSection = el('section', undefined, 'detail-section'); evidenceSection.append(el('h3', '分类依据'));
  evidenceSection.append(el('p', result.reason + '。下列引文直接截取自当前简历文本。'));
  const groups = result.matches.filter(match => match.count > 0).slice(0, 3);
  if (!groups.length) evidenceSection.append(el('p', '没有找到岗位关键词。'));
  for (const match of groups) {
    const group = el('div', undefined, 'evidence-group'); group.append(el('strong', `${match.roleName} · ${match.count} 个关键词`));
    for (const hit of match.evidence) { const quote = el('div', undefined, 'evidence'); quote.append(el('em', `${hit.keyword}：`), document.createTextNode(hit.quote)); group.append(quote); }
    evidenceSection.append(group);
  }
  body.append(evidenceSection);
  const textSection = el('section', undefined, 'detail-section'); textSection.append(el('h3', '原始提取文本'), el('p', '请与原文件核对；文本解析可能丢失排版和图片内容。'), el('div', item.text, 'resume-text')); body.append(textSection);
  const reviewSection = el('section', undefined, 'detail-section'); reviewSection.append(el('h3', '人工复核'));
  const controls = el('div', undefined, 'review-controls');
  const categoryLabelEl = el('label', '人工归档类别');
  const select = el('select'); select.setAttribute('aria-label', '人工归档类别');
  const placeholder = el('option', '请选择'); placeholder.value = ''; select.append(placeholder);
  for (const role of state.roles) { const option = el('option', role.name); option.value = role.id; select.append(option); }
  const pending = el('option', '仍待进一步确认'); pending.value = 'undetermined'; select.append(pending);
  select.value = item.reviewed ? item.reviewedRole : (result.suggestion || '');
  categoryLabelEl.append(select);
  const noteLabel = el('label', '复核说明'); const note = el('textarea'); note.placeholder = '记录依据或需要补充的信息'; note.maxLength = 500; note.value = item.reviewNote; noteLabel.append(note);
  controls.append(categoryLabelEl, noteLabel); reviewSection.append(controls);
  const actions = el('div', undefined, 'review-actions'); const save = el('button', item.reviewed ? '更新人工结果' : '确认人工结果', 'primary-button'); save.type='button';
  save.addEventListener('click', () => {
    if (!select.value) { notify('请先选择归档类别或“仍待进一步确认”。'); select.focus(); return; }
    if ((select.value !== result.suggestion || select.value === 'undetermined') && !note.value.trim()) { notify('修改规则建议或暂缓归档时，请填写复核说明。'); note.focus(); return; }
    item.reviewed=true; item.reviewedRole=select.value; item.reviewNote=note.value.trim();
    renderAll(); $('detail-dialog').close(); notify('人工复核结果已记录在当前会话。');
  });
  actions.append(save); reviewSection.append(actions); body.append(reviewSection); content.append(body);
  $('detail-dialog').showModal();
}

function renderRules() {
  const grid = $('rules-grid'); grid.replaceChildren();
  for (const role of state.roles) {
    const card = el('div', undefined, 'rule-card'); card.append(el('h3', role.name), el('p', '关键词用逗号分隔；建议至少保留两项。'));
    const input = el('textarea'); input.value = role.keywords.join('，'); input.dataset.role = role.id; input.setAttribute('aria-label', `${role.name}关键词`); card.append(input); grid.append(card);
  }
}
function saveRules() {
  const next = state.roles.map(role => {
    const value = document.querySelector(`textarea[data-role="${role.id}"]`).value;
    const keywords = [...new Set(value.split(/[,，\n;；]/).map(term => term.trim()).filter(Boolean))];
    return { ...role, keywords };
  });
  if (next.some(role => role.keywords.length < 2)) { notify('每个岗位类别至少保留两个关键词。'); return; }
  state.roles = next; renderAll(); renderRules(); notify('岗位规则已更新，归档建议已重新计算。');
}
function renderEvaluation() {
  const result = evaluateBenchmark(BENCHMARK_CASES, state.roles);
  const percent = value => `${Math.round(value * 1000) / 10}%`;
  const label = id => id === 'review' ? '待复核' : roleName(id);
  $('eval-accuracy').textContent = percent(result.exactAccuracy);
  $('eval-count').textContent = `${result.correct} / ${result.total} 份与预设标签一致`;
  $('eval-coverage').textContent = percent(result.autoCoverage);
  $('eval-auto-accuracy').textContent = percent(result.autoAccuracy);
  $('eval-review').textContent = percent(result.reviewRecall);
  $('eval-summary').textContent = `岗位宏平均 F1：${percent(result.macroF1)} · 复核精确率：${percent(result.reviewPrecision)}。覆盖率与自动建议正确率应一起看，避免只通过“多交给人工”提高正确率。`;

  const roleBody = $('eval-role-body'); roleBody.replaceChildren();
  for (const role of result.roleMetrics) {
    const row = el('tr');
    for (const value of [role.name, role.support, percent(role.precision), percent(role.recall), percent(role.f1)]) row.append(el('td', value));
    roleBody.append(row);
  }

  const matrixHead = $('eval-confusion-head'); matrixHead.replaceChildren();
  const corner = el('th', '预设 \\ 建议'); corner.scope = 'col'; matrixHead.append(corner);
  for (const id of result.labels) { const th = el('th', label(id)); th.scope = 'col'; matrixHead.append(th); }
  const matrixBody = $('eval-confusion-body'); matrixBody.replaceChildren();
  for (const expected of result.labels) {
    const row = el('tr'); const th = el('th', label(expected)); th.scope = 'row'; row.append(th);
    for (const predicted of result.labels) {
      const count = result.confusion[expected][predicted];
      row.append(el('td', count, expected === predicted ? 'matrix-diagonal' : count ? 'matrix-error' : ''));
    }
    matrixBody.append(row);
  }

  const box = $('eval-rows'); box.replaceChildren();
  const errors = result.rows.filter(row => !row.correct);
  $('eval-error-count').textContent = `${errors.length} / ${result.total} 条需分析`;
  if (!errors.length) box.append(el('p', '当前规则没有与预设标签不一致的案例。', 'panel-note'));
  for (const row of errors) {
    const item = BENCHMARK_CASES.find(candidate => candidate.id === row.id);
    const card = el('div', undefined, 'benchmark-error');
    const head = el('div', undefined, 'benchmark-error-head');
    head.append(el('strong', `${row.id} · ${row.scenario}`), el('span', `预设 ${label(row.expected)} → 建议 ${label(row.predicted)}`, 'incorrect'));
    card.append(head, el('p', item.text), el('small', `规则原因：${row.reason}`));
    box.append(card);
  }
}
const workflowToolNames = {
  read_text:'读取文本', propose_category:'生成岗位建议', verify_evidence:'核验证据', route_human_review:'交给人工复核',
};
function renderWorkflow() {
  const select = $('workflow-case');
  if (!select.options.length) {
    for (const item of BENCHMARK_CASES) {
      const option = el('option', `${item.id} · ${item.scenario}`); option.value = item.id; select.append(option);
    }
  }
  const item = BENCHMARK_CASES.find(candidate => candidate.id === select.value) || BENCHMARK_CASES[0];
  if (!item) return;
  $('workflow-text').textContent = item.text;
  // The expected label stays in the UI; it is deliberately omitted from input.
  const run = runOfflineWorkflow({ id:item.id, text:item.text }, state.roles);
  const label = id => id ? roleName(id) : '待复核';
  const result = $('workflow-result'); result.replaceChildren();
  const fields = [
    ['预设标签', label(item.expected)], ['工作流建议', label(run.final.suggestion)],
    ['模拟复核级别', run.final.priority], ['是否需要人工确认', run.final.requiresHumanConfirmation ? '需要' : '不需要'],
  ];
  for (const [title, value] of fields) { const field = el('div'); field.append(el('span', title), el('strong', value)); result.append(field); }
  const agrees = run.final.suggestion === item.expected;
  result.append(el('p', agrees ? '与预设标签一致' : '与预设标签不一致：请查看轨迹中的规则局限', `workflow-comparison ${agrees ? 'agrees' : 'differs'}`));
  result.append(el('p', run.final.reason, 'workflow-reason'));
  $('workflow-step-count').textContent = `${run.trace.length} 次工具调用`;
  const timeline = $('workflow-trace'); timeline.replaceChildren();
  for (const step of run.trace) {
    const card = el('article', undefined, 'workflow-step');
    const marker = el('span', String(step.step).padStart(2, '0'), 'workflow-number');
    const content = el('div', undefined, 'workflow-step-main');
    const top = el('div', undefined, 'workflow-step-top');
    top.append(el('strong', workflowToolNames[step.tool] || step.tool), el('code', step.tool));
    const status = el('span', step.status === 'ok' ? '完成' : step.status === 'skipped' ? '跳过' : '需处理', `workflow-status ${step.status}`);
    top.append(status); content.append(top, el('p', step.summary));
    const details = el('details'); details.append(el('summary', '查看输入与输出'));
    details.append(el('pre', JSON.stringify({ input:step.input, output:step.output }, null, 2)));
    content.append(details); card.append(marker, content); timeline.append(card);
  }
}
function renderAll() { renderOverview(); renderQueue(); renderEvaluation(); if (state.activeView === 'workflow') renderWorkflow(); }

async function readFile(file) {
  if (file.size > 5_000_000) throw new Error(`${file.name} 超过 5 MB。`);
  const suffix = file.name.split('.').pop()?.toLocaleLowerCase();
  if (suffix === 'txt' || suffix === 'md') return file.text();
  if (suffix === 'pdf') {
    const pdfjs = await import('./vendor/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
    const pdf = await pdfjs.getDocument({ data:new Uint8Array(await file.arrayBuffer()), useSystemFonts:true }).promise;
    if (pdf.numPages > 20) throw new Error(`${file.name} 超过 20 页，暂不处理。`);
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const data = await page.getTextContent();
      pages.push(data.items.map(item => item.str || '').join(' '));
    }
    return pages.join('\n');
  }
  throw new Error(`${file.name} 的文件格式不受支持。`);
}
async function importFiles(files) {
  let imported = 0; const errors = [];
  for (const file of [...files]) {
    try {
      const text = (await readFile(file)).trim();
      if (text.length < 30) throw new Error(`${file.name} 没有足够的可提取文本；扫描件请先 OCR。`);
      const id = `local-${crypto.randomUUID().slice(0, 8)}`;
      state.resumes.unshift({ id, name:file.name, text:text.slice(0, 150_000), source:'本地导入', reviewed:false, reviewedRole:null, reviewNote:'' });
      imported++;
    } catch (error) { errors.push(error.message || `${file.name} 导入失败。`); }
  }
  renderAll(); setView('queue');
  notify(`${imported} 份简历已导入当前会话。${errors.length ? ` ${errors.length} 份失败：${errors[0]}` : ''}`);
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function exportCsv() {
  const header = ['编号','显示名称','来源','规则建议','人工结果','状态','证据关键词','复核说明'];
  const rows = state.resumes.map(item => {
    const result = analysis(item);
    return [item.id,item.name,item.source,result.label,item.reviewed ? roleName(item.reviewedRole) : '',statusLabel(item),result.evidence.map(hit => hit.keyword).join('、'),item.reviewNote];
  });
  const csv = '\ufeff' + [header,...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  const a = el('a'); a.href=url; a.download='resume-review-records.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('已导出当前会话的分类与复核记录（不含简历正文）。');
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => setView(button.dataset.go)));
$('top-import').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => { if (event.target.files?.length) importFiles(event.target.files); event.target.value=''; });
const zone = $('upload-zone'); zone.addEventListener('click', () => $('file-input').click());
zone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('file-input').click(); } });
zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('dragover'); });
zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('dragover'); if (event.dataTransfer.files.length) importFiles(event.dataTransfer.files); });
$('queue-search').addEventListener('input', renderQueue);
$('queue-filter').addEventListener('change', renderQueue);
$('save-rules').addEventListener('click', saveRules);
$('reset-rules').addEventListener('click', () => { state.roles=cloneRoles(); renderAll(); renderRules(); notify('已恢复示例岗位规则。'); });
$('export-csv').addEventListener('click', exportCsv);
$('workflow-case').addEventListener('change', renderWorkflow);
$('run-workflow').addEventListener('click', renderWorkflow);
$('reset-session').addEventListener('click', () => { state.roles=cloneRoles(); state.resumes=makeSamples(); $('queue-search').value=''; $('queue-filter').value='all'; renderAll(); setView('overview'); notify('已重置为虚构演示样本。'); });
$('close-dialog').addEventListener('click', () => $('detail-dialog').close());
renderAll();
window.addEventListener('hashchange', () => setView(window.location.hash.slice(1) || 'overview'));
setView(window.location.hash.slice(1) || 'overview');

// Optional browser WebMCP bridge: exposes the existing review journey without
// reading full resume text or making an automated hiring decision.
const modelContext = document.modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {
      name:'list_review_queue', title:'列出待复核简历',
      description:'列出当前浏览器会话中待人工复核的简历编号和原因，不返回简历正文。',
      inputSchema:{ type:'object', properties:{}, additionalProperties:false },
      annotations:{ readOnlyHint:true, untrustedContentHint:false },
      execute() { return { items:state.resumes.filter(item => statusOf(item) === 'review').map(item => ({ id:item.id, reason:analysis(item).reason })) }; },
    },
    {
      name:'open_review_record', title:'打开简历复核记录',
      description:'在页面中打开指定简历的人工复核详情；不会确认分类或淘汰候选人。',
      inputSchema:{ type:'object', properties:{ id:{ type:'string' } }, required:['id'], additionalProperties:false },
      annotations:{ readOnlyHint:false, untrustedContentHint:false },
      execute(input) {
        if (!input || typeof input.id !== 'string') throw new Error('需要有效的简历编号。');
        if (!state.resumes.some(item => item.id === input.id)) throw new Error('简历编号不存在。');
        setView('queue'); openDetail(input.id);
        return { id:input.id, opened:true };
      },
    },
  ];
  for (const tool of tools) {
    try { Promise.resolve(modelContext.registerTool(tool, { signal:lifecycle.signal })).catch(() => {}); } catch { /* Unsupported browser implementation. */ }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once:true });
}
