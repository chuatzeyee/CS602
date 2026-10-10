// glob.ts - wildcard matching without regular expressions. A pattern such as *a*a*a*a*a*b turned into a RegExp
// backtracks through every way of placing its stars (a second or more on a 30-character text, and nothing can
// interrupt it); this greedy matcher takes at most text length x pattern length steps.

/** One pattern position: '*' matches any run of characters (also none), a function tests one character. */
export type GlobToken = '*' | ((ch: string) => boolean);

/** A RegExp-like matcher: only `test`. */
export interface WildcardMatcher { test(text: string): boolean }

/** Does the whole text match the tokens? */
export function globMatch(tokens: readonly GlobToken[], text: string): boolean {
  let p = 0;
  let t = 0;
  let star = -1;     // the last '*' seen, and the text position it currently stands for
  let starText = 0;
  while (t < text.length) {
    const tok = p < tokens.length ? tokens[p] : undefined;
    if (tok === '*') {
      star = p++;
      starText = t;
    } else if (tok !== undefined && tok(text[t])) {
      p++;
      t++;
    } else if (star >= 0) {
      p = star + 1;     // let the last star take one more character
      t = ++starText;
    } else {
      return false;
    }
  }
  while (p < tokens.length && tokens[p] === '*') p++;
  return p === tokens.length;
}

export type WildcardMode = 'whole' | 'begins' | 'ends' | 'contains';

/**
 * Excel wildcards, case-insensitive: * any run, ? one character, ~* ~? ~~ the character itself (anyTilde: ~ before any
 * character). mode: the whole text, or text that begins with, ends with or contains the pattern.
 */
export function excelWildcard(pattern: string, mode: WildcardMode = 'whole', anyTilde = false): WildcardMatcher {
  const lower = pattern.toLowerCase();
  const tokens: GlobToken[] = mode === 'ends' || mode === 'contains' ? ['*'] : [];
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (ch === '~' && i + 1 < lower.length && (anyTilde || '*?~'.includes(lower[i + 1]))) {
      const lit = lower[++i];
      tokens.push((c) => c === lit);
    } else if (ch === '*') {
      if (tokens[tokens.length - 1] !== '*') tokens.push('*');
    } else if (ch === '?') {
      tokens.push(() => true);
    } else {
      tokens.push((c) => c === ch);
    }
  }
  if ((mode === 'begins' || mode === 'contains') && tokens[tokens.length - 1] !== '*') tokens.push('*');
  return { test: (text) => globMatch(tokens, text.toLowerCase()) };
}
