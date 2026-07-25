import { describe, test, expect } from 'bun:test';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema';
import { restartNumbering, continueNumbering, getListRestartState } from './paragraph';
import { computeListMarker } from '../../flow-model/buildBoxTree/listMarkers';
import { mergeRestartOverridesIntoNumbering } from '../conversion/fromProseDoc/numbering';
import type { NumberingDefinitions } from '../../types/document';

/** A numbered-list paragraph with the attrs a parsed decimal list carries. */
function listPara(text: string, numId: number, extra: Record<string, unknown> = {}) {
  return schema.node(
    'paragraph',
    { numPr: { numId, ilvl: 0 }, listNumFmt: 'decimal', listIsBullet: false, ...extra },
    [schema.text(text)]
  );
}

/**
 * Build an editor whose body is `paras`, with the cursor placed inside the
 * paragraph at `cursorChild`.
 */
function setup(paras: PMNode[], cursorChild: number) {
  const doc = schema.node('doc', { defaultTabStopTwips: null, watermark: null }, paras);
  let cursorPos = 1;
  doc.forEach((_node, offset, index) => {
    if (index === cursorChild) cursorPos = offset + 1;
  });
  let state = EditorState.create({ doc });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, cursorPos)));
  const dispatch = (tr: Transaction) => {
    state = state.apply(tr);
  };
  return {
    dispatch,
    get state() {
      return state;
    },
  };
}

/** Render each paragraph's marker in document order, restarting counters fresh. */
function markers(doc: PMNode): (string | null)[] {
  const counters = new Map<number, number[]>();
  const seen = new Set<string>();
  const out: (string | null)[] = [];
  doc.forEach((node) => {
    if (node.type.name === 'paragraph') {
      out.push(computeListMarker(node.attrs as never, counters, seen));
    }
  });
  return out;
}

describe('restartNumbering command', () => {
  test('reassigns the target paragraph and the rest of its list to a fresh numId', () => {
    const ed = setup(
      [
        listPara('One', 2, { listAbstractNumId: 5 }),
        listPara('Two', 2, { listAbstractNumId: 5 }),
        listPara('Three', 2, { listAbstractNumId: 5 }),
      ],
      1
    );
    restartNumbering(ed.state, ed.dispatch);

    const { doc } = ed.state;
    // Paragraph before the target keeps the original numId.
    expect(doc.child(0).attrs.numPr).toEqual({ numId: 2, ilvl: 0 });
    expect(doc.child(0).attrs.listStartOverride ?? null).toBeNull();
    // Target + rest move to a new numId; only the target carries the override.
    expect(doc.child(1).attrs.numPr).toEqual({ numId: 3, ilvl: 0 });
    expect(doc.child(1).attrs.listStartOverride).toBe(1);
    expect(doc.child(2).attrs.numPr).toEqual({ numId: 3, ilvl: 0 });
    expect(doc.child(2).attrs.listStartOverride ?? null).toBeNull();
    // The marker format (abstract) is preserved so rendering is unchanged.
    expect(doc.child(1).attrs.listAbstractNumId).toBe(5);
  });

  test('the counter engine renders the restarted list from 1', () => {
    const ed = setup(
      [
        listPara('One', 2, { listAbstractNumId: 5 }),
        listPara('Two', 2, { listAbstractNumId: 5 }),
        listPara('Three', 2, { listAbstractNumId: 5 }),
      ],
      1
    );
    // Before restart: 1., 2., 3.
    expect(markers(ed.state.doc)).toEqual(['1.', '2.', '3.']);
    restartNumbering(ed.state, ed.dispatch);
    // After restart at "Two": 1., 1., 2.
    expect(markers(ed.state.doc)).toEqual(['1.', '1.', '2.']);
  });

  test('no-op for bullet lists and non-list paragraphs', () => {
    const bullet = setup([listPara('B', 1, { listIsBullet: true })], 0);
    expect(restartNumbering(bullet.state, bullet.dispatch)).toBe(false);

    const plain = setup([schema.node('paragraph', {}, [schema.text('plain')])], 0);
    expect(restartNumbering(plain.state, plain.dispatch)).toBe(false);
  });
});

describe('continueNumbering command', () => {
  test('reconnects a restarted list to the preceding list and clears the override', () => {
    // Simulate a document already split by a prior restart: numId 2 then numId 3.
    const ed = setup(
      [
        listPara('One', 2, { listAbstractNumId: 5 }),
        listPara('Two', 3, { listAbstractNumId: 5, listStartOverride: 1 }),
        listPara('Three', 3, { listAbstractNumId: 5 }),
      ],
      1
    );
    expect(markers(ed.state.doc)).toEqual(['1.', '1.', '2.']);
    continueNumbering(ed.state, ed.dispatch);

    const { doc } = ed.state;
    expect(doc.child(1).attrs.numPr).toEqual({ numId: 2, ilvl: 0 });
    expect(doc.child(1).attrs.listStartOverride ?? null).toBeNull();
    expect(doc.child(2).attrs.numPr).toEqual({ numId: 2, ilvl: 0 });
    // Renders as a single continuous list again.
    expect(markers(doc)).toEqual(['1.', '2.', '3.']);
  });
});

describe('getListRestartState', () => {
  test('reports numbered-list membership and restart presence', () => {
    const plain = setup([schema.node('paragraph', {}, [schema.text('x')])], 0);
    expect(getListRestartState(plain.state)).toEqual({ isNumberedList: false, hasRestart: false });

    const numbered = setup([listPara('n', 2)], 0);
    expect(getListRestartState(numbered.state)).toEqual({
      isNumberedList: true,
      hasRestart: false,
    });

    const restarted = setup([listPara('n', 3, { listStartOverride: 1 })], 0);
    expect(getListRestartState(restarted.state)).toEqual({
      isNumberedList: true,
      hasRestart: true,
    });

    const bullet = setup([listPara('b', 1, { listIsBullet: true })], 0);
    expect(getListRestartState(bullet.state)).toEqual({
      isNumberedList: false,
      hasRestart: false,
    });
  });
});

describe('mergeRestartOverridesIntoNumbering', () => {
  const baseNumbering: NumberingDefinitions = {
    abstractNums: [
      {
        abstractNumId: 5,
        multiLevelType: 'hybridMultilevel',
        levels: [{ ilvl: 0, start: 1, numFmt: 'decimal', lvlText: '%1.' }],
      },
    ],
    nums: [{ numId: 2, abstractNumId: 5 }],
  };

  test('backs a fresh restart numId with a w:num referencing the original abstract', () => {
    const doc = schema.node('doc', { defaultTabStopTwips: null, watermark: null }, [
      listPara('One', 2, { listAbstractNumId: 5 }),
      listPara('Two', 3, { listAbstractNumId: 5, listStartOverride: 1 }),
      listPara('Three', 3, { listAbstractNumId: 5 }),
    ]);
    const merged = mergeRestartOverridesIntoNumbering(baseNumbering, doc)!;

    // Original instance untouched; a new instance for numId 3 was added.
    expect(merged.nums.find((n) => n.numId === 2)?.levelOverrides).toBeUndefined();
    const added = merged.nums.find((n) => n.numId === 3);
    expect(added).toEqual({
      numId: 3,
      abstractNumId: 5,
      levelOverrides: [{ ilvl: 0, startOverride: 1 }],
    });
    // Abstracts are carried through unchanged.
    expect(merged.abstractNums).toBe(baseNumbering.abstractNums);
  });

  test('returns the input unchanged when no paragraph carries a restart', () => {
    const doc = schema.node('doc', { defaultTabStopTwips: null, watermark: null }, [
      listPara('One', 2, { listAbstractNumId: 5 }),
    ]);
    expect(mergeRestartOverridesIntoNumbering(baseNumbering, doc)).toBe(baseNumbering);
  });

  test('merges the override into an already-present instance rather than duplicating', () => {
    const doc = schema.node('doc', { defaultTabStopTwips: null, watermark: null }, [
      listPara('One', 2, { listAbstractNumId: 5, listStartOverride: 1 }),
    ]);
    const merged = mergeRestartOverridesIntoNumbering(baseNumbering, doc)!;
    expect(merged.nums.filter((n) => n.numId === 2)).toHaveLength(1);
    expect(merged.nums.find((n) => n.numId === 2)?.levelOverrides).toEqual([
      { ilvl: 0, startOverride: 1 },
    ]);
  });
});
