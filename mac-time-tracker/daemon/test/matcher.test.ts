import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContext, clientFromProjectRoots, evaluateRules, learnKeys, matchBlock } from '../src/matcher.ts';
import type { ActivityBlock } from '../src/types.ts';
import { catalog, config, rules } from './fixtures.ts';

function block(overrides: Partial<ActivityBlock>): ActivityBlock {
  return {
    id: 'b1', start: 0, end: 60_000, activeMs: 60_000,
    app: 'Adobe Photoshop', bundleId: 'com.adobe.Photoshop',
    titles: [], paths: [], urls: [], samples: 12,
    ...overrides,
  };
}

const ctx = () => buildContext(config(), rules, catalog());

describe('rule evaluation', () => {
  it('requires every declared clause to match', () => {
    const twoClause = [{
      name: 'both', weight: 50,
      when: { bundleId: 'com.figma.Desktop', titleRegex: 'SAPN' },
      then: { folder: 'SAPN' },
    }];
    const wrongApp = block({ bundleId: 'com.adobe.Photoshop', titles: ['SAPN thing'] });
    const bothMatch = block({ bundleId: 'com.figma.Desktop', titles: ['SAPN thing'] });
    assert.equal(evaluateRules(wrongApp, twoClause).length, 0);
    assert.equal(evaluateRules(bothMatch, twoClause).length, 1);
  });

  it('never fires a rule whose when clause is empty', () => {
    const empty = [{ name: 'empty', weight: 99, when: {}, then: { folder: 'SAPN' } }];
    assert.equal(evaluateRules(block({}), empty).length, 0);
  });

  it('survives an invalid regex without throwing', () => {
    const broken = [{ name: 'bad', weight: 50, when: { titleRegex: '([unclosed' }, then: {} }];
    assert.doesNotThrow(() => evaluateRules(block({ titles: ['anything'] }), broken));
  });
});

describe('matchBlock', () => {
  it('takes the task id straight from an open ClickUp tab', () => {
    const result = matchBlock(
      block({
        bundleId: 'com.google.Chrome', app: 'Google Chrome',
        urls: ['https://app.clickup.com/t/9003163669/86bbb0001'],
      }),
      ctx(),
    );
    assert.equal(result.taskId, '86bbb0001');
    assert.equal(result.taskName, 'AirSense 11 launch social assets');
    assert.ok(result.confidence > 0.9, `expected high confidence, got ${result.confidence}`);
  });

  it('reads the client from the server path and picks the matching task', () => {
    const result = matchBlock(
      block({ paths: ['/Volumes/Projects/Clients/SAPN/2026/Artwork/SAPN_PowerlineSafety_Poster_A2_v3.psd'] }),
      ctx(),
    );
    assert.equal(result.folderName, 'SAPN');
    assert.equal(result.taskId, '86aaa0001');
    assert.ok(result.confidence > 0.7, `expected high confidence, got ${result.confidence}`);
    assert.ok(result.reasons.some((r) => r.includes('SAPN')));
  });

  it('finds the client from a folder name even outside a configured root', () => {
    const result = matchBlock(
      block({ paths: ['/Users/dom/Desktop/Maptek/drilling explainer storyboard.aep'] }),
      ctx(),
    );
    assert.equal(result.folderName, 'Maptek');
    assert.equal(result.taskId, '86ccc0001');
  });

  it('does not leak one client into another client folder', () => {
    const result = matchBlock(
      block({ paths: ['/Volumes/Projects/Clients/Resmed/2026/brochure_refresh.indd'] }),
      ctx(),
    );
    assert.equal(result.folderName, 'Resmed');
    assert.notEqual(result.listId, 'l-sapn');
  });

  it('returns nothing for activity covered by an ignore rule', () => {
    const result = matchBlock(block({ app: '1Password', bundleId: 'com.1password.1password' }), ctx());
    assert.equal(result.taskId, null);
    assert.ok(result.reasons[0]?.includes('ignored'));
  });

  it('marks work in a non-billable space as non-billable', () => {
    const nonBillableRule = [{
      name: 'admin', weight: 40,
      when: { bundleId: 'com.apple.mail' },
      then: { space: 'MBD Non billable' },
      billable: false,
    }];
    const result = matchBlock(
      block({ bundleId: 'com.apple.mail', app: 'Mail', titles: ['Internal admin and email'] }),
      buildContext(config(), nonBillableRule, catalog()),
    );
    assert.equal(result.billable, false);
    assert.equal(result.taskId, '86ddd0001');
  });

  it('reports low confidence when it has nothing to go on', () => {
    const result = matchBlock(block({ bundleId: 'com.apple.Terminal', app: 'Terminal' }), ctx());
    assert.equal(result.taskId, null);
    assert.equal(result.confidence, 0);
  });

  it('lists runner-up tasks so the UI can offer them', () => {
    const result = matchBlock(
      block({ paths: ['/Volumes/Projects/Clients/SAPN/2026/notes.txt'] }),
      ctx(),
    );
    assert.ok(result.alternatives.length > 0);
  });

  it('applies a remembered correction to a new file in the same folder', () => {
    const corrections = [
      { key: 'dir:/Volumes/Projects/Clients/SAPN/2026/EDM', taskId: '86aaa0002', ts: Date.now() },
    ];
    const withoutMemory = matchBlock(
      block({ paths: ['/Volumes/Projects/Clients/SAPN/2026/EDM/header.png'] }),
      ctx(),
    );
    const withMemory = matchBlock(
      block({ paths: ['/Volumes/Projects/Clients/SAPN/2026/EDM/header.png'] }),
      buildContext(config(), rules, catalog(), corrections),
    );
    assert.equal(withMemory.taskId, '86aaa0002');
    assert.ok(withMemory.confidence > withoutMemory.confidence);
  });
});

describe('path helpers', () => {
  it('extracts the client segment relative to a project root', () => {
    const cfg = config();
    assert.equal(
      clientFromProjectRoots('/Volumes/Projects/Clients/Maptek/2026/file.ai', cfg),
      'Maptek',
    );
    assert.equal(clientFromProjectRoots('/Users/dom/somewhere/else.ai', cfg), null);
  });

  it('does not treat a sibling directory as being inside the root', () => {
    const cfg = config({ projectRoots: [{ path: '/Volumes/Projects/Clients', clientSegment: 0 }] });
    assert.equal(clientFromProjectRoots('/Volumes/Projects/ClientsArchive/SAPN/x.ai', cfg), null);
  });

  it('derives folder-level learning keys', () => {
    const keys = learnKeys({
      paths: ['/Volumes/Projects/Clients/SAPN/2026/EDM/header.png'],
      urls: [],
      bundleId: 'com.adobe.Photoshop',
    });
    assert.ok(keys.includes('dir:/Volumes/Projects/Clients/SAPN/2026/EDM'));
    assert.ok(keys.includes('pdir:/Volumes/Projects/Clients/SAPN/2026'));
  });
});
