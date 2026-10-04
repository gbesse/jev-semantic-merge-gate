import { appendFileSync } from 'node:fs';
import { run } from './cli.js';

function command(kind, finding) {
  const title = finding.title.replace(/[\r\n]/g, ' ');
  const message = `${finding.ruleId} (${Math.round(finding.probability * 100)}%): ${title}`.replace(/[\r\n]/g, ' ');
  console.log(`::${kind} file=${finding.file},line=${finding.line},title=${title}::${message}`);
}

try {
  process.env.TYPESAFE_API_KEY = process.env['INPUT_TYPESAFE-API-KEY'];
  const result = await run({ policyPath: process.env.INPUT_POLICY ?? '.jev/policy.json', base: process.env.INPUT_BASE ?? 'origin/main', threshold: Number(process.env.INPUT_THRESHOLD ?? 0.75) });
  for (const finding of result.findings) command(finding.severity === 'failure' ? 'error' : 'warning', finding);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `conclusion=${result.conclusion}\nfindings=${result.findings.length}\n`);
  if (result.conclusion === 'failure') process.exitCode = 1;
} catch (error) {
  console.log(`::error title=Jev Semantic Merge Gate::${error.message.replace(/[\r\n]/g, ' ')}`);
  process.exitCode = 1;
}
