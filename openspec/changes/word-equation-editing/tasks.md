## Status (2026-07-24)

Phases 0–4 (inline) implemented in-house (no new dependencies), React + Vue:

- **Core math module** (`packages/core/src/math/`): AST (`ast.ts`), OMML⇄AST round-trip (`omml.ts`), linear LaTeX-style input (`linear.ts`), CSS-based renderer (`render.ts`), model-time measurement (`measure.ts`), insert helpers (`insert.ts`). 23 unit tests (OMML idempotence + verbatim `raw` passthrough + linear parsing).
- **Painter integration**: new `MathRun` in the `Run` union; `buildBoxTree` emits it (measured), `paragraphLayout` treats it as an atomic in-flow box (width + line-height flooring), `renderParagraph` paints it via `paintMathRun`. Equations now render as laid-out math instead of text fallback.
- **UI**: Insert → Equation menu (both adapters) → `EquationDialog` with live preview, structure palette, gallery, and inline/display toggle. Insert creates a `math` node whose OMML the serializer round-trips.
- **Tests**: `e2e/tests/insert-equation.spec.ts` (React) + `e2e/tests/vue/insert-equation.spec.ts` (Vue), all green.

Remaining / follow-ups: double-click-to-edit an existing painted equation (Phase 2 edit path — insert works; edit-in-place is wired via `initialLinear`/`linearFromOmml` but not yet triggered from a painter click), block-equation numbering as a first-class `ContentNode` (Phase 5), coverage B polish (accents/bars/matrix authoring in the linear grammar), glyph-exact Word fidelity, and `api:extract` for the new `@public MathRun` once the tree is clean of unrelated in-flight work.

OMML verbatim passthrough of untouched equations is preserved (serializer emits stored `ommlXml`; only edited nodes re-serialize from AST).

## 1. Baseline & guardrails

- [ ] 1.1 Add a core round-trip guard test: open a fixture with several math constructs, save, and assert the `m:oMath`/`m:oMathPara` bytes are unchanged (locks in the existing verbatim passthrough before any new code touches the path). Extend `packages/core/src/docx/__tests__/sdt-content-roundtrip.test.ts:136` coverage or add a dedicated `math-roundtrip.test.ts`.
- [ ] 1.2 Assemble a math fixture set (inline + display; fraction, script, radical, n-ary, delimiter, matrix, accent) under `examples/vite/public/` and reference OMML captures for idempotence tests.
- [ ] 1.3 Create long-lived branch `feat/word-equations`.

## 2. Phase 0 — Insert entry point (React + Vue)

- [ ] 2.1 Add `functions` Material icon to `packages/react/src/components/ui/Icons.tsx` (SvgIcon-wrapped `<path>` so the extractor picks it up) and run `bun scripts/extract-icons.mjs` to regenerate `packages/vue/src/components/ui/icon-paths.json`.
- [ ] 2.2 React: add `onInsertEquation?: () => void` to `ToolbarProps` (`Toolbar.tsx`), destructure + Insert-menu entry in `MenuBar` (`TitleBar.tsx`) after the Symbol entry, thread through `DocxEditorToolbar.tsx`, and add a handler in `DocxEditor.tsx` that inserts a `math` node at the cursor (canned template OMML). Mirror the Symbol wiring exactly.
- [ ] 2.3 Vue: add `insertEquation` case to `useMenuActions.ts` and an Insert-menu item to `MenuBar.vue`; handler inserts the same `math` node.
- [ ] 2.4 Equation gallery submenu (quadratic formula, sum, integral, etc.) — a submenu like `BreakSubmenu`, each item a fixed OMML template.
- [ ] 2.5 i18n: add `toolbar.equation` and gallery labels to `packages/i18n/en.json`, run `bun run i18n:fix`.
- [ ] 2.6 e2e (React + Vue): Insert → Equation drops a `math` node; save round-trips it. (Still text fallback rendering.)
- [ ] 2.7 `bun run typecheck`, `bun run check:parity-contract`, adapter e2e green.

## 3. Phase 1 — Math AST + OMML⇄AST (subset A)

- [ ] 3.1 `packages/core/src/math/ast.ts`: `MathNode` union (run, fraction, sup/sub/subSup, radical, delimiter, func, group, `rawOmml`). Exhaustiveness-guarded like other core unions.
- [ ] 3.2 `ommlToMathAst(xml)`: parse `m:r`/`m:t`, `m:f`, `m:sSub`/`m:sSup`/`m:sSubSup`, `m:rad`, `m:d`, `m:func`; capture everything else as `rawOmml`. Use the existing safe XML parser (no DTD/entity expansion).
- [ ] 3.3 `mathAstToOmml(node)`: emit the same subset; re-emit `rawOmml` verbatim; escape all text via `escapeXml`.
- [ ] 3.4 Tests: idempotence on subset A (`mathAstToOmml(ommlToMathAst(x)) ≈ x`), verbatim passthrough for unmodeled constructs, XML-injection safety on hostile `m:t` text.
- [ ] 3.5 Wire `fromProseDoc` so an **untouched** equation still writes stored `ommlXml` verbatim (no AST round-trip); only an edited node re-serializes from AST. Guard with a "dirty" flag on the math node attrs.
- [ ] 3.6 `bun run typecheck`, `bun test packages/core/src` green.

## 4. Phase 2 — Linear input + edit surface (subset A)

- [ ] 4.1 `packages/core/src/math/linear/`: `linearToMathAst(src)` (UnicodeMath subset: `a/b`, `x^2`, `x_i`, `sqrt(x)`, `(a+b)`, `sum_(i=1)^n`, `int_a^b`, `\alpha`, function names) and `astToLinear(node)` for seeding the editor.
- [ ] 4.2 Tests for linear parse/serialize round-trip on subset A.
- [ ] 4.3 Core edit-state helper (framework-agnostic): current AST, caret model, palette-template insertion (`packages/core/src/math/edit.ts`).
- [ ] 4.4 React inline equation editor component + structure palette (fraction/script/radical/delimiter/function/symbols), registered in `DocxEditorDialogs.tsx` (or an inline overlay), opened by Insert → Equation and by double-click on a painted equation (hit-test via `data-doc-from`). Commit → PM transaction updating `ommlXml`/`plainText` + dirty flag.
- [ ] 4.5 Vue mirror of the editor + palette (`DocxEditorDialogs.vue` / overlay), sharing the core edit-state helper.
- [ ] 4.6 Focus-stealing correctness: palette/editor mousedown `stopPropagation`; tracked-changes + undo verified.
- [ ] 4.7 e2e (React + Vue): type a fraction via linear input, commit, save → correct OMML; double-click existing equation → edit → save.

## 5. Phase 3 — Math layout engine + painter (subset A)

- [ ] 5.1 `packages/core/src/math/layout/`: measure glyph runs (reuse existing run metrics) and compose `MathBox` for fraction, sub/sup/subSup, radical, delimiter, function, group; expose `width/height/ascent/descent`.
- [ ] 5.2 Replace the flatten at `flow-model/buildBoxTree/runs.ts:501` with a `kind:'math'` layout run carrying the `MathBox`; add the run type alongside the inline-image run.
- [ ] 5.3 `renderMathRun` in `painter-model/renderParagraph/runs.ts` (mirroring `renderInlineImageRun:468`): walk `MathBox` to positioned inline elements; stretchy surds/brackets as inline SVG; inline styles only (no Tailwind reliance on painted DOM).
- [ ] 5.4 Verify pagination: an equation mid-paragraph line-breaks and paginates via `pagination-model/paragraphPagination.ts`; tall equations affect line height.
- [ ] 5.5 Font strategy: load Cambria Math (or OpenType-MATH fallback) via the existing font loader; degrade to styled-text fallback when absent.
- [ ] 5.6 Reference-screenshot e2e (React + Vue) for subset A; parity between adapters asserted.
- [ ] 5.7 Merge branch → `main` once Phase 3 is solid (first visible rendering).

## 6. Phase 4 — Coverage B

- [ ] 6.1 Extend AST + OMML⇄AST + linear input + layout + palette for: n-ary/large operators (`m:nary`, limits above/below vs. scripts by inline/display), matrices/stacks (`m:m`), accents (`m:acc`), bars (`m:bar`), nested groups.
- [ ] 6.2 Idempotence + layout + e2e coverage for subset B.

## 7. Phase 5 — Display equations (block)

- [ ] 7.1 Promote `m:oMathPara` (`display:'block'`) to a first-class block box: introduce the `ContentNode` variant and update the **3 switches** (`pagination-model/index.ts` runLayoutPipeline, `react/.../measureBlock.ts`, `vue/.../useDocxEditor.ts`) — `bun run typecheck` names any missed site.
- [ ] 7.2 Equation numbering + right-tab number alignment; block page-break behavior.
- [ ] 7.3 e2e for display equations + numbering, both adapters.

## 8. Phase 6 — Polish, parity, docs

- [ ] 8.1 `bun run api:extract` for any new `@public` symbols; commit snapshots. `bun run check:parity-contract` for adapter prop/ref additions.
- [ ] 8.2 Update `docs/site/data/word-features.ts` `text.math` (editing `none→partial/full`, rendering `partial→full`) and add an equation authoring guide under `docs/site/content/` (register in both `meta.json`s).
- [ ] 8.3 Perf pass on a math-heavy document (measure layout cost; cache `MathBox` by `ommlXml` in the measure-block cache).
- [ ] 8.4 `bun changeset` (minor, additive feature) for `@docx-editor.dev/{core,react,vue}`.
- [ ] 8.5 Full validation: `bun run typecheck`, core unit suite, targeted playwright, `bun run format`.
