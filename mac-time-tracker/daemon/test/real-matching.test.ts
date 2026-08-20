import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContext, matchBlock } from '../src/matcher.ts';
import { realCatalog } from './real-tasks.ts';
import { CASES, caseBlock, evalConfig, evalRules } from './real-cases.ts';

/**
 * Regression cover for matching against the live workspace.
 *
 * These started at 15/28. The gap was almost entirely the parent/child phase
 * split that dominates this workspace — "… video" vs "… video - STORYBOARD" —
 * which needed a symmetric similarity measure, an unstripped "copy"/"content"
 * vocabulary, and the app-implies-a-phase signal.
 */
describe('matching against the real workspace', () => {
  const ctx = buildContext(evalConfig, evalRules, realCatalog());
  const nameById = new Map(realCatalog().tasks.map((t) => [t.taskId, t.taskName]));

  for (const testCase of CASES) {
    it(testCase.label, () => {
      const result = matchBlock(caseBlock(testCase), ctx);

      if (testCase.expect === 'NONE') {
        assert.equal(result.taskId, null, `expected no match, got ${result.taskName}`);
        return;
      }
      if (testCase.expect === 'AMBIGUOUS') {
        assert.equal(result.folderName, 'Resmed');
        assert.ok(result.confidence < 0.75, `should not be confident, got ${result.confidence}`);
        return;
      }
      assert.equal(
        result.taskId,
        testCase.expect,
        `expected "${nameById.get(testCase.expect)}", got "${result.taskName}" (${result.confidence.toFixed(2)})`,
      );
    });
  }

  it('never picks a task from the wrong client', () => {
    for (const testCase of CASES) {
      if (testCase.expect === 'NONE' || testCase.expect === 'AMBIGUOUS') continue;
      const expected = realCatalog().tasks.find((t) => t.taskId === testCase.expect);
      const result = matchBlock(caseBlock(testCase), ctx);
      assert.equal(result.folderName, expected?.folderName, `wrong client for: ${testCase.label}`);
    }
  });

  it('explains every confident suggestion', () => {
    for (const testCase of CASES) {
      const result = matchBlock(caseBlock(testCase), ctx);
      if (result.taskId && result.confidence >= 0.45) {
        assert.ok(result.reasons.length > 0, `no reasoning given for: ${testCase.label}`);
      }
    }
  });
});
