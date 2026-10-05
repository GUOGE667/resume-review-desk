import { DEFAULT_ROLES, classifyResume } from './classifier.mjs';
import { DEMO_RESUMES } from './demo-data.mjs';
import { BENCHMARK_CASES } from './benchmark-data.mjs';
import { evaluateBenchmark } from './benchmark.mjs';
import { DEFAULT_ROLES as BASELINE_ROLES, classifyResume as classifyBaseline } from './baseline-classifier.mjs';
import { runOfflineWorkflow } from './workflow.mjs';
import { auditExportRows, createReviewEntry, latestReview } from './review-audit.mjs';
import { clearSnapshot, loadSnapshot, saveSnapshot } from './local-save.mjs';

const $ = id => document.getElementById(id);
const roleName = id => state.roles.find(role => role.id === id)?.name || '待定';
const cloneRoles = () => DEFAULT_ROLES.map(role => ({ ...role, keywords:[...role.keywords] }));
const makeSamples = () => DEMO_RESUMES.map(item => ({ ...item, source:'虚构样本', reviewHistory:[] }));
const restored = loadSnapshot(window.localStorage);
const state = { roles:restored?.roles || cloneRoles(), ruleVersion:restored?.ruleVersion || 1, resumes:restored?.resumes || makeSamples(), activeView:'overview', selectedId:null, localSaveEnabled:!!restored };
let toastTimer;

function updateStorageUi() {
  $('local-save-status').textContent = state.localSaveEnabled
    ? `本机保存已开启：${state.resumes.length} 份记录。刷新页面后会从此浏览器恢复。`
    : '本机保存未开启：刷新页面后导入文件与复核记录会消失。';
  $('enable-local-save').disabled = state.localSaveEnabled;
  $('enable-local-save').textContent = state.localSaveEnabled ? '已开启本机保存' : '开启本机保存（含简历正文）';
}

function persistIfEnabled() {
  if (!state.localSaveEnabled) return '';
  let errorMessage = '';
  try { saveSnapshot(window.localStorage, state); }
  catch (error) {
    state.localSaveEnabled = false;
    try { clearSnapshot(window.localStorage); } catch { /* Storage may be blocked. */ }
    errorMessage = error.message || '本机保存失败；当前数据只保留在页面内。';
  }
  updateStorageUi();
  return errorMessage;
}

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
function decisionLabel(id) { return id === 'undetermined' ? '仍待进一步确认' : id ? roleName(id) : '无岗位建议'; }
function confirmedReview(item) { const review = latestReview(item); return review && review.confirmedRole !== 'undetermined' ? review : null; }
function statusOf(item) { if (confirmedReview(item)) return 'approved'; return latestReview(item)?.confirmedRole === 'undetermined' || analysis(item).needsReview ? 'review' : 'suggested'; }
function statusLabel(item) { return confirmedReview(item) ? '人工已确认' : latestReview(item)?.confirmedRole === 'undetermined' ? '待进一步确认' : analysis(item).needsReview ? '待人工复核' : '有分类建议'; }
function categoryLabel(item) { const review = latestReview(item); return review ? decisionLabel(review.confirmedRole) : analysis(item).label; }
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
  $('metric-approved').textContent = state.resumes.filter(item => confirmedReview(item)).length;
  const counts = Object.fromEntries(state.roles.map(role => [role.id, 0]));
  for (const item of state.resumes) {
    const id = confirmedReview(item)?.confirmedRole || (!latestReview(item) ? analysis(item).suggestion : null);
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
    if (latestReview(item)) category.append(el('span', `人工记录 · ${item.reviewHistory.length} 次`, 'muted'));
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
  for (const value of [item.id, item.source, `当前规则 v${state.ruleVersion}`, `建议：${result.label}`, statusLabel(item)]) summary.append(el('span', value));
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
  const previous = latestReview(item);
  select.value = previous ? previous.confirmedRole : (result.suggestion || '');
  categoryLabelEl.append(select);
  const noteLabel = el('label', '本次复核理由（必填）'); const note = el('textarea'); note.placeholder = '说明核对依据、修改原因或仍需补充的信息'; note.maxLength = 500; noteLabel.append(note);
  controls.append(categoryLabelEl, noteLabel); reviewSection.append(controls);
  const actions = el('div', undefined, 'review-actions'); const save = el('button', previous ? '新增复核记录' : '确认人工结果', 'primary-button'); save.type='button';
  save.addEventListener('click', () => {
    if (!select.value) { notify('请先选择归档类别或“仍待进一步确认”。'); select.focus(); return; }
    if (!note.value.trim()) { notify('请填写本次复核理由。'); note.focus(); return; }
    const entry = createReviewEntry({ item, suggestion:result.suggestion, confirmedRole:select.value, reason:note.value, ruleVersion:state.ruleVersion, roles:state.roles });
    item.reviewHistory.push(entry);
    const storageError = persistIfEnabled();
    renderAll(); $('detail-dialog').close(); notify(storageError || (state.localSaveEnabled ? '人工复核结果已保存在此浏览器。' : '人工复核结果已记录在当前会话。'));
  });
  actions.append(save); reviewSection.append(actions); body.append(reviewSection);
  const historySection = el('section', undefined, 'detail-section review-history');
  historySection.append(el('h3', `复核历史 · ${item.reviewHistory.length} 次`));
  if (!item.reviewHistory.length) historySection.append(el('p', '当前会话尚无人工复核记录。'));
  for (const entry of [...item.reviewHistory].reverse()) {
    const card = el('article', undefined, 'review-history-card');
    card.append(el('strong', `第 ${entry.sequence} 次 · ${new Date(entry.timestamp).toLocaleString('zh-CN', { hour12:false })} · 规则 v${entry.ruleVersion}`));
    card.append(el('p', `规则建议：${decisionLabel(entry.suggestedRole)} · 修改前：${decisionLabel(entry.previousRole)} → 人工结果：${decisionLabel(entry.confirmedRole)}`));
    card.append(el('p', `理由：${entry.reason}`));
    const rules = el('details'); rules.append(el('summary', '查看当时的规则快照'));
    rules.append(el('pre', entry.ruleSnapshot.map(role => `${role.name}：${role.keywords.join('、')}`).join('\n')));
    card.append(rules); historySection.append(card);
  }
  body.append(historySection); content.append(body);
  $('detail-dialog').showModal();
}

function renderRules() {
  $('rule-version').textContent = `v${state.ruleVersion}`;
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
  if (JSON.stringify(next) === JSON.stringify(state.roles)) { notify('岗位规则没有变化。'); return; }
  state.roles = next; state.ruleVersion++; const storageError = persistIfEnabled(); renderAll(); renderRules(); notify(storageError || `岗位规则已更新到 v${state.ruleVersion}，归档建议已重新计算。`);
}
function renderEvaluation() {
  const result = evaluateBenchmark(BENCHMARK_CASES, state.roles);
  const baseline = evaluateBenchmark(BENCHMARK_CASES, BASELINE_ROLES, classifyBaseline);
  const percent = value => `${Math.round(value * 1000) / 10}%`;
  const label = id => id === 'review' ? '待复核' : roleName(id);
  $('eval-accuracy').textContent = percent(result.exactAccuracy);
  $('eval-count').textContent = `${result.correct} / ${result.total} 份与预设标签一致`;
  $('eval-coverage').textContent = percent(result.autoCoverage);
  $('eval-auto-accuracy').textContent = percent(result.autoAccuracy);
  $('eval-review').textContent = percent(result.reviewRecall);
  $('eval-summary').textContent = `岗位宏平均 F1：${percent(result.macroF1)} · 复核精确率：${percent(result.reviewPrecision)}。覆盖率与自动建议正确率应一起看，避免只通过“多交给人工”提高正确率。`;

  const comparison = $('eval-comparison-body'); comparison.replaceChildren();
  for (const [name, metrics] of [['原始规则基线', baseline], [state.ruleVersion === 1 ? '改进后的默认规则' : `当前自定义规则 v${state.ruleVersion}`, result]]) {
    const row = el('tr');
    for (const value of [name, `${metrics.correct} / ${metrics.total}`, `${metrics.rows.filter(item => item.predicted !== 'review').length} / ${metrics.total}`, `${metrics.rows.filter(item => item.predicted !== 'review' && item.correct).length} / ${metrics.rows.filter(item => item.predicted !== 'review').length}`, metrics.wrongAutoSuggestions, `${metrics.confusion.review.review} / ${metrics.rows.filter(item => item.expected === 'review').length}`]) row.append(el('td', String(value)));
    comparison.append(row);
  }

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
      state.resumes.unshift({ id, name:file.name, text:text.slice(0, 150_000), source:'本地导入', reviewHistory:[] });
      imported++;
    } catch (error) { errors.push(error.message || `${file.name} 导入失败。`); }
  }
  const storageError = persistIfEnabled();
  renderAll(); setView('queue');
  notify(`${imported} 份简历已导入${state.localSaveEnabled ? '并保存在此浏览器' : '当前会话'}。${errors.length ? ` ${errors.length} 份失败：${errors[0]}` : ''}${storageError ? ` 本机保存失败：${storageError}` : ''}`);
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function downloadCsv(filename, header, rows) {
  const csv = '\ufeff' + [header,...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  const a = el('a'); a.href=url; a.download=filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv() {
  const header = ['编号','显示名称','来源','当前规则版本','当前规则建议','人工结果','状态','证据关键词','最近复核规则版本','最近复核前类别','最近复核时间','最近复核理由','复核次数'];
  const rows = state.resumes.map(item => {
    const result = analysis(item);
    const review = latestReview(item);
    return [item.id,item.name,item.source,state.ruleVersion,result.label,review ? decisionLabel(review.confirmedRole) : '',statusLabel(item),result.evidence.map(hit => hit.keyword).join('、'),review?.ruleVersion || '',review ? decisionLabel(review.previousRole) : '',review?.timestamp || '',review?.reason || '',item.reviewHistory.length];
  });
  downloadCsv('resume-review-records.csv', header, rows);
  notify('已导出当前会话记录（不含简历正文）。');
}
function exportAuditCsv() {
  const header = ['编号','显示名称','来源','复核序号','复核时间 ISO','规则版本','规则建议','修改前类别','人工结果','复核理由','当时规则快照 JSON'];
  const rows = auditExportRows(state.resumes, decisionLabel);
  if (!rows.length) { notify('当前会话还没有人工复核记录。'); return; }
  downloadCsv('resume-review-audit.csv', header, rows);
  notify(`已导出 ${rows.length} 条复核日志（不含简历正文）。`);
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
$('reset-rules').addEventListener('click', () => { const next=cloneRoles(); if (JSON.stringify(next) === JSON.stringify(state.roles)) { notify('当前已是示例规则。'); return; } state.roles=next; state.ruleVersion++; const storageError=persistIfEnabled(); renderAll(); renderRules(); notify(storageError || `已恢复示例规则，当前版本 v${state.ruleVersion}。`); });
$('export-csv').addEventListener('click', exportCsv);
$('export-audit').addEventListener('click', exportAuditCsv);
$('workflow-case').addEventListener('change', renderWorkflow);
$('run-workflow').addEventListener('click', renderWorkflow);
$('enable-local-save').addEventListener('click', () => {
  try {
    saveSnapshot(window.localStorage, state);
    state.localSaveEnabled = true;
    updateStorageUi();
    notify('已开启本机保存；导入的简历正文和复核理由会留在此浏览器。');
  } catch (error) { notify(error.message || '浏览器无法保存数据，请检查存储权限或剩余空间。'); }
});
$('export-audit-privacy').addEventListener('click', exportAuditCsv);
$('export-csv-privacy').addEventListener('click', exportCsv);
$('reset-session').addEventListener('click', () => {
  try { clearSnapshot(window.localStorage); } catch { notify('本机保存数据无法清除；请检查浏览器存储权限。'); return; }
  state.localSaveEnabled=false; state.roles=cloneRoles(); state.ruleVersion=1; state.resumes=makeSamples();
  $('queue-search').value=''; $('queue-filter').value='all'; updateStorageUi(); renderAll(); setView('overview');
  notify('本机保存、导入文件和复核记录已清除，已恢复虚构演示样本。');
});
$('close-dialog').addEventListener('click', () => $('detail-dialog').close());
updateStorageUi();
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
