/**
 * Insert / edit Equation dialog. Users type a linear (LaTeX-style) expression,
 * see a live preview rendered by the in-house math renderer, and insert it.
 * A structure palette inserts common templates; a gallery offers presets.
 *
 * On insert the linear string becomes a `math` node (OMML + plainText) via the
 * shared `mathAttrsFromLinear` helper — the same OMML the serializer round-trips.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { renderMathNodes, linearToMathAst } from '@sofcom/docx-editor-core/math';
import { useTranslation } from '../../i18n';

export interface EquationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Insert the equation as (linear source, block?). */
  onInsert: (linear: string, display: 'inline' | 'block') => void;
  /** Seed the editor when editing an existing equation. */
  initialLinear?: string;
}

interface PaletteItem {
  label: string;
  /** Snippet inserted at the caret; `$` marks where the caret should land. */
  snippet: string;
}

const PALETTE: PaletteItem[] = [
  { label: 'x/y', snippet: '\\frac{$}{}' },
  { label: 'x²', snippet: '^{$}' },
  { label: 'xᵢ', snippet: '_{$}' },
  { label: '√', snippet: '\\sqrt{$}' },
  { label: 'ⁿ√', snippet: '\\sqrt[$]{}' },
  { label: '∑', snippet: '\\sum_{$}^{} ' },
  { label: '∏', snippet: '\\prod_{$}^{} ' },
  { label: '∫', snippet: '\\int_{$}^{} ' },
  { label: '( )', snippet: '($)' },
  { label: 'α', snippet: '\\alpha ' },
  { label: 'π', snippet: '\\pi ' },
  { label: '≤', snippet: '\\leq ' },
  { label: '≥', snippet: '\\geq ' },
  { label: '≠', snippet: '\\neq ' },
  { label: '×', snippet: '\\times ' },
  { label: '→', snippet: '\\to ' },
];

const GALLERY: { name: string; linear: string }[] = [
  { name: 'Quadratic formula', linear: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
  { name: 'Pythagorean', linear: 'a^2+b^2=c^2' },
  { name: 'Sum', linear: '\\sum_{i=1}^{n} i=\\frac{n(n+1)}{2}' },
  { name: 'Integral', linear: '\\int_{a}^{b} f(x)dx' },
  { name: "Euler's identity", linear: 'e^{i\\pi}+1=0' },
  { name: 'Limit', linear: '\\frac{d}{dx}x^n=nx^{n-1}' },
];

const OVERLAY: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--doc-overlay)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};
const DIALOG: CSSProperties = {
  background: 'var(--doc-surface)',
  borderRadius: '8px',
  boxShadow: '0 4px 20px var(--doc-shadow)',
  width: '560px',
  maxWidth: '92vw',
  maxHeight: '86vh',
  display: 'flex',
  flexDirection: 'column',
};

export function EquationDialog({
  isOpen,
  onClose,
  onInsert,
  initialLinear = '',
}: EquationDialogProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialLinear);
  const [display, setDisplay] = useState<'inline' | 'block'>('inline');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialLinear);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen, initialLinear]);

  const nodes = useMemo(() => {
    try {
      return linearToMathAst(value);
    } catch {
      return [];
    }
  }, [value]);

  // Live preview — rebuild the rendered math whenever the input changes.
  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    host.textContent = '';
    if (nodes.length > 0) host.appendChild(renderMathNodes(nodes, { fontSize: 26 }));
  }, [nodes]);

  const insertSnippet = useCallback(
    (snippet: string) => {
      const el = inputRef.current;
      if (!el) return;
      const caretMark = snippet.indexOf('$');
      const clean = snippet.replace('$', '');
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + clean + value.slice(end);
      setValue(next);
      const caret = start + (caretMark >= 0 ? caretMark : clean.length);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [value]
  );

  const handleInsert = useCallback(() => {
    if (!value.trim()) return;
    onInsert(value, display);
  }, [value, display, onInsert]);

  if (!isOpen) return null;

  return (
    <div
      className="docx-equation-dialog-overlay"
      style={OVERLAY}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleInsert();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('dialogs.equation.title')}
    >
      <div className="docx-equation-dialog" style={DIALOG} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--doc-border)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--doc-text)' }}>
            {t('dialogs.equation.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.closeDialog')}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '22px',
              cursor: 'pointer',
              color: 'var(--doc-text-muted)',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflow: 'auto' }}>
          {/* Live preview */}
          <div
            ref={previewRef}
            className="docx-equation-preview"
            style={{
              minHeight: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              background: 'var(--doc-bg-subtle)',
              borderRadius: '4px',
              color: 'var(--doc-text)',
              marginBottom: '12px',
              overflowX: 'auto',
            }}
          />

          {/* Structure palette */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
            {PALETTE.map((p) => (
              <button
                key={p.label}
                type="button"
                title={p.snippet.replace('$', '')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertSnippet(p.snippet)}
                style={{
                  minWidth: '36px',
                  height: '32px',
                  padding: '0 8px',
                  border: '1px solid var(--doc-border)',
                  borderRadius: '4px',
                  background: 'var(--doc-surface)',
                  color: 'var(--doc-text)',
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Linear input */}
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('dialogs.equation.placeholder')}
            spellCheck={false}
            rows={2}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid var(--doc-border-input)',
              background: 'var(--doc-surface)',
              color: 'var(--doc-text)',
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              fontSize: '14px',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          {/* Gallery */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--doc-text-muted)', marginBottom: '6px' }}>
              {t('dialogs.equation.gallery')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {GALLERY.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => setValue(g.linear)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--doc-border)',
                    borderRadius: '4px',
                    background: 'var(--doc-bg-subtle)',
                    color: 'var(--doc-text)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderTop: '1px solid var(--doc-border)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--doc-text)',
            }}
          >
            <input
              type="checkbox"
              checked={display === 'block'}
              onChange={(e) => setDisplay(e.target.checked ? 'block' : 'inline')}
            />
            {t('dialogs.equation.displayMode')}
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="docx-equation-cancel"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '4px',
                border: '1px solid var(--doc-border-input)',
                background: 'var(--doc-bg-subtle)',
                color: 'var(--doc-text)',
                cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="docx-equation-insert"
              onClick={handleInsert}
              disabled={!value.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                background: value.trim() ? 'var(--doc-primary)' : 'var(--doc-border-input)',
                color: value.trim() ? 'var(--doc-on-primary)' : 'var(--doc-text-muted)',
                cursor: value.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {t('common.insert')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Open/close state for the equation dialog. */
export function useEquationDialog(): {
  isOpen: boolean;
  initialLinear: string;
  open: (initialLinear?: string) => void;
  close: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [initialLinear, setInitialLinear] = useState('');
  const open = useCallback((linear = '') => {
    setInitialLinear(linear);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, initialLinear, open, close };
}

export default EquationDialog;
