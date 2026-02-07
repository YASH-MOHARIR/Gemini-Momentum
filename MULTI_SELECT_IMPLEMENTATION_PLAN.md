# Multi-Select Feature Implementation Plan

## 📋 Overview

Enable users to select multiple files and folders for batch operations in both Chat mode and Orbit mode.

---

## 🎯 Goals

1. Select multiple files/folders with keyboard modifiers (Ctrl+Click, Shift+Click)
2. Visual feedback for selected items
3. Selection count display
4. Batch operations (delete, move, copy)
5. AI batch processing in Chat mode
6. Multi-folder selection for Orbits

---

## 📊 Implementation Phases

### **Phase 1: Core Selection System** ⭐ (Essential)

**Estimated Time:** 2-3 hours

#### Task 1.1: State Management

- [ ] Create selection state in `appStore.ts`
  - `selectedFiles: Set<string>` - Set of selected file paths
  - `selectionMode: 'none' | 'single' | 'multi'`
  - `lastSelectedIndex: number | null` - For Shift+Click range selection
- [ ] Add selection actions:
  - `toggleFileSelection(path: string)`
  - `selectFile(path: string)`
  - `deselectFile(path: string)`
  - `selectRange(startPath: string, endPath: string)`
  - `selectAll()`
  - `clearSelection()`
  - `getSelectedFiles(): string[]`
  - `getSelectedCount(): number`

**Files to modify:**

- `src/renderer/src/stores/appStore.ts`

---

#### Task 1.2: Update FileTree Component

- [ ] Add selection props to FileTree
  - `selectedFiles: Set<string>`
  - `onFileSelect: (path: string, isMulti: boolean) => void`
- [ ] Handle Ctrl+Click (add/remove from selection)
- [ ] Handle Shift+Click (range selection)
- [ ] Handle regular Click (single selection or clear)
- [ ] Prevent selection during folder-select mode (for Orbits)
- [ ] Add visual styling for selected items
  - Selected: `bg-sky-600/30 border-l-2 border-sky-500`
  - Hover on selected: `bg-sky-600/40`

**Files to modify:**

- `src/renderer/src/components/FileTree.tsx`

---

#### Task 1.3: Visual Feedback

- [ ] Highlight selected files with distinct color
- [ ] Add checkmark icon for selected items
- [ ] Show selection count badge
  - Position: Top-right of file tree or bottom bar
  - Format: "5 files selected"
  - Show "Clear Selection" button when items selected
- [ ] Add subtle animation on selection

**Files to modify:**

- `src/renderer/src/components/FileTree.tsx`
- `src/renderer/src/App.tsx` (for selection count display)

---

### **Phase 2: Keyboard Shortcuts** ⭐ (Essential)

**Estimated Time:** 1 hour

#### Task 2.1: Global Keyboard Handlers

- [ ] Ctrl/Cmd + A - Select all files in current folder
- [ ] Escape - Clear selection
- [ ] Delete - Delete selected files (with confirmation)
- [ ] Ctrl/Cmd + C - Copy selected files (future)
- [ ] Ctrl/Cmd + X - Cut selected files (future)

**Files to modify:**

- `src/renderer/src/App.tsx` (add keyboard event listeners)

---

### **Phase 3: Batch Operations** ⭐ (Essential)

**Estimated Time:** 2 hours

#### Task 3.1: Selection Action Bar

- [ ] Create `SelectionActionBar.tsx` component
  - Shows when items are selected
  - Displays: count, actions, clear button
  - Position: Bottom of file tree or floating bar
- [ ] Add action buttons:
  - Delete (trash icon)
  - Move (folder icon)
  - Copy (copy icon)
  - Clear Selection (X icon)

**Files to create:**

- `src/renderer/src/components/SelectionActionBar.tsx`

**Files to modify:**

- `src/renderer/src/App.tsx` (integrate action bar)

---

#### Task 3.2: Batch Delete

- [ ] Update delete handler to accept multiple paths
- [ ] Show confirmation dialog with count
  - "Delete 5 files?"
  - List file names (max 10, then "and X more...")
- [ ] Send all files to pending actions
- [ ] Update UI after deletion

**Files to modify:**

- `src/renderer/src/App.tsx`
- Backend: `src/main/index.ts` (batch delete handler)

---

#### Task 3.3: Batch Move/Copy

- [ ] Add folder picker for destination
- [ ] Move/copy all selected files
- [ ] Show progress indicator for large batches
- [ ] Handle errors gracefully (some succeed, some fail)

**Files to modify:**

- `src/renderer/src/App.tsx`
- Backend: `src/main/index.ts` (batch move/copy handlers)

---

### **Phase 4: AI Batch Processing** 🤖 (Chat Mode)

**Estimated Time:** 1-2 hours

#### Task 4.1: Multi-File Context

- [ ] Update chat input to show selected files
  - "5 files selected" badge in input area
  - Click to see list of selected files
- [ ] Send all selected file paths to AI
- [ ] AI can reference multiple files in response
- [ ] Examples:
  - "Summarize these 3 documents"
  - "Compare these files and find differences"
  - "Extract data from these 10 receipts and create a report"

**Files to modify:**

- `src/renderer/src/App.tsx` (chat input area)
- `src/main/services/gemini/orchestrator.ts` (handle multiple files)

---

### **Phase 5: Orbit Multi-Folder Selection** 🛸 (Orbit Mode)

**Estimated Time:** 1 hour

#### Task 5.1: Multi-Folder Watch

- [ ] Allow selecting multiple folders for a single Orbit
- [ ] Update AgentConfig to support multiple watch folders
  - Change `watchFolder: string` to `watchFolders: string[]`
  - Keep backward compatibility
- [ ] Update Orbit UI to show multiple folders
- [ ] Apply same rules to all selected folders

**Files to modify:**

- `src/renderer/src/stores/agentStore.ts`
- `src/renderer/src/components/AgentWorkspace.tsx`
- `src/main/services/fileWatcher.ts`

---

### **Phase 6: Advanced Features** 🚀 (Optional/Future)

**Estimated Time:** 2-3 hours

#### Task 6.1: Checkboxes (Optional)

- [ ] Add checkbox on hover for easier selection
- [ ] Toggle checkbox mode (always visible vs hover)
- [ ] Better for touch/mobile interfaces

#### Task 6.2: Select by Pattern (Optional)

- [ ] Add "Select by pattern" dialog
- [ ] Support wildcards: `*.pdf`, `*.jpg`, etc.
- [ ] Support regex patterns
- [ ] "Select all PDFs", "Select all images", etc.

#### Task 6.3: Invert Selection (Optional)

- [ ] Add "Invert Selection" button
- [ ] Select all unselected, deselect all selected

#### Task 6.4: Drag & Drop Multiple (Optional)

- [ ] Drag multiple selected files
- [ ] Drop to move/copy to folder
- [ ] Visual feedback during drag

---

## 🗂️ File Structure

### New Files to Create:

```
src/renderer/src/components/
  └── SelectionActionBar.tsx       (Action bar for batch operations)
```

### Files to Modify:

```
src/renderer/src/
  ├── stores/
  │   └── appStore.ts              (Add selection state & actions)
  ├── components/
  │   ├── FileTree.tsx             (Add multi-select logic)
  │   └── AgentWorkspace.tsx       (Multi-folder for Orbits)
  └── App.tsx                      (Integrate selection UI & keyboard shortcuts)

src/main/
  ├── index.ts                     (Batch operation handlers)
  └── services/
      ├── fileWatcher.ts           (Multi-folder watch support)
      └── gemini/
          └── orchestrator.ts      (Multi-file AI processing)
```

---

## 🎨 UI/UX Design

### Selection Visual States:

```
Normal:     bg-transparent hover:bg-slate-700/50
Selected:   bg-sky-600/30 border-l-2 border-sky-500
Hover+Sel:  bg-sky-600/40
```

### Selection Count Badge:

```
┌─────────────────────────────┐
│  📁 Files                   │
│  ├─ document.pdf           │
│  ├─ image.jpg     ✓        │  ← Selected (checkmark)
│  └─ report.xlsx   ✓        │
│                             │
│  ┌─────────────────────┐   │
│  │ 2 files selected    │   │  ← Count badge
│  │ [Delete] [Move] [X] │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

### Action Bar (Bottom):

```
┌─────────────────────────────────────────┐
│ 5 files selected                        │
│ [🗑️ Delete] [📁 Move] [📋 Copy] [✕ Clear] │
└─────────────────────────────────────────┘
```

---

## 🧪 Testing Checklist

### Selection Behavior:

- [ ] Click selects single file
- [ ] Ctrl+Click toggles selection
- [ ] Shift+Click selects range
- [ ] Click empty space clears selection
- [ ] Escape clears selection
- [ ] Ctrl+A selects all in folder

### Visual Feedback:

- [ ] Selected files are highlighted
- [ ] Checkmark appears on selected files
- [ ] Selection count displays correctly
- [ ] Action bar appears when items selected

### Batch Operations:

- [ ] Delete multiple files works
- [ ] Move multiple files works
- [ ] Copy multiple files works
- [ ] Confirmation dialogs show correct count

### Edge Cases:

- [ ] Selection persists when expanding/collapsing folders
- [ ] Selection clears when switching folders
- [ ] Selection disabled during Orbit folder-select mode
- [ ] Large selections (100+ files) perform well
- [ ] Mixed selection (files + folders) handled correctly

### AI Integration:

- [ ] Multiple files sent to AI in Chat mode
- [ ] AI can reference all selected files
- [ ] File context properly formatted

### Orbit Mode:

- [ ] Multiple folders can be selected for Orbit
- [ ] All folders monitored simultaneously
- [ ] Rules apply to all selected folders

---

## 📈 Performance Considerations

1. **Use Set for O(1) lookups**
   - `selectedFiles: Set<string>` instead of array

2. **Debounce selection updates**
   - Avoid re-rendering on every click during range selection

3. **Virtual scrolling for large lists**
   - If selecting 1000+ files, use virtual list

4. **Batch API calls**
   - Send all files in one request, not individual requests

---

## 🔄 Migration Strategy

### Backward Compatibility:

- Keep existing single-file selection working
- Add multi-select as enhancement, not replacement
- Orbit `watchFolder` (singular) still supported
- Gradually migrate to `watchFolders` (plural)

### Feature Flags (Optional):

- Add `enableMultiSelect` flag in settings
- Allow users to disable if they prefer single-select

---

## 📝 Implementation Order (Recommended)

### Week 1: Core Functionality

1. ✅ Task 1.1: State Management (Day 1)
2. ✅ Task 1.2: FileTree Updates (Day 1-2)
3. ✅ Task 1.3: Visual Feedback (Day 2)
4. ✅ Task 2.1: Keyboard Shortcuts (Day 3)

### Week 2: Batch Operations

5. ✅ Task 3.1: Selection Action Bar (Day 4)
6. ✅ Task 3.2: Batch Delete (Day 4-5)
7. ✅ Task 3.3: Batch Move/Copy (Day 5)

### Week 3: Advanced Features

8. ✅ Task 4.1: AI Batch Processing (Day 6-7)
9. ✅ Task 5.1: Orbit Multi-Folder (Day 7)
10. 🔮 Phase 6: Optional features (Future)

---

## 🎯 Success Criteria

### Must Have (Phase 1-3):

- ✅ Select multiple files with Ctrl+Click
- ✅ Visual indication of selection
- ✅ Selection count display
- ✅ Batch delete works
- ✅ Keyboard shortcuts (Ctrl+A, Escape)

### Should Have (Phase 4-5):

- ✅ AI can process multiple files
- ✅ Orbits can watch multiple folders
- ✅ Batch move/copy operations

### Nice to Have (Phase 6):

- 🔮 Checkboxes for easier selection
- 🔮 Select by pattern
- 🔮 Drag & drop multiple files

---

## 🚀 Let's Start!

**Recommended Starting Point:**
Begin with **Phase 1, Task 1.1** - State Management

This is the foundation for everything else. Once we have the state structure in place, the rest will flow naturally.

**Ready to begin?** 🎉
