import { describe, test, expect } from 'bun:test';
import { linearToMathAst, mathAstToLinear } from '../linear';
import { mathAstToOmml } from '../omml';
import { nodesText } from '../ast';

describe('linear (LaTeX-style) → Math AST', () => {
  test('plain identifiers and numbers', () => {
    expect(linearToMathAst('x')).toEqual([{ type: 'run', text: 'x' }]);
    expect(nodesText(linearToMathAst('2x'))).toBe('2x');
  });

  test('fraction via \\frac and via /', () => {
    const frac = linearToMathAst('\\frac{a}{b}');
    expect(frac[0]).toMatchObject({ type: 'fraction' });
    const slash = linearToMathAst('a/b');
    expect(slash[0]).toMatchObject({ type: 'fraction' });
  });

  test('superscript, subscript, and both', () => {
    expect(linearToMathAst('x^2')[0]).toMatchObject({ type: 'sup' });
    expect(linearToMathAst('x_i')[0]).toMatchObject({ type: 'sub' });
    expect(linearToMathAst('x_i^2')[0]).toMatchObject({ type: 'subSup' });
  });

  test('braced groups for multi-char scripts', () => {
    const ast = linearToMathAst('e^{i\\pi}');
    expect(ast[0]).toMatchObject({ type: 'sup' });
    // The exponent contains iπ.
    expect(nodesText(ast)).toContain('π');
  });

  test('square and nth roots', () => {
    expect(linearToMathAst('\\sqrt{x}')[0]).toMatchObject({ type: 'radical', degree: [] });
    const nth = linearToMathAst('\\sqrt[3]{x}');
    expect(nth[0]).toMatchObject({ type: 'radical' });
    expect((nth[0] as { degree: unknown[] }).degree.length).toBe(1);
  });

  test('n-ary sum with limits', () => {
    const ast = linearToMathAst('\\sum_{i=1}^{n}');
    expect(ast[0]).toMatchObject({ type: 'nary', operator: '∑' });
  });

  test('greek letters and symbols', () => {
    expect(nodesText(linearToMathAst('\\alpha'))).toBe('α');
    expect(nodesText(linearToMathAst('\\leq'))).toBe('≤');
    expect(nodesText(linearToMathAst('\\pm'))).toBe('±');
  });

  test('parenthesised delimiter', () => {
    expect(linearToMathAst('(a+b)')[0]).toMatchObject({ type: 'delimiter', open: '(', close: ')' });
  });

  test('the quadratic formula parses and serializes to OMML', () => {
    const ast = linearToMathAst('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
    const omml = mathAstToOmml({ display: 'inline', body: ast });
    expect(omml).toContain('<m:f>');
    expect(omml).toContain('<m:rad>');
    expect(omml).toContain('<m:sSup>');
  });

  test('round-trips through the linear serializer', () => {
    const src = 'x^2+y^2=r^2';
    const ast = linearToMathAst(src);
    // Re-parsing the serialized form yields the same structure.
    expect(linearToMathAst(mathAstToLinear(ast))).toEqual(ast);
  });

  test('unknown command degrades to its literal name (nothing dropped)', () => {
    expect(nodesText(linearToMathAst('\\foo'))).toBe('foo');
  });
});
