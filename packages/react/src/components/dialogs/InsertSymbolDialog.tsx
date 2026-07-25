/**
 * Insert Symbol Dialog Component
 *
 * Modal dialog for inserting special characters and symbols into the document.
 * Provides categorized symbol picker with search functionality.
 *
 * Features:
 * - Categorized symbol groups
 * - Recent symbols
 * - Search functionality
 * - Unicode character display
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useTranslation } from '../../i18n';
import { SYMBOL_CATEGORIES, type SymbolCategory } from './insertSymbolData';

// The categorized glyph data lives in ./insertSymbolData; re-export so the
// public API surface (via ui.ts) is unchanged.
export { SYMBOL_CATEGORIES } from './insertSymbolData';
export type { SymbolCategory } from './insertSymbolData';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for InsertSymbolDialog
 */
export interface InsertSymbolDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /**
   * Callback when a symbol is inserted. `font` is the chosen font family, or
   * an empty string for "(normal text)" (insert with no explicit font).
   */
  onInsert: (symbol: string, font?: string) => void;
  /** Recently used symbols */
  recentSymbols?: string[];
  /** Extra fonts to offer in the font picker (e.g. the document's fonts). */
  fonts?: string[];
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

// ============================================================================
// STYLES
// ============================================================================

const DIALOG_OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--doc-overlay)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const DIALOG_CONTENT_STYLE: CSSProperties = {
  backgroundColor: 'var(--doc-surface)',
  borderRadius: '8px',
  boxShadow: '0 4px 20px var(--doc-shadow)',
  minWidth: '450px',
  maxWidth: '550px',
  width: '100%',
  margin: '20px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
};

const DIALOG_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid var(--doc-border)',
};

const DIALOG_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: 'var(--doc-text)',
};

const CLOSE_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '20px',
  cursor: 'pointer',
  color: 'var(--doc-text-muted)',
  padding: '4px 8px',
  lineHeight: 1,
};

const DIALOG_BODY_STYLE: CSSProperties = {
  padding: '20px',
  flex: 1,
  overflow: 'auto',
};

const SEARCH_INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--doc-border-input)',
  borderRadius: '4px',
  fontSize: '14px',
  marginBottom: '16px',
  boxSizing: 'border-box',
};

const CATEGORY_TABS_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginBottom: '16px',
};

const CATEGORY_TAB_STYLE: CSSProperties = {
  padding: '6px 12px',
  border: '1px solid var(--doc-border-input)',
  borderRadius: '4px',
  backgroundColor: 'var(--doc-surface)',
  cursor: 'pointer',
  fontSize: '12px',
  transition: 'all 0.15s',
};

const CATEGORY_TAB_ACTIVE_STYLE: CSSProperties = {
  ...CATEGORY_TAB_STYLE,
  backgroundColor: 'var(--doc-primary)',
  borderColor: 'var(--doc-primary)',
  color: 'var(--doc-on-primary)',
};

const SYMBOLS_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: '4px',
  maxHeight: '250px',
  overflow: 'auto',
};

const SYMBOL_BUTTON_STYLE: CSSProperties = {
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--doc-border)',
  borderRadius: '4px',
  backgroundColor: 'var(--doc-surface)',
  cursor: 'pointer',
  fontSize: '18px',
  transition: 'all 0.15s',
};

// Reserves the preview's vertical space even when nothing is
// hovered/selected, so moving the cursor between symbols never remounts the
// preview, reflows the grid, and shifts the hovered cell (which caused a
// hover-flicker feedback loop).
const PREVIEW_RESERVE_STYLE: CSSProperties = {
  marginTop: '16px',
  minHeight: '84px',
};

const PREVIEW_SECTION_STYLE: CSSProperties = {
  padding: '12px',
  backgroundColor: 'var(--doc-bg-subtle)',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const PREVIEW_SYMBOL_STYLE: CSSProperties = {
  fontSize: '36px',
  width: '60px',
  height: '60px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--doc-surface)',
  borderRadius: '4px',
  border: '1px solid var(--doc-border)',
};

const PREVIEW_INFO_STYLE: CSSProperties = {
  flex: 1,
};

const DIALOG_FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  padding: '16px 20px',
  borderTop: '1px solid var(--doc-border)',
};

const BUTTON_BASE_STYLE: CSSProperties = {
  padding: '10px 20px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
};

const PRIMARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--doc-primary)',
  color: 'var(--doc-on-primary)',
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--doc-bg-subtle)',
  color: 'var(--doc-text)',
  border: '1px solid var(--doc-border-input)',
};

const DISABLED_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--doc-border-input)',
  color: 'var(--doc-text-muted)',
  cursor: 'not-allowed',
};

// ============================================================================
// SYMBOL DATA
// ============================================================================

/**
 * Get all symbols flattened
 */
function getAllSymbols(): string[] {
  return SYMBOL_CATEGORIES.flatMap((cat) => cat.symbols);
}

/**
 * A named special character with an optional keyboard shortcut, matching the
 * "Special Characters" tab in Word's Insert Symbol dialog.
 */
export interface SpecialCharacter {
  char: string;
  name: string;
  shortcut?: string;
}

/** Word's Special Characters tab set (typography + spaces + quotes/dashes). */
export const SPECIAL_CHARACTERS: SpecialCharacter[] = [
  { char: '—', name: 'Em Dash', shortcut: 'Alt+Ctrl+Num -' },
  { char: '–', name: 'En Dash', shortcut: 'Ctrl+Num -' },
  { char: '‑', name: 'Non-breaking Hyphen', shortcut: 'Ctrl+Shift+_' },
  { char: '­', name: 'Optional Hyphen', shortcut: 'Ctrl+-' },
  { char: ' ', name: 'Em Space' },
  { char: ' ', name: 'En Space' },
  { char: ' ', name: 'Thin Space' },
  { char: ' ', name: 'Non-breaking Space', shortcut: 'Ctrl+Shift+Space' },
  { char: '©', name: 'Copyright', shortcut: 'Alt+Ctrl+C' },
  { char: '®', name: 'Registered', shortcut: 'Alt+Ctrl+R' },
  { char: '™', name: 'Trademark', shortcut: 'Alt+Ctrl+T' },
  { char: '§', name: 'Section' },
  { char: '¶', name: 'Paragraph' },
  { char: '…', name: 'Ellipsis', shortcut: 'Alt+Ctrl+.' },
  { char: '‘', name: 'Left Single Quote' },
  { char: '’', name: 'Right Single Quote' },
  { char: '“', name: 'Left Double Quote' },
  { char: '”', name: 'Right Double Quote' },
  { char: '†', name: 'Dagger' },
  { char: '‡', name: 'Double Dagger' },
  { char: '‰', name: 'Per Mille' },
  { char: '′', name: 'Prime' },
  { char: '″', name: 'Double Prime' },
];

/**
 * Fonts always offered in the font picker. "(normal text)" inserts with no
 * explicit font so the symbol inherits the run's font, exactly like Word.
 */
export const NORMAL_TEXT_FONT = '';
const BUILT_IN_SYMBOL_FONTS = [
  'Arial',
  'Calibri',
  'Cambria',
  'Cambria Math',
  'Courier New',
  'Segoe UI Symbol',
  'Times New Roman',
  'Wingdings',
];

const TAB_BAR_STYLE: CSSProperties = {
  display: 'flex',
  gap: '4px',
  padding: '0 20px',
  borderBottom: '1px solid var(--doc-border)',
};

const TAB_STYLE: CSSProperties = {
  padding: '10px 14px',
  border: 'none',
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: 'var(--doc-text-muted)',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};

const TAB_ACTIVE_STYLE: CSSProperties = {
  ...TAB_STYLE,
  color: 'var(--doc-primary)',
  borderBottomColor: 'var(--doc-primary)',
};

const FONT_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '12px',
};

const FONT_SELECT_STYLE: CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  borderRadius: '4px',
  border: '1px solid var(--doc-border-input)',
  backgroundColor: 'var(--doc-surface)',
  color: 'var(--doc-text)',
  fontSize: '14px',
};

const SPECIAL_LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  maxHeight: '320px',
  overflow: 'auto',
};

const SPECIAL_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  padding: '8px 10px',
  border: '1px solid transparent',
  borderRadius: '4px',
  background: 'transparent',
  color: 'var(--doc-text)',
  cursor: 'pointer',
  textAlign: 'left',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * InsertSymbolDialog - Modal for inserting special characters
 */
export function InsertSymbolDialog({
  isOpen,
  onClose,
  onInsert,
  recentSymbols = [],
  fonts = [],
  className,
  style,
}: InsertSymbolDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  // State
  const [activeTab, setActiveTab] = useState<'symbols' | 'special'>('symbols');
  const [selectedFont, setSelectedFont] = useState<string>(NORMAL_TEXT_FONT);
  const [selectedCategory, setSelectedCategory] = useState('common');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  // Merge built-in fonts with document fonts, de-duplicated, sorted.
  const fontOptions = useMemo(() => {
    const set = new Set<string>([...BUILT_IN_SYMBOL_FONTS, ...fonts.filter(Boolean)]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fonts]);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSymbol(null);
      setSearchQuery('');
      setHoveredSymbol(null);
      setActiveTab('symbols');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Filter symbols based on search
  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) {
      if (selectedCategory === 'recent') {
        return recentSymbols;
      }
      const category = SYMBOL_CATEGORIES.find((c) => c.name === selectedCategory);
      return category?.symbols || [];
    }

    const query = searchQuery.toLowerCase();
    const allSymbols = getAllSymbols();

    // Search by character or Unicode code point
    return allSymbols.filter((symbol) => {
      const codePoint = symbol.codePointAt(0)?.toString(16).toUpperCase() || '';
      return (
        symbol.includes(query) ||
        codePoint.includes(query.toUpperCase()) ||
        `U+${codePoint}`.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, selectedCategory, recentSymbols]);

  /**
   * Handle symbol click
   */
  const handleSymbolClick = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
  }, []);

  /**
   * Handle symbol double-click (insert immediately). Special characters always
   * insert with the run's own font; only the Symbols tab honors the font picker.
   */
  const handleSymbolDoubleClick = useCallback(
    (symbol: string) => {
      onInsert(symbol, activeTab === 'symbols' ? selectedFont || undefined : undefined);
    },
    [onInsert, activeTab, selectedFont]
  );

  /**
   * Handle insert
   */
  const handleInsert = useCallback(() => {
    if (selectedSymbol) {
      onInsert(selectedSymbol, activeTab === 'symbols' ? selectedFont || undefined : undefined);
    }
  }, [selectedSymbol, onInsert, activeTab, selectedFont]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selectedSymbol) {
        e.preventDefault();
        handleInsert();
      }
    },
    [onClose, selectedSymbol, handleInsert]
  );

  /**
   * Handle overlay click
   */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  /**
   * Get symbol info
   */
  const getSymbolInfo = (symbol: string | null) => {
    if (!symbol) return null;
    const codePoint = symbol.codePointAt(0);
    return {
      character: symbol,
      codePoint: codePoint ? `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}` : '',
      decimal: codePoint || 0,
    };
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const displaySymbol = hoveredSymbol || selectedSymbol;
  const symbolInfo = getSymbolInfo(displaySymbol);
  const canInsert = selectedSymbol !== null;

  // Categories including recent
  const categoryLabelMap: Record<string, string> = {
    common: t('dialogs.insertSymbol.categories.common'),
    arrows: t('dialogs.insertSymbol.categories.arrows'),
    math: t('dialogs.insertSymbol.categories.math'),
    greek: t('dialogs.insertSymbol.categories.greek'),
    shapes: t('dialogs.insertSymbol.categories.shapes'),
    punctuation: t('dialogs.insertSymbol.categories.punctuation'),
    currency: t('dialogs.insertSymbol.categories.currency'),
    music: t('dialogs.insertSymbol.categories.music'),
    emoji: t('dialogs.insertSymbol.categories.emoji'),
  };
  const categories = [
    ...(recentSymbols.length > 0 ? [{ name: 'recent', label: 'Recent' }] : []),
    ...SYMBOL_CATEGORIES.map((c) => ({ name: c.name, label: categoryLabelMap[c.name] || c.label })),
  ];

  return (
    <div
      className={`docx-insert-symbol-dialog-overlay ${className || ''}`}
      style={{ ...DIALOG_OVERLAY_STYLE, ...style }}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="insert-symbol-dialog-title"
    >
      <div className="docx-insert-symbol-dialog" style={DIALOG_CONTENT_STYLE}>
        {/* Header */}
        <div className="docx-insert-symbol-dialog-header" style={DIALOG_HEADER_STYLE}>
          <h2 id="insert-symbol-dialog-title" style={DIALOG_TITLE_STYLE}>
            {t('dialogs.insertSymbol.title')}
          </h2>
          <button
            type="button"
            className="docx-insert-symbol-dialog-close"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label={t('common.closeDialog')}
          >
            &times;
          </button>
        </div>

        {/* Tab bar: Symbols | Special Characters (Word parity) */}
        <div className="docx-insert-symbol-tabs" style={TAB_BAR_STYLE}>
          <button
            type="button"
            onClick={() => setActiveTab('symbols')}
            style={activeTab === 'symbols' ? TAB_ACTIVE_STYLE : TAB_STYLE}
          >
            {t('dialogs.insertSymbol.tabSymbols')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('special')}
            style={activeTab === 'special' ? TAB_ACTIVE_STYLE : TAB_STYLE}
          >
            {t('dialogs.insertSymbol.tabSpecial')}
          </button>
        </div>

        {/* Body */}
        <div className="docx-insert-symbol-dialog-body" style={DIALOG_BODY_STYLE}>
          {activeTab === 'symbols' ? (
            <>
              {/* Font picker — inserts the symbol with the chosen font, like Word */}
              <div style={FONT_ROW_STYLE}>
                <label
                  htmlFor="insert-symbol-font"
                  style={{ fontSize: '13px', color: 'var(--doc-text-muted)' }}
                >
                  {t('dialogs.insertSymbol.font')}
                </label>
                <select
                  id="insert-symbol-font"
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  style={FONT_SELECT_STYLE}
                >
                  <option value={NORMAL_TEXT_FONT}>{t('dialogs.insertSymbol.normalText')}</option>
                  {fontOptions.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('dialogs.insertSymbol.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={SEARCH_INPUT_STYLE}
              />

              {/* Category tabs */}
              {!searchQuery && (
                <div className="docx-insert-symbol-categories" style={CATEGORY_TABS_STYLE}>
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      style={
                        selectedCategory === cat.name
                          ? CATEGORY_TAB_ACTIVE_STYLE
                          : CATEGORY_TAB_STYLE
                      }
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Symbols grid */}
              <div className="docx-insert-symbol-grid" style={SYMBOLS_GRID_STYLE}>
                {filteredSymbols.map((symbol, index) => (
                  <button
                    key={`${symbol}-${index}`}
                    type="button"
                    onClick={() => handleSymbolClick(symbol)}
                    onDoubleClick={() => handleSymbolDoubleClick(symbol)}
                    onMouseEnter={() => setHoveredSymbol(symbol)}
                    onMouseLeave={() => setHoveredSymbol(null)}
                    style={{
                      ...SYMBOL_BUTTON_STYLE,
                      ...(selectedFont ? { fontFamily: selectedFont } : {}),
                      ...(selectedSymbol === symbol
                        ? {
                            backgroundColor: 'var(--doc-primary-light)',
                            borderColor: 'var(--doc-primary)',
                          }
                        : {}),
                    }}
                    title={`${symbol} - U+${symbol.codePointAt(0)?.toString(16).toUpperCase()}`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>

              {/* No results */}
              {filteredSymbols.length === 0 && (
                <div
                  style={{ textAlign: 'center', padding: '20px', color: 'var(--doc-text-muted)' }}
                >
                  {t('dialogs.insertSymbol.noResults', { query: searchQuery })}
                </div>
              )}
            </>
          ) : (
            /* Special Characters tab */
            <div className="docx-insert-symbol-special" style={SPECIAL_LIST_STYLE}>
              {SPECIAL_CHARACTERS.map((sc) => (
                <button
                  key={sc.name}
                  type="button"
                  onClick={() => setSelectedSymbol(sc.char)}
                  onDoubleClick={() => handleSymbolDoubleClick(sc.char)}
                  style={{
                    ...SPECIAL_ROW_STYLE,
                    ...(selectedSymbol === sc.char
                      ? {
                          backgroundColor: 'var(--doc-primary-light)',
                          borderColor: 'var(--doc-primary)',
                        }
                      : {}),
                  }}
                >
                  <span
                    style={{
                      width: '32px',
                      textAlign: 'center',
                      fontSize: '18px',
                      border: '1px solid var(--doc-border)',
                      borderRadius: '4px',
                      padding: '2px 0',
                    }}
                  >
                    {sc.char}
                  </span>
                  <span style={{ flex: 1 }}>{sc.name}</span>
                  {sc.shortcut && (
                    <span style={{ fontSize: '12px', color: 'var(--doc-text-muted)' }}>
                      {sc.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Preview — the outer wrapper always reserves space so hovering
              between cells never shifts the grid (which would flicker). */}
          <div style={PREVIEW_RESERVE_STYLE}>
            {symbolInfo && (
              <div className="docx-insert-symbol-preview" style={PREVIEW_SECTION_STYLE}>
                <div
                  style={{
                    ...PREVIEW_SYMBOL_STYLE,
                    ...(activeTab === 'symbols' && selectedFont
                      ? { fontFamily: selectedFont }
                      : {}),
                  }}
                >
                  {symbolInfo.character}
                </div>
                <div style={PREVIEW_INFO_STYLE}>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                    {symbolInfo.codePoint}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--doc-text-muted)' }}>
                    {t('dialogs.insertSymbol.decimal', { value: symbolInfo.decimal })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="docx-insert-symbol-dialog-footer" style={DIALOG_FOOTER_STYLE}>
          <button
            type="button"
            className="docx-insert-symbol-dialog-cancel"
            style={SECONDARY_BUTTON_STYLE}
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="docx-insert-symbol-dialog-insert"
            style={canInsert ? PRIMARY_BUTTON_STYLE : DISABLED_BUTTON_STYLE}
            onClick={handleInsert}
            disabled={!canInsert}
          >
            {t('common.insert')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing Insert Symbol dialog state with recent symbols
 */
export function useInsertSymbolDialog(maxRecent = 20): {
  isOpen: boolean;
  recentSymbols: string[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  addRecent: (symbol: string) => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const addRecent = useCallback(
    (symbol: string) => {
      setRecentSymbols((prev) => {
        // Remove if already exists, then add to front
        const filtered = prev.filter((s) => s !== symbol);
        return [symbol, ...filtered].slice(0, maxRecent);
      });
    },
    [maxRecent]
  );

  return { isOpen, recentSymbols, open, close, toggle, addRecent };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all symbol categories
 */
export function getSymbolCategories(): SymbolCategory[] {
  return SYMBOL_CATEGORIES;
}

/**
 * Get symbols by category name
 */
export function getSymbolsByCategory(categoryName: string): string[] {
  const category = SYMBOL_CATEGORIES.find((c) => c.name === categoryName);
  return category?.symbols || [];
}

/**
 * Get symbol Unicode info
 */
export function getSymbolInfo(symbol: string): {
  character: string;
  codePoint: string;
  decimal: number;
  hex: string;
} {
  const code = symbol.codePointAt(0) || 0;
  return {
    character: symbol,
    codePoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
    decimal: code,
    hex: code.toString(16).toUpperCase(),
  };
}

/**
 * Search symbols by query
 */
export function searchSymbols(query: string): string[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  return getAllSymbols().filter((symbol) => {
    const code = symbol.codePointAt(0)?.toString(16).toUpperCase() || '';
    return (
      symbol.includes(query) ||
      code.includes(lowerQuery.toUpperCase()) ||
      `U+${code}`.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get symbol from Unicode code point string
 */
export function symbolFromCodePoint(codePointStr: string): string | null {
  // Handle formats: "U+0041", "0041", "41"
  const cleaned = codePointStr.replace(/^U\+/i, '').replace(/^0x/i, '');
  const code = parseInt(cleaned, 16);

  if (isNaN(code) || code < 0 || code > 0x10ffff) {
    return null;
  }

  return String.fromCodePoint(code);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default InsertSymbolDialog;
