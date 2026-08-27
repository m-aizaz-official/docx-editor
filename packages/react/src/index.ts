/**
 * @sofcom/docx-editor-react
 *
 * Curated root entry for the documented React editor API. Advanced surfaces
 * stay public through explicit subpaths:
 * - `@sofcom/docx-editor-react/ui`
 * - `@sofcom/docx-editor-react/dialogs`
 * - `@sofcom/docx-editor-react/hooks`
 * - `@sofcom/docx-editor-react/plugin-api`
 *
 * Framework-agnostic document utilities live in `@sofcom/docx-editor-core`.
 * Agent panel support is bundled into the React adapter.
 *
 * @packageDocumentation
 * @public
 */

export const VERSION = '0.0.2';

// Main editor contract
export {
  DocxEditor,
  type DocxEditorProps,
  type DocxEditorRef,
  type EditorMode,
} from './components/DocxEditor';
export { renderAsync, type RenderAsyncOptions, type DocxEditorHandle } from './renderAsync';

// Document factory helpers — re-exported from `@sofcom/docx-editor-core` so
// the common "spawn a blank editor" affordance is available without forcing
// consumers to add `-core` to their dependency tree alongside `-react`.
export {
  createEmptyDocument,
  createDocumentWithText,
  type CreateEmptyDocumentOptions,
} from '@sofcom/docx-editor-core';

// i18n contract — runtime only. Locale string types (LocaleStrings,
// Translations, PartialLocaleStrings, TranslationKey) live in
// Translation types are internal to the React adapter and bundled with it.
export { LocaleProvider, useTranslation, type LocaleProviderProps } from './i18n';
