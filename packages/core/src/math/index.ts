/**
 * In-house math (OMML equation) support: AST, OMML round-trip, linear input,
 * measurement, and DOM rendering. No external typesetting dependency.
 */

export type {
  MathAst,
  MathNode,
  MathRunNode,
  MathFractionNode,
  MathSupNode,
  MathSubNode,
  MathSubSupNode,
  MathRadicalNode,
  MathNaryNode,
  MathDelimiterNode,
  MathFunctionNode,
  MathAccentNode,
  MathBarNode,
  MathMatrixNode,
  MathGroupNode,
  MathRawNode,
} from './ast';
export { mathNodeText, nodesText, isEmptyMathAst } from './ast';
export { ommlToMathAst, mathAstToOmml } from './omml';
export { renderMathNodes, type MathRenderOptions } from './render';
export {
  measureMathBox,
  type MathBoxMetrics,
  type MathMeasureStyle,
  type MeasureTextFn,
} from './measure';
export { linearToMathAst, mathAstToLinear } from './linear';
export {
  mathAttrsFromLinear,
  mathAttrsFromOmml,
  linearFromOmml,
  type MathNodeAttrs,
} from './insert';
