/**
 * Helpers for turning user input (linear LaTeX-style, or raw OMML) into the
 * attrs a ProseMirror `math` node needs. Shared by both adapters so the insert
 * path is identical.
 */

import { linearToMathAst, mathAstToLinear } from './linear';
import { mathAstToOmml, ommlToMathAst } from './omml';
import { nodesText } from './ast';

export interface MathNodeAttrs {
  display: 'inline' | 'block';
  ommlXml: string;
  plainText: string;
}

/** Build `math` node attrs from a linear (LaTeX-style) string. */
export function mathAttrsFromLinear(
  linear: string,
  display: 'inline' | 'block' = 'inline'
): MathNodeAttrs {
  const body = linearToMathAst(linear);
  return {
    display,
    ommlXml: mathAstToOmml({ display, body }),
    plainText: nodesText(body),
  };
}

/** Build `math` node attrs from a raw OMML string (e.g. a gallery preset). */
export function mathAttrsFromOmml(
  ommlXml: string,
  display: 'inline' | 'block' = 'inline'
): MathNodeAttrs {
  const ast = ommlToMathAst(ommlXml);
  return { display: ast.display ?? display, ommlXml, plainText: nodesText(ast.body) };
}

/** Recover an editable linear string from a stored OMML equation. */
export function linearFromOmml(ommlXml: string): string {
  return mathAstToLinear(ommlToMathAst(ommlXml).body);
}
