# Orbit Rebranding Summary

## Overview

Successfully renamed "AI Agents" to "Orbits" and "watchers" to "Orbits" throughout the application, with added descriptions to help users understand the feature.

## What are Orbits?

**Orbits** are AI-powered file watchers that continuously monitor folders and automatically organize, rename, and process files based on custom rules. Each Orbit watches a specific folder and applies up to 5 natural language rules using AI.

## Changes Made

### 1. UI Components

#### AgentWorkspace.tsx

- **Header**: Changed "AI Agents" to "Orbits" with enhanced description
  - Added: "Orbits are AI-powered file watchers that continuously monitor folders and automatically organize, rename, and process files based on your rules. Create up to 5 Orbits to manage different folders simultaneously."
- **Empty State**: Changed "No Watchers Yet" to "No Orbits Yet"
  - Added description: "Create your first Orbit to start automatically organizing files. Each Orbit watches a folder and applies your custom rules using AI."
- **Card Title**: Changed "New Watcher" to "New Orbit"
- **Delete Confirmation**: Changed "Delete this watcher" to "Delete this Orbit"
- **Template Selector**: Updated description to mention "custom Orbit" and explain templates

#### AgentModeToggle.tsx

- **Button Label**: Changed "Agent Mode" to "Orbit Mode"
- **Tooltip**: Enhanced with "Switch to Orbit Mode - Create AI-powered file watchers"
- **Confirmation Dialog**: Changed "Stop the file watcher and exit Agent Mode?" to "Stop all Orbits and exit Orbit Mode?"
- **Error Messages**: Updated to reference "Orbits"

#### AgentSetup.tsx

- **Header**: Changed "Agent Mode Setup" to "Orbit Setup"
- **Description**: Enhanced from "Configure automatic file processing" to "Configure an AI-powered file watcher that automatically organizes, renames, and processes files based on your custom rules"
- **Edit Mode**: Changed "Edit Agent Rules" to "Edit Orbit Rules"

### 2. Main Process (Electron)

#### src/main/index.ts

- **Close Dialog**:
  - Title: "Agents Running" → "Orbits Running"
  - Message: "You have X agent(s) running" → "You have X Orbit(s) running"
  - Detail: "Agents will continue..." → "Orbits will continue..."
- **System Tray**:
  - Tooltip: "AI File Agent" → "AI File Orbits"
  - Status: "Agent Idle/Running/Paused" → "Orbit Idle/Running/Paused"
  - Menu: "Stop All Agents" → "Stop All Orbits"
- **Balloon Notifications**: Updated to use "Orbit(s)"

### 3. User-Facing Benefits

#### Clear Terminology

- "Orbit" is more intuitive than "watcher" or "agent"
- Suggests continuous monitoring (like a satellite in orbit)
- Unique branding that stands out

#### Enhanced Descriptions

Users now understand:

- What Orbits do (monitor folders, organize files)
- How they work (AI-powered, rule-based)
- How to use them (create up to 5, each with custom rules)
- Why they're useful (automatic organization in background)

## Technical Notes

### Files Modified

1. `src/renderer/src/components/AgentWorkspace.tsx`
2. `src/renderer/src/components/AgentModeToggle.tsx`
3. `src/renderer/src/components/AgentSetup.tsx`
4. `src/main/index.ts`

### Files NOT Modified (Internal Code)

- `src/renderer/src/stores/agentStore.ts` - Internal variable names kept as "watcher" for code consistency
- `src/main/services/fileWatcher.ts` - Service layer kept as-is
- Backend interfaces and types - Maintained for API stability

### Backward Compatibility

- All IPC handlers remain unchanged
- Store structure unchanged
- Only user-facing text updated

## Testing Checklist

- [ ] Orbit Mode toggle works correctly
- [ ] Creating new Orbits shows correct terminology
- [ ] System tray displays "Orbits" correctly
- [ ] Close dialog shows "Orbits Running"
- [ ] Templates mention "Orbit" in descriptions
- [ ] All tooltips updated
- [ ] No console errors from rebranding

## Future Considerations

- Update README.md to use "Orbits" terminology
- Update any documentation or help text
- Consider updating package.json description
- Update screenshots/marketing materials
