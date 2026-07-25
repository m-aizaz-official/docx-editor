import { describe, test, expect } from 'bun:test';
import { ommlToMathAst, mathAstToOmml } from '../omml';
import { nodesText } from '../ast';
import type { MathAst } from '../ast';

/** Parse → serialize → parse and assert the AST is structurally stable. */
function roundTrip(omml: string): MathAst {
  const ast = ommlToMathAst(omml);
  const reparsed = ommlToMathAst(mathAstToOmml(ast));
  expect(reparsed).toEqual(ast);
  return ast;
}

describe('OMML ⇄ Math AST', () => {
  test('parses a simple run', () => {
    const ast = ommlToMathAst('<m:oMath><m:r><m:t>x</m:t></m:r></m:oMath>');
    expect(ast.display).toBe('inline');
    expect(ast.body).toEqual([{ type: 'run', text: 'x' }]);
  });

  test('parses oMathPara as block', () => {
    const ast = ommlToMathAst(
      '<m:oMathPara><m:oMath><m:r><m:t>y</m:t></m:r></m:oMath></m:oMathPara>'
    );
    expect(ast.display).toBe('block');
  });

  test('fraction round-trips', () => {
    const ast = roundTrip(
      '<m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath>'
    );
    expect(ast.body[0]).toMatchObject({ type: 'fraction' });
    expect(nodesText(ast.body)).toBe('a/b');
  });

  test('superscript round-trips', () => {
    const ast = roundTrip(
      '<m:oMath><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:oMath>'
    );
    expect(ast.body[0]).toMatchObject({ type: 'sup' });
    expect(nodesText(ast.body)).toBe('x^2');
  });

  test('subscript + subSup round-trip', () => {
    roundTrip(
      '<m:oMath><m:sSub><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sub><m:r><m:t>i</m:t></m:r></m:sub></m:sSub></m:oMath>'
    );
    roundTrip(
      '<m:oMath><m:sSubSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sub><m:r><m:t>i</m:t></m:r></m:sub><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSubSup></m:oMath>'
    );
  });

  test('radical (square + nth root) round-trips', () => {
    const sqrt = roundTrip(
      '<m:oMath><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e><m:r><m:t>x</m:t></m:r></m:e></m:rad></m:oMath>'
    );
    expect(sqrt.body[0]).toMatchObject({ type: 'radical', degree: [] });
    roundTrip(
      '<m:oMath><m:rad><m:deg><m:r><m:t>3</m:t></m:r></m:deg><m:e><m:r><m:t>x</m:t></m:r></m:e></m:rad></m:oMath>'
    );
  });

  test('n-ary operator round-trips with its char', () => {
    const ast = roundTrip(
      '<m:oMath><m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub><m:r><m:t>i</m:t></m:r></m:sub><m:sup><m:r><m:t>n</m:t></m:r></m:sup><m:e><m:r><m:t>i</m:t></m:r></m:e></m:nary></m:oMath>'
    );
    expect(ast.body[0]).toMatchObject({ type: 'nary', operator: '∑' });
  });

  test('delimiter round-trips its brackets', () => {
    const ast = roundTrip(
      '<m:oMath><m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr><m:e><m:r><m:t>a</m:t></m:r></m:e></m:d></m:oMath>'
    );
    expect(ast.body[0]).toMatchObject({ type: 'delimiter', open: '(', close: ')' });
  });

  test('matrix round-trips', () => {
    roundTrip(
      '<m:oMath><m:m><m:mr><m:e><m:r><m:t>a</m:t></m:r></m:e><m:e><m:r><m:t>b</m:t></m:r></m:e></m:mr><m:mr><m:e><m:r><m:t>c</m:t></m:r></m:e><m:e><m:r><m:t>d</m:t></m:r></m:e></m:mr></m:m></m:oMath>'
    );
  });

  test('unmodeled OMML survives verbatim as a raw node', () => {
    const weird =
      '<m:oMath><m:limLow><m:e><m:r><m:t>lim</m:t></m:r></m:e><m:lim><m:r><m:t>x</m:t></m:r></m:lim></m:limLow></m:oMath>';
    const ast = ommlToMathAst(weird);
    expect(ast.body[0].type).toBe('raw');
    // Re-serializing preserves the original element.
    expect(mathAstToOmml(ast)).toContain('m:limLow');
  });

  test('escapes hostile text on serialize', () => {
    const ast: MathAst = { display: 'inline', body: [{ type: 'run', text: 'a<b&c>' }] };
    const omml = mathAstToOmml(ast);
    expect(omml).toContain('a&lt;b&amp;c&gt;');
    // And it parses back to the original text.
    expect(nodesText(ommlToMathAst(omml).body)).toBe('a<b&c>');
  });

  test('empty / blank input yields empty inline AST', () => {
    expect(ommlToMathAst('')).toEqual({ display: 'inline', body: [] });
  });
});
