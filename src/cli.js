#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { buildRequest, evaluate, fakeResponse, parseUnifiedDiff, validatePolicy } from './core.js';

const sampleDiff = `diff --git a/deploy.js b/deploy.js\n--- a/deploy.js\n+++ b/deploy.js\n@@ -4,0 +5,2 @@\n+deployImmediately(); // TODO rollback\n+skipReview = true;`;
const samplePolicy = { id: 'release-safety', rules: [{ id: 'reversible', title: 'Change lacks a safe rollback', severity: 'failure', instructions: 'Does this change introduce a release path whose rollback is absent or explicitly deferred?' }] };

async function callTypeSafe(request, apiKey) {
  const response = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error(`TypeSafe request failed with HTTP ${response.status}`);
  return response.json();
}

export async function run({ fixture = false, policyPath = '.jev/policy.json', base = 'origin/main', threshold = 0.75, apiKey = process.env.TYPESAFE_API_KEY } = {}) {
  const policy = fixture ? samplePolicy : validatePolicy(JSON.parse(await readFile(policyPath, 'utf8')));
  const diff = fixture ? sampleDiff : execFileSync('git', ['diff', '--unified=0', `${base}...HEAD`], { encoding: 'utf8', maxBuffer: 5_000_000 });
  const lines = parseUnifiedDiff(diff);
  if (!lines.length) return { findings: [], conclusion: 'success' };
  const response = fixture ? fakeResponse(lines, policy) : await callTypeSafe(buildRequest(lines, policy), apiKey);
  const findings = evaluate(response, lines, policy, threshold);
  return { findings, conclusion: findings.some(f => f.severity === 'failure') ? 'failure' : 'success', model: response.model, usage: response.usage };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = await run({ fixture: process.argv.includes('--fixture'), policyPath: process.env.INPUT_POLICY, base: process.env.INPUT_BASE });
  console.log(JSON.stringify(result, null, 2));
  if (result.conclusion === 'failure' && !process.argv.includes('--report-only')) process.exitCode = 1;
}
