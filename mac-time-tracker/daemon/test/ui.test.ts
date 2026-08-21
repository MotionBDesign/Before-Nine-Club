import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderPage } from '../src/ui.ts';

/**
 * The review page is authored as one enormous template literal, which means
 * TypeScript checks none of the JavaScript inside it — and worse, it *eats*
 * escape sequences on the way out. A `\'` written in the source reaches the
 * browser as a bare quote that ends the string early, and the whole page dies
 * with a syntax error that no amount of `tsc` will ever report.
 *
 * So parse what actually ships.
 */
describe('review page', () => {
  const html = renderPage();

  it('emits an inline script that actually parses', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    assert.ok(scripts.length > 0, 'the page has no inline script at all');
    for (const [index, source] of scripts.entries()) {
      assert.doesNotThrow(
        () => new Function(source),
        `inline script #${index + 1} does not parse — check for an escape the template literal swallowed`,
      );
    }
  });

  it('emits a stylesheet with balanced braces', () => {
    const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    assert.ok(styles.length > 0);
    for (const css of styles) {
      const opens = (css.match(/\{/g) ?? []).length;
      const closes = (css.match(/\}/g) ?? []).length;
      assert.equal(opens, closes, 'unbalanced braces in the stylesheet');
    }
  });

  it('offers every view the page implements', () => {
    for (const view of ['day', 'week', 'tracking', 'fleet']) {
      assert.match(html, new RegExp(`data-view="${view}"`), `no button for the ${view} view`);
      assert.match(html, new RegExp(`id="${view === 'day' ? 'dayview' : view === 'week' ? 'weekview' : view === 'tracking' ? 'trackview' : 'fleetview'}"`));
    }
  });
});
