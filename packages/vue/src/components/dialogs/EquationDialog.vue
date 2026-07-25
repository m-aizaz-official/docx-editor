<template>
  <div
    v-if="isOpen"
    class="dialog-overlay"
    @mousedown.self="close"
    @keydown.escape="close"
  >
    <div class="dialog equation-dialog" @mousedown.stop>
      <div class="dialog__header">
        <span class="dialog__title">{{ t('dialogs.equation.title') }}</span>
        <button class="dialog__close" :title="t('common.closeDialog')" @click="close">✕</button>
      </div>

      <div class="dialog__body">
        <!-- Live preview -->
        <div ref="previewRef" class="equation-preview" />

        <!-- Structure palette -->
        <div class="equation-palette">
          <button
            v-for="p in palette"
            :key="p.label"
            type="button"
            :title="p.snippet.replace('$', '')"
            @mousedown.prevent="insertSnippet(p.snippet)"
          >
            {{ p.label }}
          </button>
        </div>

        <!-- Linear input -->
        <textarea
          ref="inputRef"
          v-model="value"
          class="equation-input"
          :placeholder="t('dialogs.equation.placeholder')"
          rows="2"
          spellcheck="false"
        />

        <!-- Gallery -->
        <div class="equation-gallery-label">{{ t('dialogs.equation.gallery') }}</div>
        <div class="equation-gallery">
          <button v-for="g in gallery" :key="g.name" type="button" @click="value = g.linear">
            {{ g.name }}
          </button>
        </div>
      </div>

      <div class="dialog__actions">
        <label class="equation-display">
          <input v-model="displayBlock" type="checkbox" />
          {{ t('dialogs.equation.displayMode') }}
        </label>
        <div class="equation-buttons">
          <button class="dialog__btn" @click="close">{{ t('common.cancel') }}</button>
          <button
            class="dialog__btn dialog__btn--primary equation-insert"
            :disabled="!value.trim()"
            @click="doInsert"
          >
            {{ t('common.insert') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { renderMathNodes, linearToMathAst } from '@docx-editor.dev/core/math';
import { useTranslation } from '../../i18n';

const { t } = useTranslation();

const props = defineProps<{ isOpen: boolean; initialLinear?: string }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'insert', linear: string, display: 'inline' | 'block'): void;
}>();

const value = ref(props.initialLinear ?? '');
const displayBlock = ref(false);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const previewRef = ref<HTMLElement | null>(null);

const palette = [
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

const gallery = [
  { name: 'Quadratic formula', linear: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
  { name: 'Pythagorean', linear: 'a^2+b^2=c^2' },
  { name: 'Sum', linear: '\\sum_{i=1}^{n} i=\\frac{n(n+1)}{2}' },
  { name: 'Integral', linear: '\\int_{a}^{b} f(x)dx' },
  { name: "Euler's identity", linear: 'e^{i\\pi}+1=0' },
  { name: 'Derivative', linear: '\\frac{d}{dx}x^n=nx^{n-1}' },
];

const nodes = computed(() => {
  try {
    return linearToMathAst(value.value);
  } catch {
    return [];
  }
});

watch(nodes, (n) => {
  const host = previewRef.value;
  if (!host) return;
  host.textContent = '';
  if (n.length > 0) host.appendChild(renderMathNodes(n, { fontSize: 26 }));
});

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      value.value = props.initialLinear ?? '';
      displayBlock.value = false;
      await nextTick();
      inputRef.value?.focus();
      // Prime the preview for a seeded value.
      const host = previewRef.value;
      if (host && nodes.value.length) {
        host.textContent = '';
        host.appendChild(renderMathNodes(nodes.value, { fontSize: 26 }));
      }
    }
  }
);

function close() {
  emit('close');
}

function insertSnippet(snippet: string) {
  const el = inputRef.value;
  if (!el) return;
  const caretMark = snippet.indexOf('$');
  const clean = snippet.replace('$', '');
  const start = el.selectionStart ?? value.value.length;
  const end = el.selectionEnd ?? value.value.length;
  value.value = value.value.slice(0, start) + clean + value.value.slice(end);
  const caret = start + (caretMark >= 0 ? caretMark : clean.length);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

function doInsert() {
  if (!value.value.trim()) return;
  emit('insert', value.value, displayBlock.value ? 'block' : 'inline');
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--doc-overlay);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog {
  background: var(--doc-surface);
  border-radius: 8px;
  box-shadow: 0 8px 30px var(--doc-shadow);
  max-width: 92vw;
}
.equation-dialog {
  width: 560px;
  display: flex;
  flex-direction: column;
  max-height: 86vh;
}
.dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--doc-border);
}
.dialog__title {
  font-weight: 600;
  font-size: 14px;
  color: var(--doc-text);
}
.dialog__close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--doc-text-muted);
  width: 24px;
  height: 24px;
  border-radius: 4px;
}
.dialog__body {
  padding: 16px;
  overflow: auto;
}
.equation-preview {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: var(--doc-bg-subtle);
  border-radius: 4px;
  color: var(--doc-text);
  margin-bottom: 12px;
  overflow-x: auto;
}
.equation-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}
.equation-palette button {
  min-width: 36px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--doc-border);
  border-radius: 4px;
  background: var(--doc-surface);
  color: var(--doc-text);
  cursor: pointer;
  font-size: 15px;
}
.equation-input {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid var(--doc-border-input);
  background: var(--doc-surface);
  color: var(--doc-text);
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}
.equation-gallery-label {
  font-size: 12px;
  color: var(--doc-text-muted);
  margin: 12px 0 6px;
}
.equation-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.equation-gallery button {
  padding: 6px 10px;
  border: 1px solid var(--doc-border);
  border-radius: 4px;
  background: var(--doc-bg-subtle);
  color: var(--doc-text);
  cursor: pointer;
  font-size: 13px;
}
.dialog__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--doc-border);
}
.equation-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--doc-text);
}
.equation-buttons {
  display: flex;
  gap: 8px;
}
.dialog__btn {
  padding: 6px 16px;
  border: 1px solid var(--doc-border-dark);
  border-radius: 4px;
  background: var(--doc-bg-subtle);
  color: var(--doc-text);
  cursor: pointer;
}
.dialog__btn--primary {
  background: var(--doc-primary);
  color: var(--doc-on-primary);
  border-color: var(--doc-primary);
}
.dialog__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
