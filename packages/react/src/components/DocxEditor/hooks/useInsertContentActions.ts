/**
 * Insert-content actions for the toolbar: the Symbol picker and the Equation
 * editor. Owns both dialogs' open/close state and the PM transactions that
 * insert a chosen symbol (carrying its font, like Word) or a `math` node built
 * from linear (LaTeX-style) input. Kept out of DocxEditor to keep that file
 * within its size budget.
 */

import { useCallback, useMemo } from 'react';
import type { EditorView } from 'prosemirror-view';
import { mathAttrsFromLinear } from '@docx-editor.dev/core/math';
import { useInsertSymbolDialog } from '../../dialogs/InsertSymbolDialog';
import { useEquationDialog } from '../../dialogs/EquationDialog';

interface FontLike {
  name: string;
}

export interface UseInsertContentActionsOptions {
  getActiveEditorView: () => EditorView | null | undefined;
  focusActiveEditor: () => void;
  documentFonts: ReadonlyArray<FontLike>;
  fontFamilies?: ReadonlyArray<string | FontLike>;
}

export function useInsertContentActions({
  getActiveEditorView,
  focusActiveEditor,
  documentFonts,
  fontFamilies,
}: UseInsertContentActionsOptions) {
  const symbolDialog = useInsertSymbolDialog();
  const handleSymbolInsert = useCallback(
    (symbol: string, font?: string) => {
      const view = getActiveEditorView();
      if (!view) return;
      // A plain insertText transaction picks up the `insertion` mark
      // automatically when in suggesting mode, so tracked changes work for free.
      const { from } = view.state.selection;
      let tr = view.state.tr.insertText(symbol);
      // Word inserts a symbol carrying its picked font (rFonts) — apply a
      // fontFamily mark over the inserted range when a specific font is chosen.
      const fontMark = view.state.schema.marks.fontFamily;
      if (font && fontMark) {
        tr = tr.addMark(from, from + symbol.length, fontMark.create({ ascii: font, hAnsi: font }));
      }
      view.dispatch(tr);
      symbolDialog.addRecent(symbol);
      focusActiveEditor();
    },
    [getActiveEditorView, focusActiveEditor, symbolDialog]
  );

  const equationDialog = useEquationDialog();
  const handleEquationInsert = useCallback(
    (linear: string, display: 'inline' | 'block') => {
      const view = getActiveEditorView();
      if (!view) return;
      const mathType = view.state.schema.nodes.math;
      if (!mathType) return;
      const node = mathType.create(mathAttrsFromLinear(linear, display));
      view.dispatch(view.state.tr.replaceSelectionWith(node, false).scrollIntoView());
      equationDialog.close();
      focusActiveEditor();
    },
    [getActiveEditorView, focusActiveEditor, equationDialog]
  );

  // Font names offered by the symbol picker's font dropdown.
  const symbolFonts = useMemo(() => {
    const names = new Set<string>();
    for (const f of documentFonts) names.add(f.name);
    for (const f of fontFamilies ?? []) names.add(typeof f === 'string' ? f : f.name);
    return Array.from(names);
  }, [documentFonts, fontFamilies]);

  return { symbolDialog, handleSymbolInsert, equationDialog, handleEquationInsert, symbolFonts };
}
