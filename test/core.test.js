import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, evaluate, parseUnifiedDiff } from '../src/core.js';

const policy = { id: 'p', rules: [{ id: 'rollback', title: 'Rollback', severity: 'failure', instructions: 'Is rollback absent?' }] };
const diff = '--- a/a.js\n+++ b/a.js\n@@ -2,1 +2,2 @@\n-old\n+new\n+TODO rollback';

test('parses exact added-line coordinates', () => assert.deepEqual(parseUnifiedDiff(diff).map(({ file, line, text }) => ({ file, line, text })), [{ file: 'a.js', line: 2, text: 'new' }, { file: 'a.js', line: 3, text: 'TODO rollback' }]));
test('request criteria contains only changed lines', () => assert.deepEqual(Object.keys(buildRequest(parseUnifiedDiff(diff), policy).questions.rollback__evidence.criteria), ['L1', 'L2']));
test('finding cites the selected exact line', () => { const lines = parseUnifiedDiff(diff); const result = evaluate({ answers: { rollback__violated: { type: 'noul', noul: .9 }, rollback__evidence: { type: 'choice', choice: 'L2' } } }, lines, policy); assert.equal(result[0].line, 3); assert.equal(result[0].text, 'TODO rollback'); });
test('below-threshold policy is silent', () => assert.equal(evaluate({ answers: { rollback__violated: { type: 'noul', noul: .3 }, rollback__evidence: { type: 'choice', choice: 'L1' } } }, parseUnifiedDiff(diff), policy).length, 0));
