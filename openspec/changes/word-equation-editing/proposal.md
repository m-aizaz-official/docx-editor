## Why

Word documents carry mathematics as OMML (`m:oMath` inline, `m:oMathPara` display) per ECMA-376 §22. The editor already **round-trips OMML losslessly**: the parser captures each math element verbatim (`packages/core/src/docx/paragraphParser/content.ts:759`, the `oMath`/`oMathPara` case), stores it as a `MathEquation` model node (`packages/core/src/types/content/math.ts:9` — `{ display, ommlXml, plainText }`), projects it into a ProseMirror inline atom (`packages/core/src/prosemirror/extensions/nodes/MathExtension.ts:11`, registered in `StarterKit.ts:159`), converts both directions (`toProseDoc/runs.ts:94` `convertMathEquation`, `fromProseDoc/runs.ts:245` `createMathFromNode`), and serializes the raw OMML back on save (`serializer/paragraphSerializer/content.ts:396`).

What is missing is everything a user touches:

1. **No way to insert an equation.** There is no Insert entry, command, or dialog. The `math` node can only arrive from an opened file.
2. **No way to edit an equation.** Opening a file with math and saving preserves it, but the content is opaque — the app cannot change it.
3. **No real rendering.** The layout stage flattens every equation to a single italic Cambria-Math _plain-text run_ (`packages/core/src/flow-model/buildBoxTree/runs.ts:501`), so `x²`, a fraction, or an integral all appear as their fallback text (or `[equation]` when no `m:t` text exists). Nothing stacks, no fraction bar, no radical, no proper metrics.

This change closes the gap between "OMML survives" and "OMML is a first-class, Word-faithful editing experience." It is deliberately **phased**: each phase ships a working, mergeable state, and lossless round-trip of untouched equations is preserved throughout.

## What Changes

- **Insert entry point.** Add **Insert → Equation** to the menu (React `packages/react/src/components/TitleBar.tsx` MenuBar + Vue `packages/vue/src/components/MenuBar.vue`), plus an equation gallery of common built-ins (quadratic formula, etc.), mirroring the just-shipped Symbol wiring (`onInsertSymbol` → `useMenuActions` `insertSymbol`). Inserting drops a `math` node at the cursor.
- **Internal math AST.** Introduce a structured, framework-agnostic math tree (`MathNode`: run/fraction/script/radical/n-ary/delimiter/function/accent/matrix/…) in `packages/core/src/math/` as the working representation. It is derived from OMML on load/edit and serialized back to OMML on save. `MathEquation.ommlXml` stays the persisted source of truth and is passed through **verbatim** whenever an equation is not edited (lossless round-trip is never regressed by re-serialization).
- **OMML ⇄ AST.** A parser (`ommlToMathAst`) and serializer (`mathAstToOmml`) covering a growing subset of OMML: runs (`m:r`), fractions (`m:f`), sub/superscript (`m:sSub`/`m:sSup`/`m:sSubSup`), radicals (`m:rad`), n-ary/large operators (`m:nary`), delimiters/brackets (`m:d`), functions (`m:func`), accents (`m:acc`), bars, groups, and matrices/stacks (`m:m`). Unsupported constructs are preserved verbatim (kept as raw OMML sub-trees) so opening→editing→saving never drops content the AST doesn't model yet.
- **Linear math input.** A UnicodeMath-style linear input (Word's default: `a/b`, `x^2`, `sqrt(x)`, `\alpha`, `sum_(i=1)^n`) parsed into the AST, so users can author equations by typing. LaTeX-subset input is a stretch goal behind the same AST.
- **Real math rendering in the painter.** Replace the text-flatten in `buildBoxTree/runs.ts` with a new `math` layout-run kind that carries a **measured math box tree**. A core math layout engine (`packages/core/src/math/layout/`) measures glyph runs and composes fraction bars, radical surds, script offsets, stretchy delimiters, and stacked rows into a box with real `width`/`height`/`ascent`/`descent`, feeding paragraph line-breaking and pagination. The painter paints it mirroring the inline-image run path (`packages/core/src/painter-model/renderParagraph/runs.ts:468` `renderInlineImageRun`). The document canvas stays Word-faithful (no theming, per CLAUDE.md).
- **Edit surface.** Double-clicking a painted equation (or inserting a new one) opens an inline equation editor: a focused linear-input field seeded from the AST, with a structure palette (fraction, script, radical, n-ary, bracket, matrix, accent) that inserts AST templates. On commit, the AST re-serializes to OMML and updates the `math` node's `ommlXml`/`plainText` attrs via a PM transaction (tracked-changes aware, like any edit).
- **React/Vue parity.** The AST, OMML parser/serializer, linear-input parser, and math layout engine live in `packages/core/` and are shared. Only the adapter UI (menu entry, edit-surface component, structure palette) is mirrored per-framework, per the CLAUDE.md parity rule.
- **Docs.** Update the feature matrix (`docs/site/data/word-features.ts:151` `text.math`) as capability lands, and add an authoring guide.

## Capabilities

### New Capabilities

- `equation-editing`: Word-style authoring, editing, and Word-faithful rendering of OMML math. Covers the insert entry point + gallery, the internal math AST with lossless verbatim-passthrough for untouched and not-yet-modeled equations, OMML⇄AST conversion for a defined construct subset, linear (UnicodeMath) input, an inline edit surface with a structure palette, and a core math layout engine that paints real math with metrics feeding pagination. Excludes the OOXML storage/round-trip plumbing (already exists and is preserved) and the DOCX packaging layer.

### Modified Capabilities

<!-- No existing OpenSpec specs cover math; nothing to modify. The existing round-trip code is preserved, not re-specified. -->

## Impact

- **Preserved unchanged (hard constraint):** the parse → `MathEquation` → PM `math` node → serialize verbatim path. Any equation the user does not edit must save byte-for-identical OMML. New code sits _beside_ this path; it does not replace the passthrough.
- **New code (core, shared):** `packages/core/src/math/` — AST types, `ommlToMathAst`, `mathAstToOmml`, `linearToMathAst` (UnicodeMath), and `layout/` (measurement + box composition). Estimated the largest surface of the change.
- **Changed core:** `flow-model/buildBoxTree/runs.ts:501` (emit a `math` run kind instead of a text run), a new `math` layout-run type alongside the inline-image run, and `painter-model/renderParagraph/runs.ts` (paint the math box, mirroring `renderInlineImageRun`).
- **ContentNode invariant:** inline math (`m:oMath`) is a **run inside `ParagraphBlock`**, so it does **not** touch the 3-switch `ContentNode` invariant (`packages/core/src/pagination-model/types.ts:642`). Display equations (`m:oMathPara`, `display:'block'`) are modeled inline-centered in early phases; promoting them to a first-class block `ContentNode` (own measurement/pagination/equation-numbering) is a later phase that _would_ trip the 3-switch invariant and is called out explicitly in `design.md`.
- **Adapters:** menu wiring + an equation-editor component + structure palette in both `packages/react/` and `packages/vue/`, mirroring the Symbol menu pattern and the existing dialog registries (`DocxEditorDialogs.tsx` / `.vue`).
- **Fonts:** correct math rendering needs a math font with the glyph coverage Word assumes (Cambria Math). Bundling/loading strategy (embedded vs. system fallback) is a design decision; the fallback stays the current styled text so absence of the font degrades gracefully.
- **Tests:** new core unit tests for AST round-trip (OMML→AST→OMML idempotence on the supported subset, verbatim passthrough for the unsupported subset), linear-input parsing, and layout metrics; new React + Vue e2e for insert/edit/render parity; the existing `sdt-content-roundtrip` math assertion (`packages/core/src/docx/__tests__/sdt-content-roundtrip.test.ts:136`) must stay green.
- **Dependencies:** aim to build the AST/layout in-house (no heavy MathML/KaTeX runtime in the document canvas) to keep bundle size and Word-fidelity control; a MathML bridge may be considered for the _input_ side only. Final call in `design.md`.
- **Out of scope:** MathML import/export, equation auto-numbering schemes beyond Word's, handwriting/ink-to-math, and accessibility MathML export (tracked as follow-ups).
