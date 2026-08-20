/**
 * Tokenisation and similarity helpers shared by the matcher.
 *
 * Filenames in an agency job folder carry most of the signal — client codes,
 * job numbers, deliverable names — so the goal is to strip the noise (version
 * markers, extensions, dates) and keep the parts that distinguish one job from
 * another.
 */

/**
 * Words that carry no signal wherever they appear: file plumbing and version
 * markers. Deliberately small — see PATH_FURNITURE for the rest.
 *
 * Note what is *not* here: "copy", "content", "design", "concepts". In an
 * agency those name a phase of work, and ClickUp tasks here are routinely
 * split into "… COPY", "… DESIGN", "… ANIMATION" siblings. Stripping them
 * made every child task indistinguishable from its parent.
 */
const GENERIC = new Set([
  // file plumbing
  'psd', 'ai', 'indd', 'aep', 'prproj', 'pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'svg', 'eps',
  'mp4', 'mov', 'wav', 'mp3', 'zip', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'key', 'pages', 'numbers',
  'fig', 'sketch', 'json', 'csv', 'txt', 'md',
  // version and status noise
  'ver', 'version', 'final', 'finalfinal', 'draft', 'wip', 'new', 'old', 'backup', 'bak',
  'rev', 'revision', 'temp', 'tmp', 'untitled',
  // filler
  'the', 'and', 'for', 'with', 'from', 'of', 'to', 'in', 'on', 'at',
]);

/**
 * Directory names that describe how a job folder is organised rather than what
 * the job is. Stripped from path segments only, never from a filename or a
 * task name — "Cole - All services Prospectus brochure" must keep "services".
 */
const PATH_FURNITURE = new Set([
  'clients', 'client', 'projects', 'project', 'work', 'jobs', 'job', 'assets', 'files',
  'working', 'output', 'outputs', 'exports', 'export', 'links', 'footage', 'source', 'sources',
  'shared', 'general', 'documents', 'desktop', 'downloads', 'dropbox', 'volumes', 'users',
  'library', 'archive', 'archived', 'admin', 'misc',
]);

const MONTHS = new Set([
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october',
  'november', 'december',
]);

/** Split camelCase/PascalCase and any non-alphanumeric run into lowercase tokens. */
export function rawTokens(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

function isYear(token: string): boolean {
  return /^(19|20)\d{2}$/.test(token);
}

/**
 * Tokens worth matching on. `kind: 'path'` additionally drops directory
 * furniture; the last path segment (the filename) is treated as a name, since
 * that is where the job is usually described.
 */
export function tokenize(input: string, kind: 'name' | 'path' = 'name'): string[] {
  if (kind === 'path') return tokenizePath(input);
  return keepMeaningful(rawTokens(input), new Set());
}

function tokenizePath(input: string): string[] {
  const segments = input.split('/').filter(Boolean);
  const out: string[] = [];
  segments.forEach((segment, index) => {
    const isFilename = index === segments.length - 1;
    out.push(...keepMeaningful(rawTokens(segment), isFilename ? new Set() : PATH_FURNITURE));
  });
  return out;
}

function keepMeaningful(tokens: string[], extraStopwords: Set<string>): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (GENERIC.has(token) || MONTHS.has(token) || extraStopwords.has(token)) continue;
    if (isYear(token)) continue;
    // Single letters and bare 1-2 digit numbers are almost always version markers.
    if (token.length < 2) continue;
    if (/^\d{1,2}$/.test(token)) continue;
    // v3, r02 - version markers left over after the separator split.
    if (/^[vr]\d{1,3}$/.test(token)) continue;
    out.push(token);
  }
  return out;
}

export function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Normalised form used for name equality (folders, clients, aliases). */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Inverse document frequency across the candidate task corpus. A token that
 * appears in every task name ("retainer") tells us nothing; a token that
 * appears in one ("wayfinding") is close to decisive.
 */
export function buildIdf(documents: string[][]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const doc of documents) {
    for (const token of uniq(doc)) docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
  }
  const total = Math.max(documents.length, 1);
  const idf = new Map<string, number>();
  for (const [token, freq] of docFreq) idf.set(token, Math.log(1 + total / freq));
  return idf;
}

/**
 * Weighted similarity between the query and a task name, 0..1.
 *
 * This is a Dice coefficient over IDF weights, deliberately *symmetric*. An
 * earlier version normalised by the target alone, which meant a task whose
 * name is a prefix of another ("… video") always scored as highly as the
 * longer one ("… video - STORYBOARD") and won on the tie-break. Penalising
 * unmatched query tokens as well is what lets the more specific task win.
 */
export function overlapScore(query: string[], target: string[], idf: Map<string, number>): number {
  if (target.length === 0 || query.length === 0) return 0;
  const fallback = Math.log(2);
  const weight = (token: string) => idf.get(token) ?? fallback;

  const querySet = new Set(query);
  const targetSet = new Set(target);

  let matched = 0;
  for (const token of targetSet) if (querySet.has(token)) matched += weight(token);

  let queryTotal = 0;
  for (const token of querySet) queryTotal += weight(token);
  let targetTotal = 0;
  for (const token of targetSet) targetTotal += weight(token);

  const denominator = queryTotal + targetTotal;
  return denominator === 0 ? 0 : (2 * matched) / denominator;
}

/** True when `needle` appears as a whole path segment of `haystackPath`. */
export function pathHasSegment(haystackPath: string, needle: string): boolean {
  const target = normalizeName(needle);
  if (!target) return false;
  return haystackPath.split('/').some((segment) => normalizeName(segment) === target);
}
