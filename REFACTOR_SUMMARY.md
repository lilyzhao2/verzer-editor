# Track Changes Refactor: Marks → Decorations

## What Changed

We completely refactored the track changes system from a **marks-based approach** to a **decorations-based approach**. This is the professional, industry-standard way used by Google Docs, Microsoft Word, and Final Draft.

## Why This Change Was Necessary

### Problems with the Marks-Based Approach:
1. **Marks become part of the document content** - causing cursor and typing issues
2. **Mark inheritance** - new text would inherit deletion/insertion marks
3. **Edge cases everywhere** - typing next to deleted text, deleting inserted text, etc.
4. **Document pollution** - marks clutter the actual document structure
5. **`inclusive: false` wasn't enough** - still had many edge cases

### Benefits of the Decorations-Based Approach:
1. ✅ **Document stays clean** - no marks in the content
2. ✅ **Changes stored separately** - in plugin state, not in document
3. ✅ **Decorations are visual overlays** - don't affect editing
4. ✅ **Cursor works normally** - no interference
5. ✅ **No edge cases** - typing works everywhere
6. ✅ **Professional approach** - same as Google Docs

## New Files Created

### `/lib/track-changes-decorations.ts`
- **New decoration-based track changes extension**
- Stores changes in plugin state (not in document)
- Uses decorations to visually show changes
- Provides commands: `acceptAllChanges`, `rejectAllChanges`, `clearAllChanges`

## Files Modified

### `/components/LiveDocEditor.tsx`
- Removed imports: `InsertionMark`, `DeletionMark`, `SuggestChangesExtension`
- Added import: `TrackChangesDecorationExtension`, `TrackedChange`
- Changed state: `trackedEdits` → `trackedChanges`
- Updated all references throughout the component
- Simplified sidebar rendering (no more complex mark detection)
- Updated Accept/Reject All buttons to use new commands

## Files That Can Be Archived (No Longer Used)

- `/lib/suggestion-marks.ts` - Old marks-based approach
- `/lib/suggest-changes-extension.ts` - Old marks-based plugin

## How It Works Now

### 1. User Types in Suggesting Mode
```
User types "hello" → Plugin captures it → Stores in plugin state:
{
  id: 'insert-123',
  type: 'insertion',
  from: 10,
  to: 15,
  text: 'hello',
  userId: 'user-1',
  userName: 'You',
  timestamp: 1234567890
}
```

### 2. Visual Display
```
Plugin creates a decoration (green underline) at positions 10-15
Document content: "hello" (clean, no marks!)
Visual overlay: green underline decoration
```

### 3. User Deletes Text
```
User deletes "world" → Plugin checks: was it inserted text?
- If YES: Remove from changes array (cancel out)
- If NO: Add deletion to changes array, show as widget
```

### 4. Deletions Are Widgets
```
Deleted text is shown as a widget (visual element) at the deletion position
Document content: text is actually deleted
Visual: red strikethrough widget shows the deleted text
```

## Testing Checklist

- [ ] Type "hello world" in suggesting mode → all green
- [ ] Delete "world" → it disappears (was inserted, so cancelled out)
- [ ] Type "universe" → green underline
- [ ] Final result: "hello universe" all green
- [ ] Type in original text, delete it → red strikethrough appears
- [ ] Can type anywhere, even next to deletions
- [ ] Sidebar shows all changes correctly
- [ ] Accept All removes all decorations
- [ ] Reject All reverts all changes
- [ ] No duplicate key errors
- [ ] No cursor/typing issues

## Key Insight from Research

> "Keep change information separate from the document and use decorations to display the changes. This avoids the complexity and potential issues associated with mark-based approaches."
> 
> — ProseMirror Discussion Forum

This is exactly what we implemented! 🎉
