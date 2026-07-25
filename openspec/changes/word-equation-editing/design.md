## Context

OMML already flows end-to-end but is inert. The current path:

```
DOCX  ─unzip→ parser ─→ MathEquation ─toProseDoc→ PM `math` node ─┐
                                                                   │ (edit: none)
save  ←rezip─ serializer ←fromProseDoc─ PM `math` node ←──────────┘
                       ↑ writes MathEquation.ommlXml verbatim

display: PM `math` node ─buildBoxTree→ *flattened to italic Cambria-Math text run* ─painter→ plain text
```

Concrete anchors:

- Model: `packages/core/src/types/content/math.ts:9` — `MathEquation { display:'inline'|'block'; ommlXml:string; plainText?:string }`, wired into paragraph content at `types/content/paragraph.ts:54` and SDT content at `types/content/sdt.ts:121`.
- Parse: `packages/core/src/docx/paragraphParser/content.ts:759` (`oMath`/`oMathPara`), `extractMathText` at `:56`.
- PM node: `packages/core/src/prosemirror/extensions/nodes/MathExtension.ts:11` (`inline, atom, attrs {display, ommlXml, plainText}`), registered `StarterKit.ts:159`.
- Convert: `toProseDoc/runs.ts:94`, `fromProseDoc/runs.ts:245`.
- Serialize: `serializer/paragraphSerializer/content.ts:396` (`return content.ommlXml || ''`).
- Flatten (the thing we replace): `flow-model/buildBoxTree/runs.ts:501`.
- Paint template to mirror: `painter-model/renderParagraph/runs.ts:468` (`renderInlineImageRun`), image geometry in `painter-model/renderImage.ts` / `imageLayout.ts`.

The dual-rendering invariant (CLAUDE.md) forces one non-negotiable decision up front: **the visible math must be produced by the painter, not by PM `toDOM` or a NodeView.** A NodeView would render the editing DOM the user never sees on the page; fixing `toDOM` for a visual math bug means "user sees nothing." So the math layout engine feeds the painter, exactly as text and images do.

## Goals / Non-Goals

**Goals:**

- Insert, edit, and Word-faithful render of math for a defined, growing OMML construct subset.
- Lossless verbatim round-trip preserved at every phase for equations the user does not edit, and for constructs the AST does not yet model.
- A single shared core (AST + OMML⇄AST + linear input + layout engine); adapters carry only UI.
- Real metrics (`width`/`height`/`ascent`/`descent`) so equations break lines and paginate correctly.
- Each phase independently mergeable with green tests; degrade to the current text fallback when a construct or font is unavailable.

**Non-Goals:**

- Changing the OOXML storage/round-trip plumbing or DOCX packaging.
- Merging math into the body PM as editable prosemirror text (math stays an atom node with an internal AST — like Word, LibreOffice, and Google Docs, none of which model math as linear editor text).
- MathML import/export, ink-to-math, or a11y MathML export (follow-ups).
- Block-equation numbering/pagination as a first-class `ContentNode` in early phases (explicitly deferred — see Decision 7).

## Decisions

### 1. Internal math AST is the working representation; OMML stays the persisted SoT

Add `packages/core/src/math/ast.ts` — a discriminated union `MathNode`:

```
run(text, props)            fraction(num, den, kind)      radical(deg?, radicand)
sup(base, sup) sub(base,sub) subSup(base, sub, sup)       nary(op, sub?, sup?, body)
delimiter(open, close, sep, items[])   func(name, arg)    accent(char, base)
bar(pos, base)   group(items[])   matrix(rows[][], props) rawOmml(xml)  // escape hatch
```

`rawOmml` is the escape hatch: any OMML the parser does not model is captured as a `rawOmml` node and re-emitted verbatim. This guarantees **edit-safe passthrough** — a user can edit the fraction next to an unmodeled construct without destroying the latter.

`MathEquation.ommlXml` remains the on-disk source of truth. The AST is built lazily (only when an equation is edited or needs real rendering). When an equation node is untouched, `fromProseDoc` writes its stored `ommlXml` unchanged — no AST round-trip, no risk of drift.

### 2. OMML ⇄ AST conversion, subset-driven

`ommlToMathAst(xml): MathNode` and `mathAstToOmml(node): string`. Coverage grows by phase (Decision 8). Invariants enforced by tests:

- **Idempotence on the supported subset:** `mathAstToOmml(ommlToMathAst(x))` is semantically equal to `x` for supported constructs.
- **Verbatim on the unsupported subset:** unmodeled elements survive as `rawOmml` and re-emit byte-identical.
- Serialize escapes all attacker-controlled text via the existing `escapeXml` (CLAUDE.md XML-injection rule); parse uses the existing safe XML parser (no DTD/entity expansion).

### 3. Rendering: a `math` layout-run kind measured by a core math layout engine

`buildBoxTree/runs.ts:501` stops emitting `kind:'text'` for math and instead emits `kind:'math'` carrying a measured `MathBox` tree from `packages/core/src/math/layout/`:

- **Measurement** reuses the existing text metrics path (the same canvas/DOM measurement the painter uses for runs) to size glyph runs in Cambria Math at the run's font size, then composes:
  - fraction: stack num/den, center, draw bar at math axis; scale by `fraction` script-level.
  - scripts: offset sup up / sub down by font-derived shifts; combine for subSup.
  - radical: surd glyph sized to radicand height + a degree inset.
  - n-ary/large operator: grow the operator glyph, place limits above/below (display) or as scripts (inline).
  - delimiters: stretchy brackets sized to content height.
  - matrix/stack: grid with per-column alignment and row gaps.
- **Output box** exposes `width/height/ascent/descent` so `pagination-model/paragraphPagination.ts` line-breaks and paginates equations like any inline atom.

The painter gains a `renderMathRun` beside `renderInlineImageRun` (`renderParagraph/runs.ts`), walking the `MathBox` tree into positioned `<span>`/`<svg>` elements with inline styles (Tailwind is not guaranteed on painted DOM — CLAUDE.md pitfall). Stretchy surds/braces draw as inline SVG paths.

**Fallback:** if the font is missing or a box can't be built, fall back to the current styled text run — never a hard failure.

### 4. Input: UnicodeMath linear parser → AST

`linearToMathAst(src): MathNode` implements Word's default linear grammar subset: `a/b`, `x^2`, `x_i`, `x_i^2`, `sqrt(x)` / `√`, `(a+b)`, `sum_(i=1)^n`, `int_a^b`, `\alpha`→α (symbol autoreplace shares the Symbol table shipped separately), function names (`sin`, `log`). LaTeX-subset input is a stretch goal mapped onto the same AST. The parser is pure/core so both adapters and tests share it.

### 5. Edit surface: inline editor + structure palette (adapter UI, shared logic)

Double-click a painted equation (hit-test via the `data-doc-from`/`data-doc-to` markers the painter already emits) or Insert → Equation opens an inline editor anchored at the equation:

- A linear-input field seeded from `astToLinear(ast)` for round-trippable editing.
- A structure palette (fraction, script, radical, n-ary, bracket, matrix, accent, common symbols) that inserts AST templates at the caret.
- Live preview through the same layout engine.
- On commit: `mathAstToOmml(ast)` → PM transaction setting the `math` node's `ommlXml` + refreshed `plainText`. Standard transaction → tracked-changes/undo for free (as the Symbol insert already gets).

The component is mirrored React/Vue; the AST/layout/preview logic is core. Focus-stealing rules apply (dialog/palette mousedown needs `stopPropagation`, CLAUDE.md pitfall).

### 6. Insert entry point mirrors the Symbol wiring

Reuse the pattern just shipped for Symbol: `onInsertEquation` prop → `ToolbarProps` (`Toolbar.tsx`) → `MenuBar` Insert menu entry (`TitleBar.tsx`) → `DocxEditor.tsx` handler that opens the editor / inserts a `math` node; Vue via `useMenuActions` `insertEquation` + `MenuBar.vue` item. An equation gallery (built-in templates) is a submenu, like the Break submenu. New Material icon (`functions`) added to `Icons.tsx` and extracted to Vue via `scripts/extract-icons.mjs`.

### 7. Block equations stay inline-centered until a dedicated phase

`m:oMathPara` currently maps to an inline `MathEquation` with `display:'block'`. Early phases render it as a centered inline box on its own line (good enough visually). True display-equation semantics — own block box, equation numbering, right-aligned number tabs, page-break behavior — require a new `ContentNode` variant, which trips the **3-switch invariant** (`pagination-model/index.ts` runLayoutPipeline, `react/.../measureBlock.ts`, `vue/.../useDocxEditor.ts`). That promotion is its own phase (Decision 8, Phase 5), gated behind the inline engine being solid.

### 8. Phasing (each independently mergeable)

- **Phase 0 — Entry point.** Insert → Equation menu (React+Vue) + gallery of a few built-ins; inserts a `math` node whose `ommlXml` is a canned template. Still renders as text fallback. Ships a visible, testable feature with zero rendering risk. Mirrors Symbol wiring.
- **Phase 1 — AST + OMML⇄AST (core subset A).** runs, fractions, sub/sup/subSup, radicals, delimiters, functions. Idempotence + verbatim-passthrough tests. No UI/render change yet (pure core).
- **Phase 2 — Linear input + edit surface.** `linearToMathAst`/`astToLinear`, inline editor + structure palette for subset A, commit → OMML. Rendering still text fallback (author-by-typing works; visual is next).
- **Phase 3 — Math layout engine + painter (subset A).** Replace the flatten in `buildBoxTree/runs.ts:501` with measured `math` runs; add `renderMathRun`. Real fractions/scripts/radicals/delimiters with metrics feeding pagination. Font strategy landed.
- **Phase 4 — Coverage B.** n-ary/large operators, matrices/stacks, accents, bars, nested groups — in AST, OMML, linear input, layout, palette.
- **Phase 5 — Display equations.** Promote `oMathPara` to a block box with numbering/pagination (trips + resolves the 3-switch invariant), right-tab equation numbers.
- **Phase 6 — Polish/parity/docs.** Parity contract, feature-matrix update (`text.math` → editing/rendering upgraded), authoring guide, perf pass on large math-heavy docs.

Rollback at any phase boundary returns to a working state; verbatim round-trip holds from Phase 0.

## Risks / Trade-offs

- **Layout fidelity is deep.** Word's math layout is a mature typesetter. Mitigation: subset-driven phases, metrics validated against reference screenshots, graceful text fallback. We target visual closeness, not glyph-exact parity, initially.
- **Font dependency.** Faithful math needs Cambria Math (or an OpenType-MATH font). Mitigation: bundle/lazy-load with the existing font loader; degrade to styled text without it.
- **Round-trip regressions.** The biggest hazard is re-serializing math and drifting bytes. Mitigation: never AST-round-trip an untouched equation; `rawOmml` escape hatch; idempotence tests as merge gates.
- **Scope creep into a full CAS/typesetter.** Mitigation: explicit non-goals and per-phase construct subsets; block numbering and MathML export are separate follow-ups.
- **Two adapters.** Mitigation: all non-UI logic in core; adapters are thin; e2e parity specs in both.

## Migration Plan

Long-lived feature branch `feat/word-equations`. Each phase merges to the branch with `bun run typecheck`, core unit tests, and adapter e2e green; the branch merges to `main` when Phase 3 (first visible rendering) is solid — Phases 4–6 can land incrementally on `main` behind the same graceful-fallback guarantee. No data migration: existing documents keep working (verbatim passthrough) and gain rendering/editing as phases land.

## Open Questions

- Build the math layout in-house vs. adopt an OpenType-MATH shaping lib for measurement only? (Leaning in-house for canvas control + bundle size; revisit if metrics prove too costly.)
- Linear input: UnicodeMath only, or also a LaTeX subset behind the same AST? (Proposed: UnicodeMath first, LaTeX as stretch.)
- Equation gallery contents and whether templates are localized strings vs. fixed OMML blobs.
- Cambria Math bundling: ship the font, or require it present and fall back otherwise?
