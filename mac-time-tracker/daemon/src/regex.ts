/**
 * Rules are written by hand in JSON, where the natural way to ask for a
 * case-insensitive match is a leading `(?i)` — a syntax JavaScript rejects
 * outright. Translate the inline prefix into real flags rather than making
 * every rule author remember the difference.
 */
const INLINE_FLAGS = /^\(\?([imsux]+)\)/;

export function compileRegex(pattern: string): RegExp | null {
  let source = pattern;
  let flags = '';

  const inline = INLINE_FLAGS.exec(source);
  if (inline?.[1]) {
    source = source.slice(inline[0].length);
    // `u` and `x` have no JavaScript equivalent here; ignore them quietly
    // rather than failing the whole rule.
    flags = [...new Set(inline[1].split(''))].filter((f) => 'ims'.includes(f)).join('');
  }

  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

/** Compile a list, dropping (and reporting) any pattern that won't parse. */
export function compileAll(patterns: string[], onError?: (pattern: string) => void): RegExp[] {
  const compiled: RegExp[] = [];
  for (const pattern of patterns) {
    const regex = compileRegex(pattern);
    if (regex) compiled.push(regex);
    else onError?.(pattern);
  }
  return compiled;
}
