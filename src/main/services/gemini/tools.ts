// ============ TOOL DECLARATIONS ============

export const fileTools = [
  {
    name: 'list_directory',
    description: 'List all files and folders in a directory. Returns names, sizes, and types.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to the directory' }
      },
      required: ['path']
    }
  },
  {
    name: 'read_file',
    description: `Read and return the contents of a file. Supports:
- Documents: PDF, DOCX (extracts text)
- Spreadsheets: XLSX, XLS, CSV (extracts data)
- Code: JS, TS, PY, HTML, CSS, etc.
- Data: JSON, XML, YAML
- Text: TXT, MD, LOG
Use this to analyze document contents, read data files, or view code.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to the file' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write text content to a file. Creates new file or overwrites existing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path for the file' },
        content: { type: 'STRING', description: 'The text content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_folder',
    description: 'Create a new directory/folder.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path for the new folder' }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_file',
    description:
      'Queue a file or folder for deletion. The deletion is NOT immediate - it will be added to the Review panel where the user must approve it before the file is actually deleted. This ensures user safety.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to delete' }
      },
      required: ['path']
    }
  },
  {
    name: 'move_file',
    description: 'Move a file or folder from one location to another.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source_path: { type: 'STRING', description: 'The full absolute path of the source' },
        destination_path: {
          type: 'STRING',
          description: 'The full absolute path of the destination'
        }
      },
      required: ['source_path', 'destination_path']
    }
  },
  {
    name: 'rename_file',
    description: 'Rename a file or folder.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to the file/folder' },
        new_name: { type: 'STRING', description: 'The new name (filename only, not full path)' }
      },
      required: ['path', 'new_name']
    }
  },
  {
    name: 'copy_file',
    description: 'Copy a file or folder to a new location.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source_path: { type: 'STRING', description: 'The full absolute path of the source' },
        destination_path: {
          type: 'STRING',
          description: 'The full absolute path for the copy'
        }
      },
      required: ['source_path', 'destination_path']
    }
  },
  {
    name: 'analyze_storage',
    description: `Analyze disk usage in a folder and provide detailed insights.
Shows:
- Total size and file count
- Breakdown by file type (Videos, Images, Documents, etc.)
- Largest files (top 20)
- Old files (older than 6 months)
- Cleanup suggestions

Use this when user asks about:
- "What's taking up space?"
- "Show me large files"
- "What files can I delete?"
- "Storage analysis"
- "Disk usage"`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the folder to analyze'
        },
        depth: {
          type: 'NUMBER',
          description:
            'How many subfolders deep to scan (1-5, default 3). Higher = more thorough but slower.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'analyze_image',
    description: `Analyze an image file using AI vision. Use this for:
- Extracting text from receipts, invoices, business cards
- Reading data from screenshots, photos of documents
- Describing image contents
- Extracting structured data (dates, amounts, names, etc.)
Returns the extracted information as text.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the image file (PNG, JPG, JPEG, GIF, WEBP)'
        },
        prompt: {
          type: 'STRING',
          description:
            'What to extract or analyze from the image. Be specific, e.g., "Extract vendor name, date, total amount, and itemized list" for receipts.'
        }
      },
      required: ['path', 'prompt']
    }
  },
  {
    name: 'create_spreadsheet',
    description: `Create an Excel spreadsheet (.xlsx) with data, headers, and optional formulas.
Use this for:
- Creating data reports
- Exporting file lists
- Building tables from extracted data
- Any tabular data output
The spreadsheet will include auto-filter, frozen headers, and SUM formulas for numeric columns.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path for the new .xlsx file'
        },
        sheet_name: {
          type: 'STRING',
          description: 'Name of the worksheet (default: Sheet1)'
        },
        columns: {
          type: 'STRING',
          description:
            'JSON array of column definitions. Each column: {"header": "Display Name", "key": "dataKey", "width": 15}. Example: [{"header":"Name","key":"name","width":20},{"header":"Amount","key":"amount","width":12}]'
        },
        rows: {
          type: 'STRING',
          description:
            'JSON array of row objects. Each row has keys matching column keys. Example: [{"name":"Item 1","amount":100},{"name":"Item 2","amount":200}]'
        }
      },
      required: ['path', 'columns', 'rows']
    }
  },
  {
    name: 'create_expense_report',
    description: `Create a formatted expense report spreadsheet from receipt/expense data.
Automatically includes:
- Columns: Date, Vendor, Category, Description, Amount
- Auto-sorted by date
- Category subtotals
- Grand total with SUM formula
- Auto-filter and frozen headers
Use this after extracting data from receipts with analyze_image.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path for the expense report .xlsx file'
        },
        expenses: {
          type: 'STRING',
          description:
            'JSON array of expense objects. Each expense: {"vendor": "Store Name", "date": "2024-01-15", "category": "Food", "description": "Lunch", "amount": 25.50}. Amount should be a number.'
        }
      },
      required: ['path', 'expenses']
    }
  },
  {
    name: 'organize_files',
    description: `Organize files in a folder by automatically categorizing them into subfolders.
Categories: Images, Documents, Spreadsheets, Presentations, Code, Web, Data, Archives, Videos, Audio, Fonts, Design, Ebooks, Markdown, Executables, Other.
Also detects junk/system files (.DS_Store, Thumbs.db, etc.) that can be safely deleted.

Returns a plan showing what will be done. Use execute_organization to apply the plan.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the folder to organize'
        },
        include_subfolders: {
          type: 'BOOLEAN',
          description: 'Whether to scan subfolders too (default: false)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'execute_organization',
    description: `Execute a file organization plan created by organize_files.
Moves files into category folders and optionally deletes junk files.
Files are moved to trash (recoverable) not permanently deleted.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the folder to organize'
        },
        delete_junk: {
          type: 'BOOLEAN',
          description: 'Whether to delete detected junk files (default: false)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'process_receipts',
    description: `Process multiple receipt images in a folder and create an expense report.
Automatically:
1. Finds all image files in the folder (jpg, png, etc.)
2. Analyzes each image with AI Vision to extract: vendor, date, amount, category
3. Creates a formatted Excel expense report with all extracted data
4. Includes totals and category breakdowns

Use this for batch processing receipts, invoices, or any expense-related images.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        folder_path: {
          type: 'STRING',
          description: 'The full absolute path to the folder containing receipt images'
        },
        output_path: {
          type: 'STRING',
          description: 'The full absolute path for the output expense report .xlsx file'
        },
        category_hint: {
          type: 'STRING',
          description:
            'Optional hint for categorization (e.g., "business travel", "office supplies")'
        }
      },
      required: ['folder_path', 'output_path']
    }
  },
  {
    name: 'smart_rename',
    description: `Intelligently rename a file based on its content.
For images: Uses Vision to detect content and generate descriptive name
For documents: Extracts title/subject from content
For receipts: Extracts vendor, date, amount for naming

Example results:
- Receipt image → "2026-01-15_Starbucks_$8.50.jpg"
- Screenshot → "VSCode_Python_Debug.png"  
- Document → "Q4_Sales_Report.pdf"`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the file to rename'
        },
        naming_style: {
          type: 'STRING',
          description:
            'Optional style: "receipt" (date_vendor_amount), "descriptive" (content-based), "dated" (date_originalname). Default: auto-detect'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'categorize_images',
    description: `Categorize images in a folder using AI Vision and organize them into subfolders.
Categories: Receipts, Screenshots, Photos, Documents, Memes, Artwork, Other.

Process:
1. Scans folder for all image files
2. Analyzes each image with Vision to determine category
3. Shows categorization plan for user review
4. Creates category subfolders and moves images

Use this to organize messy image folders, sort downloads, or separate different types of images.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        folder_path: {
          type: 'STRING',
          description: 'The full absolute path to the folder containing images'
        },
        execute: {
          type: 'BOOLEAN',
          description: 'If true, execute the organization. If false/omitted, just show the plan.'
        }
      },
      required: ['folder_path']
    }
  }
]

export const googleTools = [
  {
    name: 'export_to_google_sheets',
    description: `Export data to a new Google Sheet. Creates a formatted spreadsheet with headers, auto-filter, and returns a shareable link.
Requires: User must be signed into Google.
Use this when user asks to "put in Google Sheets", "upload to Sheets", "create a Google spreadsheet", etc.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title for the Google Sheet' },
        headers: {
          type: 'STRING',
          description: 'JSON array of column headers. Example: ["Name", "Date", "Amount"]'
        },
        rows: {
          type: 'STRING',
          description: 'JSON array of row arrays. Example: [["Item 1", "2024-01-15", 100]]'
        },
        sheet_name: { type: 'STRING', description: 'Optional worksheet name (default: Sheet1)' }
      },
      required: ['title', 'headers', 'rows']
    }
  },
  {
    name: 'create_expense_report_sheets',
    description: `Create an expense report directly in Google Sheets with professional formatting.
Includes: Expenses sheet with all line items, Summary sheet with category totals, currency formatting, and auto-filter.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title for the expense report' },
        expenses: {
          type: 'STRING',
          description:
            'JSON array of expense objects. Each: {"vendor": "Store", "date": "2024-01-15", "category": "Food", "description": "Lunch", "amount": 25.50}'
        }
      },
      required: ['title', 'expenses']
    }
  },
  {
    name: 'search_gmail',
    description: `Search Gmail for emails matching criteria.
Returns: List of emails with subject, sender, date, and attachment info.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description:
            'Gmail search query. Examples: "from:amazon receipt", "invoice after:2024/01/01"'
        },
        max_results: { type: 'STRING', description: 'Maximum emails to return (default: 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'download_gmail_receipts',
    description: `Search Gmail for receipt/invoice emails and download their attachments.
Automatically filters for PDF and image attachments.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Gmail search query (e.g., "after:2024/01/01")' },
        output_folder: { type: 'STRING', description: 'Folder where attachments will be saved' },
        max_emails: { type: 'STRING', description: 'Maximum emails to search (default: 20)' }
      },
      required: ['query', 'output_folder']
    }
  },
  {
    name: 'gmail_to_expense_report',
    description: `Complete workflow: Search Gmail for receipts, download attachments, analyze with Vision, and create expense report in Google Sheets.
This is the full "Gmail → Sheets" pipeline in one command.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        gmail_query: {
          type: 'STRING',
          description: 'Gmail search query (e.g., "after:2024/01/01")'
        },
        report_title: { type: 'STRING', description: 'Title for the expense report' },
        category_hint: {
          type: 'STRING',
          description: 'Optional category hint (e.g., "business travel")'
        }
      },
      required: ['gmail_query', 'report_title']
    }
  }
]

// Combine all tools
export const allTools = [...fileTools, ...googleTools]
