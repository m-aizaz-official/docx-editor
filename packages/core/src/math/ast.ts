/**
 * Math AST — the in-house, framework-agnostic working representation for
 * equations. OMML (`m:oMath`) is parsed into this tree for rendering/editing
 * and serialized back to OMML on save. The original OMML is kept verbatim on
 * the ProseMirror node and only re-serialized from the AST when the user
 * actually edits an equation, so untouched equations round-trip byte-for-byte.
 *
 * `raw` is the escape hatch: any OMML element the parser does not model is
 * captured as a `raw` node holding its verbatim XML, so opening → editing →
 * saving never drops constructs the AST does not yet cover.
 */

/** A single text/operator run (maps to `m:r` / `m:t`). */
export interface MathRunNode {
  type: 'run';
  text: string;
  /** OMML normal-text flag (`m:nor`) — non-italic identifiers/operators. */
  normal?: boolean;
}

/** Fraction `m:f` (bar / skewed / linear / no-bar). */
export interface MathFractionNode {
  type: 'fraction';
  num: MathNode[];
  den: MathNode[];
  variant?: 'bar' | 'skewed' | 'linear' | 'noBar';
}

/** Superscript `m:sSup`. */
export interface MathSupNode {
  type: 'sup';
  base: MathNode[];
  sup: MathNode[];
}

/** Subscript `m:sSub`. */
export interface MathSubNode {
  type: 'sub';
  base: MathNode[];
  sub: MathNode[];
}

/** Combined sub+superscript `m:sSubSup`. */
export interface MathSubSupNode {
  type: 'subSup';
  base: MathNode[];
  sub: MathNode[];
  sup: MathNode[];
}

/** Radical `m:rad` (square/nth root). `degree` empty ⇒ square root. */
export interface MathRadicalNode {
  type: 'radical';
  degree: MathNode[];
  radicand: MathNode[];
}

/** N-ary operator `m:nary` (∑ ∏ ∫ …) with optional limits. */
export interface MathNaryNode {
  type: 'nary';
  operator: string;
  sub: MathNode[];
  sup: MathNode[];
  body: MathNode[];
}

/** Delimiter `m:d` — brackets around one or more `|`-separated groups. */
export interface MathDelimiterNode {
  type: 'delimiter';
  open: string;
  close: string;
  separator?: string;
  items: MathNode[][];
}

/** Function-apply `m:func` (sin, log, …). */
export interface MathFunctionNode {
  type: 'function';
  name: MathNode[];
  arg: MathNode[];
}

/** Accent `m:acc` (hat, bar, vec, dot …). */
export interface MathAccentNode {
  type: 'accent';
  char: string;
  base: MathNode[];
}

/** Overbar/underbar `m:bar`. */
export interface MathBarNode {
  type: 'bar';
  pos: 'top' | 'bottom';
  base: MathNode[];
}

/** Matrix / stacked rows `m:m`. */
export interface MathMatrixNode {
  type: 'matrix';
  rows: MathNode[][][];
}

/** A grouping wrapper (an `m:e` argument that holds a sequence). */
export interface MathGroupNode {
  type: 'group';
  items: MathNode[];
}

/** Escape hatch: OMML the parser does not model, preserved verbatim. */
export interface MathRawNode {
  type: 'raw';
  xml: string;
}

export type MathNode =
  | MathRunNode
  | MathFractionNode
  | MathSupNode
  | MathSubNode
  | MathSubSupNode
  | MathRadicalNode
  | MathNaryNode
  | MathDelimiterNode
  | MathFunctionNode
  | MathAccentNode
  | MathBarNode
  | MathMatrixNode
  | MathGroupNode
  | MathRawNode;

/** A whole equation: an ordered list of top-level nodes. */
export interface MathAst {
  display: 'inline' | 'block';
  body: MathNode[];
}

/** Concatenate all literal text in a subtree (for plainText/accessibility). */
export function mathNodeText(node: MathNode): string {
  switch (node.type) {
    case 'run':
      return node.text;
    case 'fraction':
      return `${nodesText(node.num)}/${nodesText(node.den)}`;
    case 'sup':
      return `${nodesText(node.base)}^${nodesText(node.sup)}`;
    case 'sub':
      return `${nodesText(node.base)}_${nodesText(node.sub)}`;
    case 'subSup':
      return `${nodesText(node.base)}_${nodesText(node.sub)}^${nodesText(node.sup)}`;
    case 'radical':
      return `√(${nodesText(node.radicand)})`;
    case 'nary':
      return `${node.operator}${nodesText(node.body)}`;
    case 'delimiter':
      return `${node.open}${node.items.map(nodesText).join(node.separator || ',')}${node.close}`;
    case 'function':
      return `${nodesText(node.name)}(${nodesText(node.arg)})`;
    case 'accent':
      return nodesText(node.base);
    case 'bar':
      return nodesText(node.base);
    case 'matrix':
      return node.rows.map((r) => r.map(nodesText).join(' ')).join('; ');
    case 'group':
      return nodesText(node.items);
    case 'raw':
      return '';
  }
}

/** Text of a node list. */
export function nodesText(nodes: MathNode[]): string {
  return nodes.map(mathNodeText).join('');
}

/** Whether an AST is effectively empty (no visible content). */
export function isEmptyMathAst(ast: MathAst): boolean {
  return ast.body.length === 0 || nodesText(ast.body).trim() === '';
}
