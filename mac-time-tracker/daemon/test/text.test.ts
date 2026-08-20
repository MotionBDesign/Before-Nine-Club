import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIdf, normalizeName, overlapScore, pathHasSegment, tokenize } from '../src/text.ts';
import { compileRegex } from '../src/regex.ts';

describe('tokenize', () => {
  it('keeps the distinguishing parts of a job filename', () => {
    const tokens = tokenize('SAPN_2401_PowerlineSafety_Poster_A2_v3.psd');
    assert.deepEqual(tokens, ['sapn', '2401', 'powerline', 'safety', 'poster', 'a2']);
  });

  it('strips folder furniture and years from a server path', () => {
    const tokens = tokenize('/Volumes/Projects/Clients/Maptek/2026/Artwork/drilling_explainer.aep', 'path');
    assert.ok(!tokens.includes('clients'));
    assert.ok(!tokens.includes('volumes'));
    assert.ok(!tokens.includes('2026'));
    assert.ok(tokens.includes('maptek'));
    assert.ok(tokens.includes('drilling'));
  });

  it('keeps furniture words when they appear in the filename itself', () => {
    // "Assets" as a directory is noise; "assets" in a filename is the job.
    const tokens = tokenize('/Volumes/Projects/Clients/SAPN/Assets/apprentice_recruitment_assets.psd', 'path');
    assert.equal(tokens.filter((t) => t === 'assets').length, 1);
  });

  it('keeps agency phase words that name a kind of work', () => {
    // Tasks here split into "... COPY" / "... DESIGN" / "... ANIMATION"
    // siblings, so these have to survive tokenising to tell them apart.
    for (const word of ['copy', 'content', 'design', 'concepts', 'storyboard', 'animation']) {
      assert.ok(tokenize(`Aurizn GPTW posters ${word}`).includes(word), `dropped "${word}"`);
    }
  });

  it('still strips version and status noise', () => {
    const tokens = tokenize('poster_final_v3_WIP_draft.psd');
    assert.deepEqual(tokens, ['poster']);
  });

  it('splits camelCase', () => {
    assert.deepEqual(tokenize('sleepClinicBrochure'), ['sleep', 'clinic', 'brochure']);
  });
});

describe('overlapScore', () => {
  const corpus = [
    ['powerline', 'safety', 'poster', 'series'],
    ['summer', 'bushfire', 'edm'],
    ['sleep', 'clinic', 'brochure', 'refresh'],
  ];
  const idf = buildIdf(corpus);

  it('scores the right task highest', () => {
    const query = tokenize('SAPN_PowerlineSafety_Poster_A2.psd');
    const scores = corpus.map((doc) => overlapScore(query, doc, idf));
    assert.equal(scores.indexOf(Math.max(...scores)), 0);
  });

  it('prefers the more specific task over a parent whose name is a prefix', () => {
    // The real failure this guards against: "Symons - Onboarding Visitors
    // video" used to score identically to "... video - STORYBOARD" and win the
    // alphabetical tie-break, so every phase child was unreachable.
    const parent = tokenize('Symons - Onboarding Visitors video');
    const child = tokenize('Symons - Onboarding Visitors video - STORYBOARD');
    const localIdf = buildIdf([parent, child]);
    const query = tokenize('/Clients/Symons Clark/Onboarding Visitors video/Onboarding_Visitors_storyboard.ai', 'path');
    assert.ok(
      overlapScore(query, child, localIdf) > overlapScore(query, parent, localIdf),
      'the storyboard task should outscore its parent',
    );
  });

  it('is symmetric: unmatched query tokens count against the score', () => {
    const idfLocal = buildIdf([['poster'], ['poster', 'series', 'powerline', 'safety']]);
    const exact = overlapScore(['poster'], ['poster'], idfLocal);
    const partial = overlapScore(['poster', 'powerline', 'safety'], ['poster'], idfLocal);
    assert.ok(exact > partial);
  });

  it('returns zero when nothing overlaps', () => {
    assert.equal(overlapScore(['unrelated'], corpus[0]!, idf), 0);
  });

  it('handles empty input without dividing by zero', () => {
    assert.equal(overlapScore([], corpus[0]!, idf), 0);
    assert.equal(overlapScore(['powerline'], [], idf), 0);
  });
});

describe('pathHasSegment', () => {
  it('matches a whole segment regardless of punctuation and case', () => {
    assert.ok(pathHasSegment('/Volumes/Projects/Clients/Cole School Experts/x.ai', 'cole-school-experts'));
  });

  it('does not match a partial segment', () => {
    assert.ok(!pathHasSegment('/Volumes/Projects/SAPNArchive/x.ai', 'SAPN'));
  });
});

describe('normalizeName', () => {
  it('ignores spacing and punctuation differences', () => {
    assert.equal(normalizeName('Resmed - B2B2C'), normalizeName('resmed b2b2c'));
  });
});

describe('compileRegex', () => {
  it('translates a leading (?i) into a real flag', () => {
    const regex = compileRegex('(?i)resmed');
    assert.ok(regex);
    assert.ok(regex.test('ResMed brochure'));
  });

  it('supports combined inline flags', () => {
    const regex = compileRegex('(?is)a.b');
    assert.ok(regex?.test('A\nB'));
  });

  it('returns null for a pattern that will not parse', () => {
    assert.equal(compileRegex('([unclosed'), null);
  });

  it('leaves an ordinary pattern case-sensitive', () => {
    assert.equal(compileRegex('Resmed')!.test('resmed'), false);
  });

  it('keeps named capture groups working', () => {
    const match = '(?i)/clients/(?<client>[^/]+)/';
    assert.equal(compileRegex(match)!.exec('/Clients/SAPN/x.ai')?.groups?.client, 'SAPN');
  });
});
