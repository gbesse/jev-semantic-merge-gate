export const MODEL = 'jev-1.13.0';

export function parseUnifiedDiff(diff) {
  const changed = []; let file = null; let newLine = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ b/')) { file = text.slice(6); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) { newLine = Number(hunk[1]); continue; }
    if (!file || text.startsWith('---')) continue;
    if (text.startsWith('+')) { const content = text.slice(1); if (content.trim()) changed.push({ id: `L${changed.length + 1}`, file, line: newLine, text: content }); newLine += 1; }
    else if (!text.startsWith('-') && !text.startsWith('\\')) newLine += 1;
  }
  return changed;
}

export function validatePolicy(policy) {
  if (!policy?.id || !Array.isArray(policy.rules) || policy.rules.length < 1) throw new TypeError('Policy needs id and rules');
  const ids = new Set();
  for (const rule of policy.rules) {
    if (!rule?.id || ids.has(rule.id) || !rule.title || !rule.instructions) throw new TypeError('Every rule needs a unique id, title and instructions');
    if (!['warning', 'failure'].includes(rule.severity)) throw new TypeError(`${rule.id}: severity must be warning or failure`);
    ids.add(rule.id);
  }
  return policy;
}

export function buildRequest(lines, policy) {
  validatePolicy(policy);
  if (!lines.length) throw new TypeError('No changed lines to review');
  if (lines.length > 255) throw new TypeError('Review chunks must contain at most 255 changed lines');
  const criteria = Object.fromEntries(lines.map(line => [line.id, { file: line.file, line: line.line, text: line.text }]));
  return {
    model: MODEL,
    state: { changedLines: lines },
    questions: Object.fromEntries(policy.rules.flatMap(rule => [
      [`${rule.id}__violated`, { type: 'noul', instructions: `${rule.instructions} Answer from added lines only. Missing evidence may count as a violation only when this policy explicitly requires it.` }],
      [`${rule.id}__evidence`, { type: 'choice', instructions: `Which exact added line is the strongest evidence for this policy check: ${rule.instructions}`, criteria }]
    ]))
  };
}

export function evaluate(response, lines, policy, threshold = 0.75) {
  const byId = new Map(lines.map(line => [line.id, line]));
  return policy.rules.flatMap(rule => {
    const verdict = response?.answers?.[`${rule.id}__violated`];
    const evidence = response?.answers?.[`${rule.id}__evidence`];
    if (verdict?.type !== 'noul' || !Number.isFinite(verdict.noul)) throw new TypeError(`Invalid verdict for ${rule.id}`);
    if (verdict.noul < threshold) return [];
    const line = evidence?.type === 'choice' ? byId.get(evidence.choice) : null;
    if (!line) throw new TypeError(`Invalid evidence for ${rule.id}`);
    return [{ ruleId: rule.id, title: rule.title, severity: rule.severity, probability: verdict.noul, ...line }];
  });
}

export function fakeResponse(lines, policy) {
  const fallback = lines[0]?.id;
  return { model: MODEL, answers: Object.fromEntries(policy.rules.flatMap(rule => {
    const risky = lines.find(line => /TODO|irreversible|skip review/i.test(line.text));
    return [[`${rule.id}__violated`, { type: 'noul', noul: risky ? 0.92 : 0.12 }], [`${rule.id}__evidence`, { type: 'choice', choice: risky?.id ?? fallback }]];
  })), usage: { input_tokens: 40 } };
}
