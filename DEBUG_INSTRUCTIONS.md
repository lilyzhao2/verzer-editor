# Debug Instructions for Track Changes

## Current Status
We've implemented a **marks-based track changes** system based on ProseMirror community best practices.

## How to Test

### 1. Open Browser Console
Press `F12` or `Cmd+Option+I` to open developer tools

### 2. Switch to Suggesting Mode
Click the mode selector and choose "Suggesting"

**Expected Console Output:**
```
🔄 Mode changed to: suggesting
Extension: starterKit
Extension: underline
...
Extension: suggestChanges
✅ Suggest changes enabled: true
```

### 3. Type Some Text
Type "hello world" in the editor

**Expected Console Output:**
```
🔍 Processing transaction...
Step: { stepType: 'replace', from: X, to: Y, ... }
✅ Detected insertion: hello world
Modified: true
```

**Expected Visual:**
- Text should appear with **green background and green underline**
- Check HTML: `<span data-type="insertion" class="suggestion-insertion">hello world</span>`

### 4. Delete Some Text
Delete "world"

**Expected:**
- Text should show with **red strikethrough** (but still visible!)
- NOT actually deleted from document

---

## Troubleshooting

### If Console Shows:
- `❌ Suggest changes disabled` → Mode not set to suggesting
- `❌ SuggestChanges extension not found!` → Extension not loaded
- `⚠️ No user transaction found` → Typing not being detected

### If No Console Output:
- Extension not running at all
- Check if marks are registered: Look for `insertion` and `deletion` in extensions list

### If Text Doesn't Have Green Background:
- Marks might not be applying
- CSS might not be loading
- Check Elements tab in DevTools for `<span data-type="insertion">`

---

## What Should Happen

**Suggesting Mode ON:**
1. Type → Green underline appears inline
2. Delete → Red strikethrough (text stays)
3. Sidebar auto-opens showing changes

**Suggesting Mode OFF:**
1. Type → Normal typing (no marks)
2. Delete → Actually deletes

---

## Current Issues to Check

1. ✅ Are marks defined? (InsertionMark, DeletionMark)
2. ✅ Is extension loaded? (SuggestChangesExtension)
3. ❓ Are marks being applied? (Check console for "✅ Detected insertion")
4. ❓ Is CSS working? (Check if green/red colors show)
5. ❓ Are deletions handled? (Should keep text, just mark it)

---

## Quick Fixes

If nothing works, check:
```typescript
// In LiveDocEditor.tsx, extensions array should have:
InsertionMark,
DeletionMark,
SuggestChangesExtension.configure({ ... })
```

If marks aren't showing:
```css
/* Should be in CSS somewhere */
.suggestion-insertion {
  background-color: #dcfce7;
  border-bottom: 2px solid #16a34a;
}
```

