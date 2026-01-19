# Momentum

**AI-powered desktop agent for autonomous file management**

Momentum gives you an AI coworker that watches your folders, organizes files, extracts data from receipts, and creates reports—all running in the background.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Gemini API key ([Get one free](https://aistudio.google.com/apikey))

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/momentum.git
cd momentum

# Install dependencies
npm install

# Configure API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run development
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your-gemini-api-key-here
```

### Build for Production

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

---

## ✨ Features

### 🤖 Multiple Concurrent AI Agents (Max 5)

Run up to 5 file watchers simultaneously, each with independent configurations:

- **Independent rule sets** - Up to 5 natural language rules per watcher
- **Isolated statistics** - Track files processed, AI calls, errors per watcher
- **Real-time activity feeds** - Last 50 actions per watcher
- **Individual controls** - Start, pause, resume, stop each watcher

**Natural Language Rules:**
```
"PDFs to Documents folder"
"Images older than 6 months to Archive"
"Receipts - use Vision, rename with vendor/date/amount"
"Screenshots to Screenshots folder"
"Code files to Projects, organize by language"
```

---

### 👁️ Gemini Vision Integration

Analyzes images using Gemini Vision API for intelligent processing.

**Capabilities:**
- **Receipt OCR** - Extracts vendor, date, amount, category
- **Screenshot Analysis** - Detects app name and content type
- **Image Categorization** - Classifies into receipts, screenshots, photos, documents, memes
- **Smart Rename** - Generates semantic filenames from image content

| Before | After |
|--------|-------|
| `IMG_3847.jpg` | `2026-01-17_Starbucks_Receipt_$8.50.jpg` |
| `Screenshot 2026-01-17.png` | `Momentum_App_UI_Mockup.png` |
| `Document (3).pdf` | `Q4_Sales_Report_2025.pdf` |

**Supported formats:** PNG, JPG, JPEG, GIF, WEBP, HEIC, HEIF

---

### 📄 Document Parsing

Reads and extracts content from various document formats:

| Category | Formats |
|----------|---------|
| Documents | PDF, DOCX, DOC, TXT, MD, RTF |
| Spreadsheets | XLSX, XLS, CSV |
| Data | JSON, XML, YAML |
| Code | JS, TS, PY, HTML, CSS, and more |

---

### 🔗 Google Integration

**Gmail Integration**
- Search emails by date, sender, keywords
- Download attachments automatically
- Process with Vision API

**Google Sheets Export**
- Create spreadsheets from processed data
- Auto-formatting with formulas
- Returns shareable link

**End-to-End Pipeline**
```
"Create expense report from Gmail receipts"
    ↓
1. Search Gmail for receipt emails
2. Download attachments
3. Process with Gemini Vision
4. Extract vendor, date, amount
5. Create Google Sheet
6. Return shareable link
```

---

### 📊 Storage Analyzer

Analyze disk usage with intelligent insights:

- **Recursive scanning** - Configurable depth (1-5 levels)
- **9 file categories** - Videos, Images, Documents, Spreadsheets, Code, Archives, Audio, Design, Other
- **Largest files** - Top 20 files by size
- **Old files detection** - Files older than 6 months
- **Cleanup suggestions** - AI-generated recommendations

**Interactive Visualizations:**
- Bar chart (storage by type)
- Pie chart (distribution)
- Sortable tables
- Collapsible sections

---

### 🧠 2-Layer AI Orchestrator

Intelligent model routing reduces API costs by **70-75%** while maintaining accuracy.

```
User Request
     ↓
┌─────────────────────────────────┐
│  ROUTER LAYER (Flash-Minimal)   │
│  • Classify task type           │
│  • Score complexity             │
│  • Detect Vision requirements   │
│  • ~100ms latency               │
└───────────────┬─────────────────┘
                ↓
┌───────────────────────────────────────────────┐
│            EXECUTOR LAYER                      │
├───────────────┬───────────────┬───────────────┤
│ Flash-Minimal │ Flash-High    │ Pro-High      │
│ • List files  │ • Organize    │ • Complex     │
│ • Create dir  │ • Summarize   │ • Ambiguous   │
│ • Simple ops  │ • Vision      │ • Multi-step  │
│ Cost: $       │ Cost: $$      │ Cost: $$$$    │
└───────────────┴───────────────┴───────────────┘
```

**Cost Comparison:**
| Task | Single Model | With Orchestrator | Savings |
|------|--------------|-------------------|---------|
| Organize 100 files | $0.042 | $0.011 | 74% |
| Categorize 100 images | $0.194 | $0.049 | 75% |

---

### 📁 File Operations

Complete file management with safety features:

| Operation | Description |
|-----------|-------------|
| List | Browse directories with filters |
| Read | Parse PDF, DOCX, XLSX, and more |
| Write | Create or overwrite files |
| Create Folder | Nested directory creation |
| Delete | Safe deletion to app trash |
| Move | Cross-folder file moving |
| Rename | AI-suggested names |
| Copy | Duplicate files/folders |

**Trash System:**
- All deletions go to app trash (not system trash)
- Restore files to original location
- Last 100 deleted items retained
- Empty trash option

---

### 🔒 Review Panel for Deletions

Safety-first approach for destructive operations:

1. Agent queues destructive actions
2. Non-destructive actions execute immediately
3. Review Panel shows pending deletions
4. User approves/rejects each item or batch
5. Only approved deletions execute

---

### 🎨 User Interface

**Three-Panel Layout:**
```
┌──────────────┬────────────────────┬─────────────────┐
│   Sidebar    │    Main Panel      │   Right Panel   │
│   (280px)    │    (flexible)      │   (resizable)   │
│              │                    │                 │
│ • Folders    │  Chat Mode:        │ • Progress      │
│ • File Tree  │  • AI Chat         │ • Review        │
│ • Settings   │                    │ • Statistics    │
│              │  Agent Mode:       │ • Storage       │
│              │  • Watcher Cards   │                 │
└──────────────┴────────────────────┴─────────────────┘
```

**Features:**
- **Mode Switching** - Chat Mode / Agent Mode
- **Resizable Panels** - Drag to resize (250-600px)
- **Streaming Responses** - Real-time AI output
- **Task Templates** - One-click preset commands
- **System Tray** - Background operation with status

---

### 🖥️ System Tray Integration

- Shows aggregate status: "🟢 3 Agents Running"
- Per-watcher controls in context menu
- Minimize to tray when agents running
- App stays alive in background

**Menu:**
```
🟢 Momentum - 3 Agents Running
├─ Show Window
├─ ────────────────────
├─ 📁 Downloads (Running) → Pause | Stop
├─ 📁 Desktop (Paused) → Resume | Stop
├─ 📁 Receipts (Running) → Pause | Stop
├─ ────────────────────
├─ ⏹️ Stop All Agents
└─ ❌ Quit Momentum
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 ELECTRON APPLICATION                     │
├─────────────────────────────────────────────────────────┤
│  RENDERER PROCESS (React)                                │
│  ├── App.tsx (layout, routing)                          │
│  ├── AgentWorkspace.tsx (watcher cards)                 │
│  ├── StoragePanel.tsx (charts, analysis)                │
│  ├── FileTree.tsx (folder browser)                      │
│  └── stores/ (Zustand state management)                 │
├─────────────────────────────────────────────────────────┤
│  IPC BRIDGE (preload.ts)                                │
├─────────────────────────────────────────────────────────┤
│  MAIN PROCESS (Node.js)                                  │
│  ├── services/gemini/ (modular AI - 7 files)            │
│  │   ├── client.ts (initialization)                     │
│  │   ├── orchestrator.ts (2-layer routing)              │
│  │   ├── vision.ts (image analysis)                     │
│  │   ├── tools.ts (tool declarations)                   │
│  │   └── executor.ts (tool execution)                   │
│  ├── services/fileWatcher.ts (multi-watcher)            │
│  ├── services/storageAnalyzer.ts (disk analysis)        │
│  └── services/fileSystem.ts (file operations)           │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Desktop | Electron 28 | Native app container |
| Frontend | React 18 | UI components |
| Language | TypeScript | Type safety |
| State | Zustand | Global state management |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| Charts | Recharts | Data visualization |
| AI | @google/generative-ai | Gemini API SDK |
| File Watch | chokidar | File system monitoring |
| PDF | pdf-parse | PDF extraction |
| Word | mammoth | DOCX extraction |
| Excel | xlsx | Spreadsheet read/write |
| CSV | papaparse | CSV parsing |

---

## 🔧 Available AI Tools

| Tool | Description |
|------|-------------|
| `list_directory` | List files and folders with filters |
| `read_file` | Read and parse file contents |
| `write_file` | Create or overwrite files |
| `create_folder` | Create directories (nested) |
| `delete_file` | Move to trash with restore capability |
| `move_file` | Move files/folders |
| `rename_file` | Rename with AI suggestions |
| `copy_file` | Copy files/folders |
| `analyze_image` | Vision analysis for images |
| `analyze_storage` | Disk usage insights |
| `create_spreadsheet` | Generate formatted XLSX |

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Lines of Code | ~8,000 |
| React Components | 12 |
| Backend Services | 15 |
| AI Tools | 11 |
| Supported Platforms | 3 |
| Max Concurrent Agents | 5 |

---

## 📄 License

MIT