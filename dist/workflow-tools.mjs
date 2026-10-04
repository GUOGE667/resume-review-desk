import { classifyResume } from './classifier.mjs';

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase();

// These pure local tools make each orchestration boundary explicit. The caller
// records only summaries in the trace; the original text stays in memory.
export const OFFLINE_TOOLS = Object.freeze({
  read_text({ record }) {
    const text = String(record?.text ?? '').trim();
    return { text, characterCount:text.length, usable:text.length >= 30 };
  },
  propose_category({ text, roles }) {
    return classifyResume(text, roles);
  },
  verify_evidence({ text, proposal }) {
    const issues = [];
    if (proposal.evidence.length < 2) issues.push('少于两项独立关键词证据');
    for (const hit of proposal.evidence) {
      if (!normalize(text).includes(normalize(hit.keyword)) || !normalize(hit.quote).includes(normalize(hit.keyword))) {
        issues.push(`原文无法支持关键词：${hit.keyword}`);
      }
    }
    return { verified:issues.length === 0, issues };
  },
  route_human_review({ proposal, verified, unreadable = false }) {
    if (unreadable) return { suggestion:null, priority:'优先复核', requiresHumanConfirmation:true, reason:'文本不足；请人工核对文件或先进行 OCR。' };
    return {
      suggestion:verified ? proposal.suggestion : null,
      priority:verified ? '常规复核' : '优先复核',
      requiresHumanConfirmation:true,
      reason:verified ? '仅提供归档建议；招聘人员仍需确认。' : proposal.reason,
    };
  },
});
