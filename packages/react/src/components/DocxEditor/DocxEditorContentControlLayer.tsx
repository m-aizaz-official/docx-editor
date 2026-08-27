import { useCallback, type RefObject, type ReactElement } from 'react';
import type { Translations } from '@sofcom/docx-editor-react/i18n-internal';
import { en as defaultLocale } from '@sofcom/docx-editor-react/i18n-internal';
import { ContentControlWidgets } from './ContentControlWidgets';
import type { PagedEditorRef } from './PagedEditor';

export function DocxEditorContentControlLayer({
  containerRef,
  pagedEditorRef,
  onUpdateTableOfContents,
  i18n,
}: {
  containerRef: RefObject<HTMLElement | null>;
  pagedEditorRef: RefObject<PagedEditorRef | null>;
  onUpdateTableOfContents: (position: number) => void;
  i18n: Translations | undefined;
}): ReactElement {
  const getView = useCallback(() => pagedEditorRef.current?.getView() ?? null, [pagedEditorRef]);

  return (
    <ContentControlWidgets
      containerRef={containerRef}
      getView={getView}
      onUpdateTableOfContents={onUpdateTableOfContents}
      tocUpdateLabel={
        i18n?.contextMenu?.updateTableOfContents ?? defaultLocale.contextMenu.updateTableOfContents
      }
    />
  );
}
