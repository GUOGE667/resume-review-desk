import { DEFAULT_ROLES } from './classifier.mjs';
import { OFFLINE_TOOLS } from './workflow-tools.mjs';

// A deterministic, offline tool-orchestration replay. It does not call a model
// and it never makes an employment decision or confirms a candidate's category.
export function runOfflineWorkflow(record, roles = DEFAULT_ROLES) {
  const trace = [];
  const log = (tool, status, summary, input, output) => {
    trace.push({ step:trace.length + 1, tool, status, summary, input, output });
  };
  const id = String(record?.id ?? 'unknown');
  const input = { recordId:id };
  const read = OFFLINE_TOOLS.read_text({ record });

  if (!read.usable) {
    log('read_text', 'error', '可提取文本不足，无法生成可靠的岗位建议。', input, { characterCount:read.characterCount, minimum:30 });
    const final = OFFLINE_TOOLS.route_human_review({ unreadable:true });
    log('route_human_review', 'ok', '生成优先复核交接建议。', { proposedRole:null }, final);
    return { recordId:id, mode:'offline_deterministic', trace, final };
  }
  log('read_text', 'ok', '已读取当前浏览器内的文本。', input, { characterCount:read.characterCount });

  const proposal = OFFLINE_TOOLS.propose_category({ text:read.text, roles });
  const leading = proposal.matches.slice(0, 2).map(match => ({ roleId:match.roleId, evidenceCount:match.count }));
  log('propose_category', 'ok', proposal.reason, { roleCount:roles.length }, {
    suggestion:proposal.suggestion, leading, evidence:proposal.evidence.map(hit => ({ keyword:hit.keyword, quote:hit.quote })),
  });

  let verified = false;
  if (!proposal.suggestion) {
    log('verify_evidence', 'skipped', '分类器未提出类别；跳过建议证据核验。', { proposedRole:null }, { verified:false });
  } else {
    const check = OFFLINE_TOOLS.verify_evidence({ text:read.text, proposal });
    verified = check.verified;
    log('verify_evidence', verified ? 'ok' : 'error', verified ? '关键词和摘录均可在原文中核对。' : '证据核验失败。',
      { proposedRole:proposal.suggestion, evidenceCount:proposal.evidence.length }, check);
  }

  const final = OFFLINE_TOOLS.route_human_review({ proposal, verified });
  log('route_human_review', 'ok', verified ? '保留岗位建议，生成常规复核交接建议。' : '证据不足或核验失败，生成优先复核交接建议。',
    { proposedRole:proposal.suggestion, verified }, final);
  return { recordId:id, mode:'offline_deterministic', trace, final };
}
