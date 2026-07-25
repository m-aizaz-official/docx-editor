/**
 * Format Painter — copy the character formatting (marks) from one selection and
 * apply it to another, like Word's paintbrush. Framework-agnostic so both
 * adapters share the capture/apply logic; the adapters own the toolbar button,
 * the armed state, and the "apply on next selection" wiring.
 *
 * `captureMarksFromSelection` reads the formatting at the START of the current
 * selection (Word copies the source's formatting, not the intersection).
 * `applyCapturedMarks` REPLACES the target range's character marks with the
 * captured set (Word overwrites formatting rather than toggling).
 */

import type { Command, EditorState } from 'prosemirror-state';
import type { Mark } from 'prosemirror-model';

/** A captured formatting snapshot. Opaque to callers; pass back to apply. */
export interface CapturedFormatting {
  marks: Mark[];
}

/** Capture the character formatting at the start of the current selection. */
export function captureMarksFromSelection(state: EditorState): CapturedFormatting {
  const { from, to, empty, $from } = state.selection;

  if (empty) {
    return { marks: [...(state.storedMarks ?? $from.marks())] };
  }

  // The first text node inside the selection defines the source formatting.
  let marks: readonly Mark[] | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (marks) return false;
    if (node.isText) {
      marks = node.marks;
      return false;
    }
    return true;
  });

  return { marks: [...(marks ?? $from.marks())] };
}

/**
 * Replace the character marks over the current (non-empty) selection with the
 * captured formatting. No-op (returns false) for a collapsed selection — there
 * is nothing to paint onto.
 */
export function applyCapturedMarks(captured: CapturedFormatting): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;

    if (dispatch) {
      // Rebind captured marks to this state's schema so MarkType identity
      // matches the EditorView (Vite can duplicate extension modules).
      const marks = captured.marks
        .map((m) => state.schema.marks[m.type.name]?.create(m.attrs))
        .filter((m): m is Mark => m != null);

      let tr = state.tr;
      // Strip every existing mark in the range first — Format Painter overwrites.
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isText && node.marks.length > 0) {
          const start = Math.max(from, pos);
          const end = Math.min(to, pos + node.nodeSize);
          for (const mark of node.marks) tr = tr.removeMark(start, end, mark.type);
        }
      });
      // Then lay down the captured formatting.
      for (const mark of marks) tr = tr.addMark(from, to, mark);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Whether a captured snapshot has any formatting worth painting. */
export function hasCapturedFormatting(captured: CapturedFormatting | null): boolean {
  return !!captured && captured.marks.length > 0;
}
