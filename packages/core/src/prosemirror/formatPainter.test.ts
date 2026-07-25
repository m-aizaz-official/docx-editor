import { describe, test, expect } from 'bun:test';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import {
  captureMarksFromSelection,
  applyCapturedMarks,
  hasCapturedFormatting,
} from './formatPainter';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
  marks: {
    bold: { toDOM: () => ['strong', 0] },
    italic: { toDOM: () => ['em', 0] },
    fontSize: { attrs: { size: { default: null } }, toDOM: () => ['span', 0] },
  },
});

/** Build a doc: one paragraph, "AAAABBBB" where AAAA is bold+size, BBBB plain. */
function makeState() {
  const bold = schema.marks.bold.create();
  const size = schema.marks.fontSize.create({ size: 20 });
  const styled = schema.text('AAAA', [bold, size]);
  const plain = schema.text('BBBB');
  const para = schema.nodes.paragraph.create(null, [styled, plain]);
  const doc = schema.nodes.doc.create(null, [para]);
  return EditorState.create({ schema, doc });
}

function selectRange(state: EditorState, from: number, to: number) {
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

describe('Format Painter', () => {
  test('captures marks at the start of the selection', () => {
    // "AAAA" occupies positions 1..5.
    const state = selectRange(makeState(), 1, 5);
    const captured = captureMarksFromSelection(state);
    const names = captured.marks.map((m) => m.type.name).sort();
    expect(names).toEqual(['bold', 'fontSize']);
    expect(hasCapturedFormatting(captured)).toBe(true);
  });

  test('applies captured formatting over a new selection, replacing existing marks', () => {
    const source = selectRange(makeState(), 1, 5); // AAAA (bold+size)
    const captured = captureMarksFromSelection(source);

    // Now select "BBBB" (positions 5..9) and paint.
    let state = selectRange(makeState(), 5, 9);
    applyCapturedMarks(captured)(state, (tr) => {
      state = state.apply(tr);
    });

    // The BBBB range is now bold + size 20.
    const bbbb = state.doc.textBetween(5, 9);
    expect(bbbb).toBe('BBBB');
    const found = { bold: false, size: -1 };
    state.doc.nodesBetween(5, 9, (node) => {
      if (node.isText) {
        if (schema.marks.bold.isInSet(node.marks)) found.bold = true;
        const fs = schema.marks.fontSize.isInSet(node.marks);
        if (fs) found.size = fs.attrs.size as number;
      }
    });
    expect(found.bold).toBe(true);
    expect(found.size).toBe(20);
  });

  test('painting overwrites (does not merge) the target formatting', () => {
    // Capture PLAIN formatting from BBBB, paint onto AAAA → bold/size removed.
    const source = selectRange(makeState(), 5, 9); // BBBB (plain)
    const captured = captureMarksFromSelection(source);
    expect(captured.marks.length).toBe(0);

    let state = selectRange(makeState(), 1, 5); // AAAA (bold+size)
    applyCapturedMarks(captured)(state, (tr) => {
      state = state.apply(tr);
    });

    let anyMark = false;
    state.doc.nodesBetween(1, 5, (node) => {
      if (node.isText && node.marks.length > 0) anyMark = true;
    });
    expect(anyMark).toBe(false);
  });

  test('applying to a collapsed selection is a no-op', () => {
    const captured = captureMarksFromSelection(selectRange(makeState(), 1, 5));
    const collapsed = selectRange(makeState(), 6, 6);
    const ran = applyCapturedMarks(captured)(collapsed, () => {
      throw new Error('should not dispatch on collapsed selection');
    });
    expect(ran).toBe(false);
  });
});
