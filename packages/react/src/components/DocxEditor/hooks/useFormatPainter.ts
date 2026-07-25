/**
 * Format Painter — copy the current selection's character formatting and paint
 * it onto the next selection the user makes (like Word). Single click paints
 * once; double-click keeps it armed (sticky) until Esc. Painting only fires
 * when the gesture lands on the document (a `.layout-page`), never the toolbar,
 * so the arming click can't paint the source onto itself.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EditorView } from 'prosemirror-view';
import {
  captureMarksFromSelection,
  applyCapturedMarks,
  type CapturedFormatting,
} from '@docx-editor.dev/core/prosemirror';

export interface UseFormatPainterOptions {
  getActiveEditorView: () => EditorView | null | undefined;
  focusActiveEditor: () => void;
}

export interface UseFormatPainterResult {
  /** Whether the painter is armed (drives the toolbar button's active state). */
  formatPainterArmed: boolean;
  /** Arm the painter; `sticky` (double-click) keeps it on across paints. */
  armFormatPainter: (sticky: boolean) => void;
}

export function useFormatPainter({
  getActiveEditorView,
  focusActiveEditor,
}: UseFormatPainterOptions): UseFormatPainterResult {
  const [armed, setArmed] = useState(false);
  const painterRef = useRef<{ captured: CapturedFormatting; sticky: boolean } | null>(null);

  const disarm = useCallback(() => {
    painterRef.current = null;
    setArmed(false);
  }, []);

  const armFormatPainter = useCallback(
    (sticky: boolean) => {
      const view = getActiveEditorView();
      if (!view) return;
      // A click always (re)captures the current selection's formatting; a
      // double-click promotes to sticky. Cancel with Esc (handled below).
      const captured = captureMarksFromSelection(view.state);
      const prev = painterRef.current;
      painterRef.current = { captured, sticky: sticky || (prev?.sticky ?? false) };
      setArmed(true);
      focusActiveEditor();
    },
    [getActiveEditorView, focusActiveEditor]
  );

  // Apply the captured formatting once the user finishes a new selection. A
  // drag ends on `mouseup`; a double-click selects the word on `click`
  // (`e.detail === 2`, after mouseup) — so listen to both, no-op on collapsed.
  useEffect(() => {
    if (!armed) return;
    const applyToCurrentSelection = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest('.layout-page')) return;
      const painter = painterRef.current;
      if (!painter) return;
      const view = getActiveEditorView();
      if (!view) return;
      const { from, to } = view.state.selection;
      if (from === to) return; // nothing selected to paint onto
      applyCapturedMarks(painter.captured)(view.state, view.dispatch);
      if (!painter.sticky) disarm();
      focusActiveEditor();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') disarm();
    };
    window.addEventListener('mouseup', applyToCurrentSelection);
    window.addEventListener('click', applyToCurrentSelection);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mouseup', applyToCurrentSelection);
      window.removeEventListener('click', applyToCurrentSelection);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [armed, getActiveEditorView, focusActiveEditor, disarm]);

  return { formatPainterArmed: armed, armFormatPainter };
}
