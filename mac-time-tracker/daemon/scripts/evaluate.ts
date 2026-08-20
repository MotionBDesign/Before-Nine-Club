/**
 * Score the matcher against the real workspace.
 *
 * Each case is a plausible day of work — the app you'd be in, the file open,
 * the window title — paired with the task it should land on. Run it after any
 * change to the matcher or the tokeniser:
 *
 *   node scripts/evaluate.ts          summary
 *   node scripts/evaluate.ts -v       every case, with the reasoning
 */
import { buildContext, matchBlock } from '../src/matcher.ts';
import { realCatalog } from '../test/real-tasks.ts';
import { CASES, caseBlock, evalConfig, evalRules } from '../test/real-cases.ts';

const block = caseBlock;

const verbose = process.argv.includes('-v');
const ctx = buildContext(evalConfig, evalRules, realCatalog());
const byId = new Map(realCatalog().tasks.map((t) => [t.taskId, t.taskName]));

let correct = 0;
let wrongClient = 0;
const failures: string[] = [];

for (const c of CASES) {
  const result = matchBlock(block(c), ctx);
  let ok: boolean;
  if (c.expect === 'NONE') {
    ok = result.taskId === null;
  } else if (c.expect === 'AMBIGUOUS') {
    // Right client, but honest that it cannot pick the task.
    ok = result.folderName === 'Resmed' && result.confidence < 0.75;
  } else {
    ok = result.taskId === c.expect;
  }
  if (ok) correct++;
  else {
    const expectedTask = byId.get(c.expect);
    failures.push(
      `  ${c.label}\n` +
      `      expected: ${expectedTask ?? c.expect}\n` +
      `      got:      ${result.taskName ?? '(none)'}  [${result.folderName ?? '-'}] conf ${result.confidence.toFixed(2)}\n` +
      `      because:  ${result.reasons.join('; ') || '-'}`,
    );
    if (c.expect !== 'NONE' && c.expect !== 'AMBIGUOUS') {
      const expectedFolder = realCatalog().tasks.find((t) => t.taskId === c.expect)?.folderName;
      if (result.folderName !== expectedFolder) wrongClient++;
    }
  }
  if (verbose) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.label}`);
    console.log(`        -> ${result.taskName ?? '(none)'} (${result.confidence.toFixed(2)})`);
    for (const r of result.reasons) console.log(`           - ${r}`);
  }
}

console.log(`\n  ${correct}/${CASES.length} correct (${Math.round((correct / CASES.length) * 100)}%)`);
console.log(`  wrong client: ${wrongClient}\n`);
if (failures.length) {
  console.log('  Failures:\n');
  console.log(failures.join('\n\n'));
  console.log('');
}
process.exitCode = correct === CASES.length ? 0 : 1;
