---
'@docx-editor.dev/core': patch
---

Fix Shift+Enter (soft line break) at the end of a paragraph not showing the new line. A trailing line break now renders its empty line, so pressing Shift+Enter once moves the caret down instead of appearing to do nothing.
