/**
 * In-house math renderer: MathAst → styled DOM (no external typesetting
 * library). Uses nested inline-block boxes + CSS (fraction bars via
 * border-top, scripts via vertical-align + smaller font, stretchy brackets via
 * font scaling) to lay out equations close to Word's appearance.
 *
 * Built with `document.createElement` + `textContent` only (never innerHTML)
 * so file-derived text can never inject markup. The returned element is
 * inline-block, so its natural bounding box gives the painter a real
 * width/height for line-breaking and pagination.
 */

import type { MathNode } from './ast';
import { nodesText } from './ast';

const MATH_FONT = '"Cambria Math", "Latin Modern Math", "STIX Two Math", serif';

/** Options controlling how a math tree is rendered. */
export interface MathRenderOptions {
  /** Base font size in px for the equation. Defaults to 18. */
  fontSize?: number;
  /** Provide a document (for non-DOM environments / tests). */
  doc?: Document;
}

/** Render a whole equation body to an inline-block container element. */
export function renderMathNodes(nodes: MathNode[], options: MathRenderOptions = {}): HTMLElement {
  const doc = options.doc ?? document;
  const root = doc.createElement('span');
  root.className = 'docx-math-render';
  root.style.fontFamily = MATH_FONT;
  root.style.fontSize = `${options.fontSize ?? 18}px`;
  root.style.fontStyle = 'italic';
  root.style.display = 'inline-flex';
  root.style.alignItems = 'center';
  root.style.whiteSpace = 'nowrap';
  root.style.lineHeight = '1';
  for (const node of nodes) root.appendChild(renderNode(node, doc));
  return root;
}

function box(doc: Document, display = 'inline-flex'): HTMLElement {
  const el = doc.createElement('span');
  el.style.display = display;
  el.style.alignItems = 'center';
  el.style.whiteSpace = 'nowrap';
  return el;
}

function seq(nodes: MathNode[], doc: Document): HTMLElement {
  const el = box(doc);
  for (const n of nodes) el.appendChild(renderNode(n, doc));
  if (nodes.length === 0) {
    // Empty argument slot — keep a small placeholder box so structure holds.
    const ph = doc.createElement('span');
    ph.style.display = 'inline-block';
    ph.style.minWidth = '0.4em';
    el.appendChild(ph);
  }
  return el;
}

function renderNode(node: MathNode, doc: Document): HTMLElement {
  switch (node.type) {
    case 'run': {
      const el = doc.createElement('span');
      el.textContent = node.text;
      if (node.normal) el.style.fontStyle = 'normal';
      return el;
    }
    case 'fraction':
      return renderFraction(node.num, node.den, node.variant, doc);
    case 'sup':
      return renderScript(seq(node.base, doc), null, seq(node.sup, doc), doc);
    case 'sub':
      return renderScript(seq(node.base, doc), seq(node.sub, doc), null, doc);
    case 'subSup':
      return renderScript(seq(node.base, doc), seq(node.sub, doc), seq(node.sup, doc), doc);
    case 'radical':
      return renderRadical(node.degree, node.radicand, doc);
    case 'nary':
      return renderNary(node.operator, node.sub, node.sup, node.body, doc);
    case 'delimiter':
      return renderDelimiter(node.open, node.close, node.separator, node.items, doc);
    case 'function': {
      const el = box(doc);
      const name = seq(node.name, doc);
      name.style.fontStyle = 'normal';
      el.appendChild(name);
      el.appendChild(thinSpace(doc));
      el.appendChild(seq(node.arg, doc));
      return el;
    }
    case 'accent':
      return renderAccent(node.char, node.base, doc);
    case 'bar':
      return renderBar(node.pos, node.base, doc);
    case 'matrix':
      return renderMatrix(node.rows, doc);
    case 'group':
      return seq(node.items, doc);
    case 'raw': {
      // Unknown construct — show its extracted text so nothing silently vanishes.
      const el = doc.createElement('span');
      el.textContent = nodesText([node]) || '□';
      el.style.opacity = '0.7';
      return el;
    }
  }
}

function thinSpace(doc: Document): HTMLElement {
  const s = doc.createElement('span');
  s.style.display = 'inline-block';
  s.style.width = '0.17em';
  return s;
}

function renderFraction(
  num: MathNode[],
  den: MathNode[],
  variant: string | undefined,
  doc: Document
): HTMLElement {
  if (variant === 'linear') {
    const el = box(doc);
    el.appendChild(seq(num, doc));
    const slash = doc.createElement('span');
    slash.textContent = '/';
    el.appendChild(slash);
    el.appendChild(seq(den, doc));
    return el;
  }
  const el = doc.createElement('span');
  el.style.display = 'inline-flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.verticalAlign = 'middle';
  el.style.textAlign = 'center';
  el.style.margin = '0 0.15em';
  el.style.fontSize = '0.95em';

  const n = seq(num, doc);
  n.style.padding = '0 0.2em';
  const d = seq(den, doc);
  d.style.padding = '0 0.2em';

  const bar = variant === 'noBar' ? null : doc.createElement('span');
  if (bar) {
    bar.style.display = 'block';
    bar.style.width = '100%';
    bar.style.height = '0';
    bar.style.borderTop = '0.06em solid currentColor';
    bar.style.margin = '0.05em 0';
  }
  el.appendChild(n);
  if (bar) el.appendChild(bar);
  el.appendChild(d);
  return el;
}

function renderScript(
  base: HTMLElement,
  sub: HTMLElement | null,
  sup: HTMLElement | null,
  doc: Document
): HTMLElement {
  const el = box(doc);
  el.appendChild(base);
  const stack = doc.createElement('span');
  stack.style.display = 'inline-flex';
  stack.style.flexDirection = 'column';
  stack.style.fontSize = '0.7em';
  stack.style.lineHeight = '1';
  stack.style.margin = '0 0.05em';
  if (sup) {
    sup.style.transform = 'translateY(-0.2em)';
    stack.appendChild(sup);
  }
  if (sub) {
    sub.style.transform = 'translateY(0.2em)';
    stack.appendChild(sub);
  }
  el.appendChild(stack);
  return el;
}

function renderRadical(degree: MathNode[], radicand: MathNode[], doc: Document): HTMLElement {
  const el = box(doc);
  el.style.alignItems = 'flex-start';

  if (degree.length > 0) {
    const deg = seq(degree, doc);
    deg.style.fontSize = '0.6em';
    deg.style.transform = 'translateY(-0.15em)';
    deg.style.marginRight = '-0.25em';
    el.appendChild(deg);
  }

  const surd = doc.createElement('span');
  surd.textContent = '√';
  surd.style.transform = 'scaleY(1.15)';
  el.appendChild(surd);

  const rad = seq(radicand, doc);
  rad.style.borderTop = '0.06em solid currentColor';
  rad.style.padding = '0.05em 0.15em 0 0.1em';
  el.appendChild(rad);
  return el;
}

function renderNary(
  operator: string,
  sub: MathNode[],
  sup: MathNode[],
  body: MathNode[],
  doc: Document
): HTMLElement {
  const el = box(doc);
  const opStack = doc.createElement('span');
  opStack.style.display = 'inline-flex';
  opStack.style.flexDirection = 'column';
  opStack.style.alignItems = 'center';

  if (sup.length) {
    const s = seq(sup, doc);
    s.style.fontSize = '0.6em';
    opStack.appendChild(s);
  }
  const op = doc.createElement('span');
  op.textContent = operator;
  op.style.fontSize = '1.8em';
  op.style.fontStyle = 'normal';
  op.style.lineHeight = '1';
  opStack.appendChild(op);
  if (sub.length) {
    const s = seq(sub, doc);
    s.style.fontSize = '0.6em';
    opStack.appendChild(s);
  }
  el.appendChild(opStack);
  el.appendChild(seq(body, doc));
  return el;
}

function renderDelimiter(
  open: string,
  close: string,
  separator: string | undefined,
  items: MathNode[][],
  doc: Document
): HTMLElement {
  const el = box(doc);
  const openEl = doc.createElement('span');
  openEl.textContent = open || '(';
  openEl.style.transform = 'scaleY(1.4)';
  openEl.style.fontStyle = 'normal';
  el.appendChild(openEl);

  items.forEach((it, i) => {
    if (i > 0) {
      const sep = doc.createElement('span');
      sep.textContent = separator || ',';
      sep.style.fontStyle = 'normal';
      sep.style.padding = '0 0.15em';
      el.appendChild(sep);
    }
    el.appendChild(seq(it, doc));
  });

  const closeEl = doc.createElement('span');
  closeEl.textContent = close || ')';
  closeEl.style.transform = 'scaleY(1.4)';
  closeEl.style.fontStyle = 'normal';
  el.appendChild(closeEl);
  return el;
}

function renderAccent(char: string, base: MathNode[], doc: Document): HTMLElement {
  const el = doc.createElement('span');
  el.style.display = 'inline-flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  const acc = doc.createElement('span');
  acc.textContent = char;
  acc.style.fontSize = '0.9em';
  acc.style.height = '0.4em';
  acc.style.lineHeight = '0.4em';
  el.appendChild(acc);
  el.appendChild(seq(base, doc));
  return el;
}

function renderBar(pos: 'top' | 'bottom', base: MathNode[], doc: Document): HTMLElement {
  const el = seq(base, doc);
  if (pos === 'top') el.style.borderTop = '0.06em solid currentColor';
  else el.style.borderBottom = '0.06em solid currentColor';
  el.style.padding = pos === 'top' ? '0.08em 0 0' : '0 0 0.08em';
  return el;
}

function renderMatrix(rows: MathNode[][][], doc: Document): HTMLElement {
  const grid = doc.createElement('span');
  grid.style.display = 'inline-grid';
  grid.style.verticalAlign = 'middle';
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;
  grid.style.columnGap = '0.6em';
  grid.style.rowGap = '0.2em';
  grid.style.justifyItems = 'center';
  for (const row of rows) {
    for (let c = 0; c < cols; c++) {
      grid.appendChild(seq(row[c] ?? [], doc));
    }
  }
  return grid;
}
