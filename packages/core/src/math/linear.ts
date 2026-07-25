/**
 * Linear math input ⇄ AST. Accepts a pragmatic LaTeX-style subset (also the way
 * Word's linear input reads): `a/b`, `\frac{a}{b}`, `x^2`, `x_i`, `x_i^2`,
 * `\sqrt{x}`, `\sqrt[n]{x}`, `\sum_{i=1}^{n}`, `\int`, `\prod`, `\alpha`,
 * function names (`\sin`, `sin`), and parenthesised groups. Unknown `\commands`
 * degrade to their literal name so nothing is lost.
 *
 * This is intentionally a bounded, forgiving parser — enough to author the
 * common equations, feeding the same AST the OMML/render paths use.
 */

import type { MathNode } from './ast';

const GREEK: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
};

const SYMBOLS: Record<string, string> = {
  times: '×',
  div: '÷',
  pm: '±',
  mp: '∓',
  cdot: '·',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  approx: '≈',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  supset: '⊃',
  cup: '∪',
  cap: '∩',
  forall: '∀',
  exists: '∃',
  rightarrow: '→',
  leftarrow: '←',
  to: '→',
  Rightarrow: '⇒',
  ldots: '…',
  cdots: '⋯',
  angle: '∠',
  propto: '∝',
};

const NARY: Record<string, string> = {
  sum: '∑',
  prod: '∏',
  int: '∫',
  oint: '∮',
  bigcup: '⋃',
  bigcap: '⋂',
};
const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'log',
  'ln',
  'exp',
  'lim',
  'max',
  'min',
  'det',
  'gcd',
  'sinh',
  'cosh',
  'tanh',
]);

type Tok =
  | { t: 'sym'; v: string }
  | { t: 'num'; v: string }
  | { t: 'ident'; v: string }
  | { t: 'cmd'; v: string }
  | { t: 'op'; v: string }; // one of / ^ _ ( ) { } [ ] | ,

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c === '\\') {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      if (j === i + 1) {
        // Escaped single char like \{ — treat as literal symbol.
        toks.push({ t: 'sym', v: src[j] ?? '' });
        i = j + 1;
      } else {
        toks.push({ t: 'cmd', v: src.slice(i + 1, j) });
        i = j;
      }
      continue;
    }
    if ('/^_(){}[]|,'.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      toks.push({ t: 'ident', v: c });
      i++;
      continue;
    }
    toks.push({ t: 'sym', v: c });
    i++;
  }
  return toks;
}

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }
  private next(): Tok | undefined {
    return this.toks[this.p++];
  }
  private eat(v: string): boolean {
    const t = this.peek();
    if (t && t.t === 'op' && t.v === v) {
      this.p++;
      return true;
    }
    return false;
  }

  /** Parse a sequence, folding `/`, `^`, `_` onto the preceding factor. */
  parseSeq(stopOps: string[] = []): MathNode[] {
    const out: MathNode[] = [];
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.t === 'op' && stopOps.includes(t.v)) break;

      if (t.t === 'op' && t.v === '/') {
        this.next();
        const num = out.pop();
        const den = this.parseFactor();
        out.push({ type: 'fraction', num: num ? [num] : [], den: den ? [den] : [] });
        continue;
      }
      if (t.t === 'op' && (t.v === '^' || t.v === '_')) {
        const base = out.pop() ?? { type: 'run', text: '' };
        out.push(this.parseScripts(base));
        continue;
      }
      const factor = this.parseFactor();
      if (factor) out.push(factor);
      else break;
    }
    return out;
  }

  /** Attach ^ and _ scripts to a base node. */
  private parseScripts(base: MathNode): MathNode {
    let sub: MathNode[] | null = null;
    let sup: MathNode[] | null = null;
    while (true) {
      if (this.eat('^')) sup = [this.parseFactor() ?? { type: 'run', text: '' }];
      else if (this.eat('_')) sub = [this.parseFactor() ?? { type: 'run', text: '' }];
      else break;
    }
    if (sub && sup) return { type: 'subSup', base: [base], sub, sup };
    if (sup) return { type: 'sup', base: [base], sup };
    if (sub) return { type: 'sub', base: [base], sub };
    return base;
  }

  /** Parse one factor (run, group, command, or delimiter). */
  parseFactor(): MathNode | null {
    const t = this.peek();
    if (!t) return null;

    if (t.t === 'op') {
      if (t.v === '{') {
        this.next();
        const items = this.parseSeq(['}']);
        this.eat('}');
        return { type: 'group', items };
      }
      if (t.v === '(') {
        this.next();
        const items = this.parseSeq([')']);
        this.eat(')');
        return { type: 'delimiter', open: '(', close: ')', items: [items] };
      }
      if (t.v === '|') {
        this.next();
        const items = this.parseSeq(['|']);
        this.eat('|');
        return { type: 'delimiter', open: '|', close: '|', items: [items] };
      }
      // Stray operator ( } ) , etc. → literal.
      this.next();
      return { type: 'run', text: t.v, normal: true };
    }
    if (t.t === 'num') {
      this.next();
      return { type: 'run', text: t.v, normal: true };
    }
    if (t.t === 'ident') {
      this.next();
      return { type: 'run', text: t.v };
    }
    if (t.t === 'sym') {
      this.next();
      return { type: 'run', text: t.v, normal: true };
    }
    if (t.t === 'cmd') {
      this.next();
      return this.parseCommand(t.v);
    }
    return null;
  }

  private parseCommand(name: string): MathNode {
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      const num = this.parseArg();
      const den = this.parseArg();
      return { type: 'fraction', num, den };
    }
    if (name === 'sqrt') {
      // Optional [degree] then {radicand}.
      let degree: MathNode[] = [];
      if (this.peek()?.t === 'op' && (this.peek() as Tok & { v: string }).v === '[') {
        this.next();
        degree = this.parseSeq([']']);
        this.eat(']');
      }
      const radicand = this.parseArg();
      return { type: 'radical', degree, radicand };
    }
    if (NARY[name]) {
      let sub: MathNode[] = [];
      let sup: MathNode[] = [];
      while (true) {
        if (this.eat('_')) sub = this.wrapArg(this.parseFactor());
        else if (this.eat('^')) sup = this.wrapArg(this.parseFactor());
        else break;
      }
      return { type: 'nary', operator: NARY[name], sub, sup, body: [] };
    }
    if (FUNCTIONS.has(name)) {
      return { type: 'function', name: [{ type: 'run', text: name, normal: true }], arg: [] };
    }
    if (GREEK[name]) return { type: 'run', text: GREEK[name] };
    if (SYMBOLS[name]) return { type: 'run', text: SYMBOLS[name], normal: true };
    if (name === 'hat' || name === 'bar' || name === 'vec' || name === 'dot' || name === 'tilde') {
      const accents: Record<string, string> = { hat: '̂', bar: '̄', vec: '⃗', dot: '̇', tilde: '̃' };
      return { type: 'accent', char: accents[name], base: this.parseArg() };
    }
    // Unknown command — emit its literal name so nothing is silently dropped.
    return { type: 'run', text: name, normal: true };
  }

  /** Parse a `{...}` argument (or a single factor if unbraced). */
  private parseArg(): MathNode[] {
    if (this.peek()?.t === 'op' && (this.peek() as Tok & { v: string }).v === '{') {
      this.next();
      const items = this.parseSeq(['}']);
      this.eat('}');
      return items;
    }
    const f = this.parseFactor();
    return f ? [f] : [];
  }

  private wrapArg(node: MathNode | null): MathNode[] {
    if (!node) return [];
    if (node.type === 'group') return node.items;
    return [node];
  }
}

/** Parse a linear (LaTeX-style) math string into AST nodes. */
export function linearToMathAst(src: string): MathNode[] {
  return new Parser(tokenize(src)).parseSeq();
}

/** Serialize AST nodes back to a linear string (for seeding the editor). */
export function mathAstToLinear(nodes: MathNode[]): string {
  return nodes.map(nodeToLinear).join('');
}

function nodeToLinear(node: MathNode): string {
  switch (node.type) {
    case 'run':
      return node.text;
    case 'fraction':
      return `\\frac{${mathAstToLinear(node.num)}}{${mathAstToLinear(node.den)}}`;
    case 'sup':
      return `${braced(node.base)}^${braced(node.sup)}`;
    case 'sub':
      return `${braced(node.base)}_${braced(node.sub)}`;
    case 'subSup':
      return `${braced(node.base)}_${braced(node.sub)}^${braced(node.sup)}`;
    case 'radical':
      return node.degree.length
        ? `\\sqrt[${mathAstToLinear(node.degree)}]{${mathAstToLinear(node.radicand)}}`
        : `\\sqrt{${mathAstToLinear(node.radicand)}}`;
    case 'nary': {
      const op = Object.keys(NARY).find((k) => NARY[k] === node.operator);
      const cmd = op ? `\\${op}` : node.operator;
      const sub = node.sub.length ? `_{${mathAstToLinear(node.sub)}}` : '';
      const sup = node.sup.length ? `^{${mathAstToLinear(node.sup)}}` : '';
      return `${cmd}${sub}${sup} ${mathAstToLinear(node.body)}`;
    }
    case 'delimiter':
      return `${node.open}${node.items.map(mathAstToLinear).join(node.separator || ',')}${node.close}`;
    case 'function':
      return `\\${mathAstToLinear(node.name)} ${mathAstToLinear(node.arg)}`;
    case 'accent':
      return mathAstToLinear(node.base);
    case 'bar':
      return mathAstToLinear(node.base);
    case 'matrix':
      return node.rows.map((r) => r.map(mathAstToLinear).join(' & ')).join(' \\\\ ');
    case 'group':
      return mathAstToLinear(node.items);
    case 'raw':
      return '';
  }
}

function braced(nodes: MathNode[]): string {
  const s = mathAstToLinear(nodes);
  return s.length === 1 ? s : `{${s}}`;
}
