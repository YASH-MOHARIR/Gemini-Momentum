# Momentum

**AI-powered desktop agent for autonomous file management**

Momentum gives you an AI coworker that watches your folders, organizes files, extracts data from receipts, and creates reports—all running in the background.

---

## ✨ Features

### Multiple AI Agents (Max 5)
Run up to 5 concurrent file watchers, each with independent rules and statistics.

```
"PDFs to Documents folder"
"Receipts - use Vision, rename with vendor/date/amount"
"Screenshots to Screenshots folder"
```

### Vision & Smart Rename
Gemini Vision analyzes images to extract data and generate semantic filenames.

| Before | After |
|--------|-------|
| `IMG_3847.jpg` | `2026-01-17_Starbucks_Receipt_$8.50.jpg` |
| `Screenshot 2026-01-17.png` | `Momentum_App_UI_Mockup.png` |

### Google Integration
- **Gmail:** Search and download receipt attachments
- **Sheets:** Export expense reports with one click
- **End-to-end:** "Create expense report from Gmail receipts" → Shareable link

### Storage Analyzer
Interactive charts showing disk usage by type, largest files, and cleanup suggestions.

### 2-Layer AI Orchestrator
Intelligent model routing reduces API costs by 70% while maintaining accuracy.

```
Request → Router (Flash-Minimal) → Optimal Model → Response
              ↓
    ┌─────────┴─────────┐
    │ Flash │ Flash-High │ Pro │
    │ Simple│ Vision     │Complex│
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 28 |
| Frontend | React 18 + TypeScript |
| State | Zustand |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| AI | Gemini API |
| File Watch | chokidar |
| Documents | pdf-parse, mammoth, xlsx |

---

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/yourusername/momentum.git
cd momentum

# Install dependencies
npm install

# Add your Gemini API key
echo "GEMINI_API_KEY=your-key-here" > .env

# Run development
npm run dev

# Build for production
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Get your API key at [Google AI Studio](https://aistudio.google.com/apikey).

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│  RENDERER (React)                               │
│  ├── Chat Mode (AI conversations)               │
│  ├── Agent Mode (watcher management)            │
│  └── Storage Panel (analysis & charts)          │
├─────────────────────────────────────────────────┤
│  IPC BRIDGE                                     │
├─────────────────────────────────────────────────┤
│  MAIN PROCESS (Node.js)                         │
│  ├── gemini/ (AI orchestrator)                  │
│  ├── fileWatcher.ts (multi-watcher service)     │
│  ├── storageAnalyzer.ts (disk analysis)         │
│  └── fileSystem.ts (file operations)            │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Available Tools

| Tool | Description |
|------|-------------|
| `list_directory` | List files and folders |
| `read_file` | Read file contents (PDF, DOCX, XLSX, etc.) |
| `write_file` | Create or overwrite files |
| `create_folder` | Create directories |
| `delete_file` | Move to trash (with restore) |
| `move_file` | Move files/folders |
| `rename_file` | Rename with AI suggestions |
| `copy_file` | Copy files/folders |
| `analyze_image` | Vision analysis for images |
| `analyze_storage` | Disk usage insights |
| `create_spreadsheet` | Generate formatted XLSX |

---

## 📸 Screenshots

*Coming soon*

---

## 📄 License

MIT