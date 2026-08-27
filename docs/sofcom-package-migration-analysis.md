# Sofcom Package Migration Analysis

## Scope

This audit covers the repository state before the Sofcom package migration. The repository is a Bun-first monorepo fork of the EigenPal/docx-editor project. The target deliverable is exactly two publishable packages:

- `@sofcom/docx-editor-core`
- `@sofcom/docx-editor-react`

Vue, Nuxt, Agents, and i18n are existing workspace packages, but they are not target deliverables.

## Existing Package Architecture

The repository uses npm-compatible workspace metadata in the root `package.json` and Bun lockfile/configuration. The primary editor implementation is already split into:

- `packages/core`: framework-independent document/editor engine.
- `packages/react`: React adapter, editor component, hooks, toolbar, dialogs, and plugin host.

Additional packages are present:

- `packages/vue`: Vue adapter.
- `packages/nuxt`: Nuxt module around the Vue adapter.
- `packages/agents`: agent bridge, SDK, and UI integrations.
- `packages/i18n`: locale data and translation types.

The existing architecture should be reused. No source duplication or rewrite is required for the Core and React implementations.

## Existing Dependency Graph

```text
packages/react
  -> @docx-editor.dev/core
  -> @docx-editor.dev/i18n
  -> @docx-editor.dev/agents
  -> React and ReactDOM peer dependencies
  -> ProseMirror peer dependencies
  -> Radix Select, clsx, sonner

packages/vue
  -> @docx-editor.dev/core
  -> @docx-editor.dev/i18n
  -> @docx-editor.dev/agents
  -> Vue and ProseMirror peer dependencies

packages/nuxt
  -> Vue adapter and Nuxt runtime

packages/core
  -> docxtemplater, dompurify, jszip, pizzip, xml-js
  -> ProseMirror peer dependencies

packages/agents
  -> agent/AI-specific dependencies and React integrations

packages/i18n
  -> locale data/types
```

The intended post-migration publish graph is:

```text
@sofcom/docx-editor-react
  -> @sofcom/docx-editor-core
  -> React/ReactDOM peer dependencies
  -> ProseMirror peer dependencies
  -> React UI runtime dependencies

@sofcom/docx-editor-core
  -> DOCX/XML/ZIP runtime dependencies
  -> ProseMirror peer dependencies
```

There must be no Core dependency on React, ReactDOM, or React-specific packages.

## Existing Core Responsibilities

`packages/core/src/core.ts` is the current aggregate public entry point. Core owns:

- OOXML/DOCX parsing and serialization.
- DOCX repacking, selective save, and XML patching.
- Document creation and document model types.
- ProseMirror schema, conversion, commands, plugins, and editor state utilities.
- Layout and rendering-independent document utilities.
- Template processing and variable detection.
- Agent-facing document APIs that are framework-independent.
- Fonts, colors, units, print, clipboard, selection, comments, tables, and content-control utilities.
- Core plugin APIs and the headless entry point.

Core source contains no React dependency and is intended to remain framework-agnostic.

## Existing React Responsibilities

`packages/react/src/index.ts` is the current curated React entry point. React owns:

- `DocxEditor` and its ref/props contract.
- `renderAsync` and React editor initialization.
- React hooks for history, selection, clipboard, autosave, find/replace, fonts, scrolling, tables, and editor lifecycle.
- Toolbar, title bar, dialogs, sidebars, overlays, rulers, menus, and other UI components.
- React plugin host and React-facing plugin API.
- React locale provider and translation hook integration.
- React-specific DOM synchronization, SSR handling, and event wiring.

The current React source imports Core through the package alias and imports i18n/agent surfaces from their existing workspace packages.

## Files and Modules Belonging to Core

The Core boundary is `packages/core`. Its build entry points are defined in `packages/core/tsup.config.ts`, with source rooted at `packages/core/src` and the aggregate entry at `packages/core/src/core.ts`. Major module groups include:

- `src/docx`: parser, serializer, rezip, and selective-save modules.
- `src/types`: document, content, formatting, styles, lists, and agent API types.
- `src/prosemirror`: schema, conversion, commands, extensions, plugins, and utilities.
- `src/utils`: document factories, template processing, colors, fonts, units, print, clipboard, selection, and related helpers.
- `src/plugin-api`, `src/core-plugins`, `src/agent`, `src/api`, and `src/headless.ts`.
- Core tests under `packages/core/src/**/__tests__` and adjacent test files.

## Files and Modules Belonging to React

The React boundary is `packages/react`. Its build entry points are defined in `packages/react/tsup.config.ts`, with source rooted at `packages/react/src`. Major module groups include:

- `src/components`: editor, toolbar, dialogs, sidebars, overlays, rulers, and UI controls.
- `src/hooks`: React lifecycle and editor interaction hooks.
- `src/plugin-api` and `src/plugins`: React plugin host and template plugin.
- `src/i18n`: React locale provider and translation hook.
- `src/renderAsync.ts`, `src/ui.ts`, and `src/index.ts`.
- React tests under `packages/react/src`.

## Dependencies Belonging to Core

Runtime dependencies currently declared by Core are:

- `docxtemplater`
- `dompurify`
- `jszip`
- `pizzip`
- `xml-js`

ProseMirror packages are peer dependencies because Core exposes and consumes ProseMirror contracts. These remain peer dependencies for the renamed Core package, with matching development dependencies for local builds/tests.

## Dependencies Belonging to React

React-specific runtime dependencies currently declared by React are:

- `@radix-ui/react-select`
- `clsx`
- `sonner`

React and ReactDOM are peer dependencies and must not be bundled. ProseMirror packages remain peer dependencies because the React public API exposes editor/plugin/view/state contracts.

The current React package also declares `@docx-editor.dev/core`, `@docx-editor.dev/i18n`, and `@docx-editor.dev/agents`. The target package must replace the Core edge with `@sofcom/docx-editor-core`. Required i18n and agent functionality must either be internalized into the two deliverable packages or removed from the target public surface; publishing those packages would violate the exactly-two-package requirement.

## Current Public APIs

Core's public API is the curated aggregate in `src/core.ts`, with explicit exports for parser/serializer, document factories, agents, utilities, ProseMirror surfaces, plugin APIs, document types, and additional documented subpaths in `packages/core/package.json`.

React's public API is the curated root in `src/index.ts`:

- `DocxEditor`
- `DocxEditorProps`
- `DocxEditorRef`
- `EditorMode`
- `renderAsync`
- `RenderAsyncOptions`
- `DocxEditorHandle`
- `createEmptyDocument`
- `createDocumentWithText`
- `CreateEmptyDocumentOptions`
- `LocaleProvider`
- `useTranslation`
- `LocaleProviderProps`

Existing explicit subpath exports include UI, dialogs, hooks, plugin API, styles, and CSS. These should be preserved under the renamed package where they remain part of the React package.

## Required Package Renames

- `@docx-editor.dev/core` -> `@sofcom/docx-editor-core`
- `@docx-editor.dev/react` -> `@sofcom/docx-editor-react`

Target version is `0.1.0` unless the repository's release process requires a different value.

## Required Import Changes

Active Core and React source imports, TypeScript path aliases, examples, package manifests, build scripts, API tooling, and current user-facing documentation must use the Sofcom names. React must import Core only through `@sofcom/docx-editor-core`, never through a relative source path.

References to Vue, Nuxt, Agents, and the standalone i18n package require classification. They must not create dependencies in the two published packages unless their required source is moved inside a target package.

## Required Documentation Changes

Update the root README, package READMEs, public docs, examples, API reports/configuration, release documentation, package scripts, and validation scripts to describe the two Sofcom packages. Installation examples should use the actual package names and actual exports. Vue/Nuxt documentation can remain historical or be explicitly marked outside the Sofcom deliverable; it must not be presented as a third Sofcom package.

## Licensing and Attribution Considerations

The repository declares Apache-2.0 and includes existing LICENSE files, package attribution, CLA material, and historical EigenPal references. The original license and required notices must remain. Renaming packages does not change authorship or upstream attribution. Historical changelogs, legal notices, attribution comments, and migration documentation may retain EigenPal references when needed for accuracy. A `docs/licensing.md` document should explain the upstream project/license, the modifications, the Sofcom package naming, and retained third-party notices without making additional legal conclusions.

## Potential Breaking Changes

- Package import names change from the old scoped names to the two Sofcom names.
- The standalone Vue, Nuxt, Agents, and i18n packages will not be part of the target deliverable.
- Consumers importing undocumented internal paths may be affected if exports are tightened.
- Consumers relying on transitive i18n/agent package resolution may need explicit API adjustments if those surfaces cannot be internalized.
- Version `0.1.0` communicates a new package identity rather than compatibility with existing package versions.

## Migration Risks

- Missing or duplicated i18n/agent source could break the React build or runtime.
- Repository-wide package-name replacement could damage legal attribution or historical records.
- Existing Bun lockfile workspace entries may retain old names unless regenerated.
- API Extractor snapshots and validation scripts may fail until package names and report paths are synchronized.
- Examples for Vue/Nuxt/agents may remain non-buildable if the workspace is reduced to two packages without an explicit archival strategy.
- Published package archives must be checked to ensure they contain only `dist`, declarations, CSS/assets, and package metadata.
- React peer dependency externalization must be verified in the generated bundle.

## Final Proposed Architecture

Reuse `packages/core` as the source and build location for `@sofcom/docx-editor-core`. Reuse `packages/react` as the source and build location for `@sofcom/docx-editor-react`. Keep the Core package framework-agnostic and make the React package depend on Core through its public package name only.

The root workspace may retain development-only historical packages if required to preserve existing tests/docs, but the publishable package set and active target examples must contain exactly the two Sofcom packages. Core and React each retain curated entry points, explicit exports, declaration generation, source maps, and `files: ["dist"]` packaging. Build, typecheck, unit tests, package archives, and a clean consumer install must all be validated before completion.
