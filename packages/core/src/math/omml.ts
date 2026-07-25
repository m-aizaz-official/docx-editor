/**
 * OMML ⇄ Math AST.
 *
 * `ommlToMathAst` parses a stored `m:oMath` / `m:oMathPara` XML string into the
 * in-house {@link MathAst}. `mathAstToOmml` serializes an AST back to OMML for
 * save. Constructs the AST does not model survive as `raw` nodes and re-emit
 * verbatim, so editing one part of an equation never destroys another.
 *
 * Parsing reuses the project's safe XML layer (`parseXml`, DTD/entity-inert).
 * Serialization escapes every text/operator value via `escapeXml`.
 */

import {
  parseXml,
  elementToXml,
  getChildElements,
  getLocalName,
  getAttribute,
} from '../docx/xmlParser';
import type { XmlElement } from '../docx/xmlParser';
import { escapeXml } from '../docx/serializer/xmlUtils';
import type { MathAst, MathNode, MathDelimiterNode, MathMatrixNode } from './ast';

// ---------------------------------------------------------------------------
// OMML → AST
// ---------------------------------------------------------------------------

/** Parse a stored OMML string (`m:oMath` or `m:oMathPara`) into a MathAst. */
export function ommlToMathAst(ommlXml: string): MathAst {
  if (!ommlXml || !ommlXml.trim()) return { display: 'inline', body: [] };
  let root: XmlElement;
  try {
    root = parseXml(ommlXml);
  } catch {
    // Unparseable OMML — keep it verbatim so save round-trips it unchanged.
    return { display: 'inline', body: [{ type: 'raw', xml: ommlXml }] };
  }
  const top = getChildElements(root)[0];
  if (!top) return { display: 'inline', body: [] };

  const local = getLocalName(top.name || '');
  if (local === 'oMathPara') {
    const oMath = findLocal(top, 'oMath');
    return { display: 'block', body: oMath ? parseNodes(oMath) : [] };
  }
  return { display: 'inline', body: parseNodes(top) };
}

/** Parse the child sequence of an element (an `m:oMath` or `m:e`). */
function parseNodes(parent: XmlElement): MathNode[] {
  const out: MathNode[] = [];
  for (const el of getChildElements(parent)) {
    const node = parseElement(el);
    if (node) out.push(node);
  }
  return out;
}

function parseElement(el: XmlElement): MathNode | null {
  const name = getLocalName(el.name || '');
  switch (name) {
    case 'r':
      return { type: 'run', text: runText(el), ...(hasNormal(el) ? { normal: true } : {}) };
    case 't':
      return { type: 'run', text: textContent(el) };
    case 'f': {
      const variant = fractionVariant(el);
      return {
        type: 'fraction',
        num: childNodes(el, 'num'),
        den: childNodes(el, 'den'),
        ...(variant ? { variant } : {}),
      };
    }
    case 'sSup':
      return { type: 'sup', base: childNodes(el, 'e'), sup: childNodes(el, 'sup') };
    case 'sSub':
      return { type: 'sub', base: childNodes(el, 'e'), sub: childNodes(el, 'sub') };
    case 'sSubSup':
      return {
        type: 'subSup',
        base: childNodes(el, 'e'),
        sub: childNodes(el, 'sub'),
        sup: childNodes(el, 'sup'),
      };
    case 'rad':
      return { type: 'radical', degree: childNodes(el, 'deg'), radicand: childNodes(el, 'e') };
    case 'nary':
      return {
        type: 'nary',
        operator: naryChar(el),
        sub: childNodes(el, 'sub'),
        sup: childNodes(el, 'sup'),
        body: childNodes(el, 'e'),
      };
    case 'd':
      return parseDelimiter(el);
    case 'func':
      return { type: 'function', name: childNodes(el, 'fName'), arg: childNodes(el, 'e') };
    case 'acc':
      return { type: 'accent', char: propChar(el, 'accPr') || '̂', base: childNodes(el, 'e') };
    case 'bar':
      return { type: 'bar', pos: barPos(el), base: childNodes(el, 'e') };
    case 'm':
      return parseMatrix(el);
    case 'e':
    case 'oMath':
      return { type: 'group', items: parseNodes(el) };
    // Property elements carry no content of their own.
    case 'rPr':
    case 'fPr':
    case 'radPr':
    case 'naryPr':
    case 'dPr':
    case 'accPr':
    case 'barPr':
    case 'mPr':
    case 'ctrlPr':
      return null;
    default:
      return { type: 'raw', xml: elementToXml(el) };
  }
}

function parseDelimiter(el: XmlElement): MathDelimiterNode {
  const dPr = findLocal(el, 'dPr');
  const items = findAllLocal(el, 'e').map((e) => parseNodes(e));
  return {
    type: 'delimiter',
    open: charAttr(dPr, 'begChr') ?? '(',
    close: charAttr(dPr, 'endChr') ?? ')',
    ...(charAttr(dPr, 'sepChr') ? { separator: charAttr(dPr, 'sepChr') as string } : {}),
    items: items.length ? items : [[]],
  };
}

function parseMatrix(el: XmlElement): MathMatrixNode {
  const rows = findAllLocal(el, 'mr').map((mr) => findAllLocal(mr, 'e').map((e) => parseNodes(e)));
  return { type: 'matrix', rows };
}

// --- OMML read helpers -----------------------------------------------------

function findLocal(parent: XmlElement, local: string): XmlElement | null {
  for (const el of getChildElements(parent)) {
    if (getLocalName(el.name || '') === local) return el;
  }
  return null;
}

function findAllLocal(parent: XmlElement, local: string): XmlElement[] {
  return getChildElements(parent).filter((el) => getLocalName(el.name || '') === local);
}

/** Parse the nodes inside a named child (`m:num`, `m:e`, …). */
function childNodes(parent: XmlElement, local: string): MathNode[] {
  const child = findLocal(parent, local);
  return child ? parseNodes(child) : [];
}

/** Concatenated text of an `m:r` (all its `m:t`). */
function runText(r: XmlElement): string {
  let text = '';
  for (const t of findAllLocal(r, 't')) text += textContent(t);
  return text;
}

function textContent(el: XmlElement): string {
  let text = '';
  for (const child of el.elements ?? []) {
    if (child.type === 'text' && typeof child.text === 'string') text += child.text;
  }
  return text;
}

function hasNormal(r: XmlElement): boolean {
  const rPr = findLocal(r, 'rPr');
  return !!(rPr && findLocal(rPr, 'nor'));
}

function charAttr(el: XmlElement | null, local: string): string | null {
  if (!el) return null;
  const child = findLocal(el, local);
  return child ? getAttribute(child, 'm', 'val') : null;
}

function propChar(el: XmlElement, prLocal: string): string | null {
  return charAttr(findLocal(el, prLocal), 'chr');
}

function naryChar(el: XmlElement): string {
  return propChar(el, 'naryPr') ?? '∫'; // OMML default n-ary char is ∫
}

function barPos(el: XmlElement): 'top' | 'bottom' {
  const v = charAttr(findLocal(el, 'barPr'), 'pos');
  return v === 'top' ? 'top' : 'bottom';
}

function fractionVariant(el: XmlElement): MathFractionVariant | undefined {
  const v = charAttr(findLocal(el, 'fPr'), 'type');
  if (v === 'skw') return 'skewed';
  if (v === 'lin') return 'linear';
  if (v === 'noBar') return 'noBar';
  return undefined;
}
type MathFractionVariant = 'bar' | 'skewed' | 'linear' | 'noBar';

// ---------------------------------------------------------------------------
// AST → OMML
// ---------------------------------------------------------------------------

/** Serialize a MathAst back to an OMML string. */
export function mathAstToOmml(ast: MathAst): string {
  const inner = ast.body.map(serializeNode).join('');
  const oMath = `<m:oMath>${inner}</m:oMath>`;
  return ast.display === 'block' ? `<m:oMathPara>${oMath}</m:oMathPara>` : oMath;
}

function serializeNodes(nodes: MathNode[]): string {
  return nodes.map(serializeNode).join('');
}

/** Wrap a node list as an `m:e` argument. */
function elem(nodes: MathNode[]): string {
  return `<m:e>${serializeNodes(nodes)}</m:e>`;
}

function serializeNode(node: MathNode): string {
  switch (node.type) {
    case 'run': {
      const rPr = node.normal ? '<m:rPr><m:nor/></m:rPr>' : '';
      return `<m:r>${rPr}<m:t xml:space="preserve">${escapeXml(node.text)}</m:t></m:r>`;
    }
    case 'fraction': {
      const type = fractionType(node.variant);
      const fPr = type ? `<m:fPr><m:type m:val="${type}"/></m:fPr>` : '';
      return `<m:f>${fPr}<m:num>${serializeNodes(node.num)}</m:num><m:den>${serializeNodes(node.den)}</m:den></m:f>`;
    }
    case 'sup':
      return `<m:sSup>${elem(node.base)}<m:sup>${serializeNodes(node.sup)}</m:sup></m:sSup>`;
    case 'sub':
      return `<m:sSub>${elem(node.base)}<m:sub>${serializeNodes(node.sub)}</m:sub></m:sSub>`;
    case 'subSup':
      return `<m:sSubSup>${elem(node.base)}<m:sub>${serializeNodes(node.sub)}</m:sub><m:sup>${serializeNodes(node.sup)}</m:sup></m:sSubSup>`;
    case 'radical': {
      const degHide = node.degree.length === 0 ? '<m:radPr><m:degHide m:val="1"/></m:radPr>' : '';
      return `<m:rad>${degHide}<m:deg>${serializeNodes(node.degree)}</m:deg><m:e>${serializeNodes(node.radicand)}</m:e></m:rad>`;
    }
    case 'nary': {
      const naryPr = `<m:naryPr><m:chr m:val="${escapeXml(node.operator)}"/>${node.sub.length ? '' : '<m:subHide m:val="1"/>'}${node.sup.length ? '' : '<m:supHide m:val="1"/>'}</m:naryPr>`;
      return `<m:nary>${naryPr}<m:sub>${serializeNodes(node.sub)}</m:sub><m:sup>${serializeNodes(node.sup)}</m:sup>${elem(node.body)}</m:nary>`;
    }
    case 'delimiter': {
      const dPr = `<m:dPr><m:begChr m:val="${escapeXml(node.open)}"/>${node.separator ? `<m:sepChr m:val="${escapeXml(node.separator)}"/>` : ''}<m:endChr m:val="${escapeXml(node.close)}"/></m:dPr>`;
      const items = node.items.map((it) => `<m:e>${serializeNodes(it)}</m:e>`).join('');
      return `<m:d>${dPr}${items}</m:d>`;
    }
    case 'function':
      return `<m:func><m:fName>${serializeNodes(node.name)}</m:fName>${elem(node.arg)}</m:func>`;
    case 'accent':
      return `<m:acc><m:accPr><m:chr m:val="${escapeXml(node.char)}"/></m:accPr>${elem(node.base)}</m:acc>`;
    case 'bar':
      return `<m:bar><m:barPr><m:pos m:val="${node.pos === 'top' ? 'top' : 'bot'}"/></m:barPr>${elem(node.base)}</m:bar>`;
    case 'matrix': {
      const rows = node.rows
        .map(
          (row) =>
            `<m:mr>${row.map((cell) => `<m:e>${serializeNodes(cell)}</m:e>`).join('')}</m:mr>`
        )
        .join('');
      return `<m:m>${rows}</m:m>`;
    }
    case 'group':
      return serializeNodes(node.items);
    case 'raw':
      return node.xml;
  }
}

function fractionType(variant?: MathFractionVariant): string | null {
  switch (variant) {
    case 'skewed':
      return 'skw';
    case 'linear':
      return 'lin';
    case 'noBar':
      return 'noBar';
    default:
      return null;
  }
}
