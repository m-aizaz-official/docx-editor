/**
 * Model-time measurement of a math box. Runs during flow layout (no DOM), so
 * it takes a `measureText` callback (the canvas-based `measureTextWidth`) and
 * estimates the rendered box from the AST structure. The estimate mirrors the
 * proportions the CSS renderer (`render.ts`) produces — fraction stacks, script
 * shrink/offset, radical padding — and is kept slightly generous so the painted
 * equation never overflows its reserved line width.
 */

import type { MathNode } from './ast';

/** Text style passed to the measure callback. */
export interface MathMeasureStyle {
  fontSizePx: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
}

export type MeasureTextFn = (text: string, style: MathMeasureStyle) => number;

/** A measured box: width + height in px, and baseline offset from the top. */
export interface MathBoxMetrics {
  width: number;
  height: number;
  ascent: number;
}

const SCRIPT_SHRINK = 0.7;
const FRACTION_SHRINK = 0.95;

/** Measure a math node list at a given base font size. */
export function measureMathBox(
  nodes: MathNode[],
  fontSizePx: number,
  measureText: MeasureTextFn
): MathBoxMetrics {
  const style: MathMeasureStyle = {
    fontSizePx,
    fontFamily: 'Cambria Math',
    italic: true,
  };
  const boxes = nodes.map((n) => measureNode(n, fontSizePx, measureText));
  return combineHorizontal(boxes, fontSizePx, style, measureText);
}

/** Lay a row of boxes side by side, aligning baselines. */
function combineHorizontal(
  boxes: MathBoxMetrics[],
  fontSizePx: number,
  _style: MathMeasureStyle,
  _measureText: MeasureTextFn
): MathBoxMetrics {
  if (boxes.length === 0) {
    return { width: 0, height: fontSizePx, ascent: fontSizePx * 0.8 };
  }
  const width = boxes.reduce((w, b) => w + b.width, 0);
  const ascent = Math.max(...boxes.map((b) => b.ascent));
  const descent = Math.max(...boxes.map((b) => b.height - b.ascent));
  return { width, height: ascent + descent, ascent };
}

function measureNode(node: MathNode, fontSizePx: number, m: MeasureTextFn): MathBoxMetrics {
  const style: MathMeasureStyle = { fontSizePx, fontFamily: 'Cambria Math', italic: true };
  switch (node.type) {
    case 'run': {
      const width = m(node.text || ' ', { ...style, italic: !node.normal });
      const ascent = fontSizePx * 0.8;
      return { width, height: fontSizePx * 1.05, ascent };
    }
    case 'fraction': {
      const size = fontSizePx * FRACTION_SHRINK;
      const num = measureMathBox(node.num, size, m);
      const den = measureMathBox(node.den, size, m);
      const width = Math.max(num.width, den.width) + fontSizePx * 0.4;
      const barGap = fontSizePx * 0.2;
      const height = num.height + den.height + barGap;
      // Baseline sits on the fraction bar (math axis).
      return { width, height, ascent: num.height + barGap / 2 };
    }
    case 'sup': {
      const base = measureMathBox(node.base, fontSizePx, m);
      const sup = measureMathBox(node.sup, fontSizePx * SCRIPT_SHRINK, m);
      return {
        width: base.width + sup.width + fontSizePx * 0.05,
        height: base.height + sup.height * 0.5,
        ascent: base.ascent + sup.height * 0.4,
      };
    }
    case 'sub': {
      const base = measureMathBox(node.base, fontSizePx, m);
      const sub = measureMathBox(node.sub, fontSizePx * SCRIPT_SHRINK, m);
      return {
        width: base.width + sub.width + fontSizePx * 0.05,
        height: base.height + sub.height * 0.5,
        ascent: base.ascent,
      };
    }
    case 'subSup': {
      const base = measureMathBox(node.base, fontSizePx, m);
      const sub = measureMathBox(node.sub, fontSizePx * SCRIPT_SHRINK, m);
      const sup = measureMathBox(node.sup, fontSizePx * SCRIPT_SHRINK, m);
      return {
        width: base.width + Math.max(sub.width, sup.width) + fontSizePx * 0.05,
        height: base.height + sup.height * 0.5 + sub.height * 0.5,
        ascent: base.ascent + sup.height * 0.4,
      };
    }
    case 'radical': {
      const rad = measureMathBox(node.radicand, fontSizePx, m);
      const deg = node.degree.length ? measureMathBox(node.degree, fontSizePx * 0.6, m).width : 0;
      return {
        width: rad.width + fontSizePx * 0.7 + deg,
        height: rad.height + fontSizePx * 0.15,
        ascent: rad.ascent + fontSizePx * 0.15,
      };
    }
    case 'nary': {
      const body = measureMathBox(node.body, fontSizePx, m);
      const sub = node.sub.length
        ? measureMathBox(node.sub, fontSizePx * 0.6, m)
        : zero(fontSizePx);
      const sup = node.sup.length
        ? measureMathBox(node.sup, fontSizePx * 0.6, m)
        : zero(fontSizePx);
      const opWidth = fontSizePx * 1.1;
      return {
        width: opWidth + Math.max(sub.width, sup.width) + body.width,
        height: Math.max(body.height, fontSizePx * 1.8) + sup.height + sub.height,
        ascent: Math.max(body.ascent, fontSizePx * 0.9) + sup.height,
      };
    }
    case 'delimiter': {
      const inner = node.items.map((it) => measureMathBox(it, fontSizePx, m));
      const innerWidth = inner.reduce((w, b) => w + b.width, 0);
      const sepWidth = m(node.separator || ',', style) * (node.items.length - 1);
      const height = Math.max(fontSizePx * 1.1, ...inner.map((b) => b.height));
      const ascent = Math.max(fontSizePx * 0.85, ...inner.map((b) => b.ascent));
      return { width: innerWidth + sepWidth + fontSizePx * 0.8, height, ascent };
    }
    case 'function': {
      const name = measureMathBox(node.name, fontSizePx, m);
      const arg = measureMathBox(node.arg, fontSizePx, m);
      return {
        width: name.width + arg.width + fontSizePx * 0.17,
        height: Math.max(name.height, arg.height),
        ascent: Math.max(name.ascent, arg.ascent),
      };
    }
    case 'accent': {
      const base = measureMathBox(node.base, fontSizePx, m);
      return {
        width: base.width,
        height: base.height + fontSizePx * 0.25,
        ascent: base.ascent + fontSizePx * 0.25,
      };
    }
    case 'bar': {
      const base = measureMathBox(node.base, fontSizePx, m);
      return {
        width: base.width,
        height: base.height + fontSizePx * 0.1,
        ascent: base.ascent + fontSizePx * 0.1,
      };
    }
    case 'matrix': {
      const colWidths: number[] = [];
      let totalHeight = 0;
      for (const row of node.rows) {
        let rowHeight = fontSizePx;
        row.forEach((cell, c) => {
          const b = measureMathBox(cell, fontSizePx, m);
          colWidths[c] = Math.max(colWidths[c] ?? 0, b.width);
          rowHeight = Math.max(rowHeight, b.height);
        });
        totalHeight += rowHeight + fontSizePx * 0.2;
      }
      const width = colWidths.reduce((w, c) => w + c + fontSizePx * 0.6, 0);
      return { width, height: totalHeight, ascent: totalHeight / 2 + fontSizePx * 0.3 };
    }
    case 'group':
      return measureMathBox(node.items, fontSizePx, m);
    case 'raw': {
      const width = m('□', style);
      return { width, height: fontSizePx * 1.05, ascent: fontSizePx * 0.8 };
    }
  }
}

function zero(fontSizePx: number): MathBoxMetrics {
  return { width: 0, height: 0, ascent: fontSizePx * 0.4 };
}
