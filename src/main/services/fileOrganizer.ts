import * as fs from 'fs/promises'
import * as path from 'path'
import * as fileSystem from './fileSystem'
import * as pendingActions from './pendingActions'

// File category definitions
export const FILE_CATEGORIES: Record<string, string[]> = {
  Images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif', 'tiff', 'raw'],
  Documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'],
  Spreadsheets: ['xlsx', 'xls', 'csv', 'numbers', 'ods'],
  Presentations: ['ppt', 'pptx', 'key', 'odp'],
  Code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt'],
  Web: ['html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte'],
  Data: ['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env', 'sql'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  Videos: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v'],
  Audio: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'],
  Fonts: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
  Design: ['psd', 'ai', 'sketch', 'fig', 'xd', 'indd'],
  Ebooks: ['epub', 'mobi', 'azw', 'azw3'],
  Markdown: ['md', 'mdx', 'markdown'],
  Executables: ['exe', 'msi', 'dmg', 'app', 'deb', 'rpm'],
}

// System/junk files that should be flagged for deletion
export const JUNK_PATTERNS = [
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.Spotlight-V100',
  '.Trashes',
  '~$*',  // Office temp files
  '*.tmp',
  '*.temp',
  '.fseventsd',
  '.DocumentRevisions-V100',
  '.TemporaryItems',
]

export interface FileInfo {
  name: string
  path: string
  extension: string
  size: number
  modified: string
  category: string
  isJunk: boolean
}

export interface OrganizationPlan {
  totalFiles: number
  categories: Record<string, FileInfo[]>
  junkFiles: FileInfo[]
  uncategorized: FileInfo[]
  actions: OrganizationAction[]
}

export interface OrganizationAction {
  type: 'move' | 'delete'
  sourcePath: string
  destinationPath?: string
  fileName: string
  category?: string
}

export interface OrganizationResult {
  success: boolean
  filesMoved: number
  filesDeleted: number
  foldersCreated: string[]
  errors: string[]
  summary: Record<string, number>
}

/**
 * Detect the category for a file based on its extension
 */
export function detectCategory(filename: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1)
  
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category
    }
  }
  
  return 'Other'
}

/**
 * Check if a file is a system/junk file
 */
export function isJunkFile(filename: string): boolean {
  const name = path.basename(filename)
  
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.includes('*')) {
      // Wildcard pattern
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      if (regex.test(name)) return true
    } else {
      // Exact match
      if (name === pattern) return true
    }
  }
  
  // Check for hidden files (starting with .)
  if (name.startsWith('.') && name !== '.gitignore' && name !== '.env') {
    return true
  }
  
  return false
}

/**
 * Scan a directory and create an organization plan
 */
export async function createOrganizationPlan(
  dirPath: string,
  options: { includeSubfolders?: boolean } = {}
): Promise<OrganizationPlan> {
  const { includeSubfolders = false } = options
  
  const categories: Record<string, FileInfo[]> = {}
  const junkFiles: FileInfo[] = []
  const uncategorized: FileInfo[] = []
  const actions: OrganizationAction[] = []
  let totalFiles = 0

  async function scanDirectory(currentPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        
        if (entry.isDirectory()) {
          if (includeSubfolders) {
            await scanDirectory(fullPath)
          }
          continue
        }
        
        totalFiles++
        
        const stats = await fs.stat(fullPath)
        const ext = path.extname(entry.name).toLowerCase().slice(1)
        const category = detectCategory(entry.name)
        const isJunk = isJunkFile(entry.name)
        
        const fileInfo: FileInfo = {
          name: entry.name,
          path: fullPath,
          extension: ext,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          category,
          isJunk
        }
        
        if (isJunk) {
          junkFiles.push(fileInfo)
          actions.push({
            type: 'delete',
            sourcePath: fullPath,
            fileName: entry.name
          })
        } else if (category === 'Other') {
          uncategorized.push(fileInfo)
        } else {
          if (!categories[category]) {
            categories[category] = []
          }
          categories[category].push(fileInfo)
          
          // Add move action
          const destFolder = path.join(dirPath, category)
          const destPath = path.join(destFolder, entry.name)
          
          // Only add action if file isn't already in the right folder
          if (path.dirname(fullPath) !== destFolder) {
            actions.push({
              type: 'move',
              sourcePath: fullPath,
              destinationPath: destPath,
              fileName: entry.name,
              category
            })
          }
        }
      }
    } catch (error) {
      console.error(`[ORGANIZER] Error scanning ${currentPath}:`, error)
    }
  }
  
  await scanDirectory(dirPath)
  
  return {
    totalFiles,
    categories,
    junkFiles,
    uncategorized,
    actions
  }
}

/**
 * Execute the organization plan (move files, queue junk for review)
 */
export async function executeOrganization(
  dirPath: string,
  plan: OrganizationPlan,
  options: { deleteJunk?: boolean; dryRun?: boolean } = {}
): Promise<OrganizationResult> {
  const { deleteJunk = false, dryRun = false } = options
  
  const result: OrganizationResult = {
    success: true,
    filesMoved: 0,
    filesDeleted: 0,
    foldersCreated: [],
    errors: [],
    summary: {}
  }
  
  // Create category folders first
  const categoriesToCreate = new Set<string>()
  for (const action of plan.actions) {
    if (action.type === 'move' && action.category) {
      categoriesToCreate.add(action.category)
    }
  }
  
  for (const category of categoriesToCreate) {
    const folderPath = path.join(dirPath, category)
    try {
      if (!dryRun) {
        await fs.mkdir(folderPath, { recursive: true })
      }
      result.foldersCreated.push(folderPath)
      console.log(`[ORGANIZER] Created folder: ${category}`)
    } catch (error) {
      // Folder might already exist, which is fine
    }
  }
  
  // Execute move actions
  for (const action of plan.actions) {
    if (action.type === 'move' && action.destinationPath) {
      try {
        if (!dryRun) {
          // Check if destination already exists
          try {
            await fs.access(action.destinationPath)
            // File exists, add suffix
            const ext = path.extname(action.destinationPath)
            const base = path.basename(action.destinationPath, ext)
            const dir = path.dirname(action.destinationPath)
            const newDest = path.join(dir, `${base}_${Date.now()}${ext}`)
            await fs.rename(action.sourcePath, newDest)
          } catch {
            // Destination doesn't exist, safe to move
            await fs.rename(action.sourcePath, action.destinationPath)
          }
        }
        result.filesMoved++
        result.summary[action.category || 'Other'] = (result.summary[action.category || 'Other'] || 0) + 1
        console.log(`[ORGANIZER] Moved: ${action.fileName} → ${action.category}`)
      } catch (error) {
        result.errors.push(`Failed to move ${action.fileName}: ${error}`)
        console.error(`[ORGANIZER] Error moving ${action.fileName}:`, error)
      }
    }
  }
  
  // Queue delete actions (junk files) for review instead of immediate deletion
  if (deleteJunk) {
    const junkPaths = plan.actions
      .filter(a => a.type === 'delete')
      .map(a => a.sourcePath)
    
    if (junkPaths.length > 0 && !dryRun) {
      await pendingActions.queueMultipleDeletions(junkPaths, 'Junk/system file')
      result.filesDeleted = junkPaths.length
      console.log(`[ORGANIZER] Queued ${junkPaths.length} junk files for review`)
    }
  }
  
  if (result.errors.length > 0) {
    result.success = false
  }
  
  return result
}

/**
 * Get a text summary of the organization plan
 */
export function getPlanSummary(plan: OrganizationPlan): string {
  const lines: string[] = []
  
  lines.push(`**Organization Plan**`)
  lines.push(``)
  lines.push(`Total files scanned: ${plan.totalFiles}`)
  lines.push(``)
  
  if (Object.keys(plan.categories).length > 0) {
    lines.push(`**Files by Category:**`)
    for (const [category, files] of Object.entries(plan.categories)) {
      lines.push(`• ${category}: ${files.length} files`)
    }
    lines.push(``)
  }
  
  if (plan.uncategorized.length > 0) {
    lines.push(`**Uncategorized:** ${plan.uncategorized.length} files`)
    lines.push(``)
  }
  
  if (plan.junkFiles.length > 0) {
    lines.push(`**Junk/System Files:** ${plan.junkFiles.length} files`)
    for (const file of plan.junkFiles.slice(0, 5)) {
      lines.push(`• ${file.name}`)
    }
    if (plan.junkFiles.length > 5) {
      lines.push(`• ... and ${plan.junkFiles.length - 5} more`)
    }
    lines.push(``)
  }
  
  const moveCount = plan.actions.filter(a => a.type === 'move').length
  lines.push(`**Actions to perform:** ${moveCount} files to move`)
  
  return lines.join('\n')
}

/**
 * Get a text summary of the organization result
 */
export function getResultSummary(result: OrganizationResult): string {
  const lines: string[] = []
  
  lines.push(`**Organization Complete**`)
  lines.push(``)
  lines.push(`• Files moved: ${result.filesMoved}`)
  
  if (result.filesDeleted > 0) {
    lines.push(`• Junk files queued for review: ${result.filesDeleted}`)
  }
  
  if (result.foldersCreated.length > 0) {
    lines.push(`• Folders created: ${result.foldersCreated.length}`)
  }
  
  if (Object.keys(result.summary).length > 0) {
    lines.push(``)
    lines.push(`**Files by Category:**`)
    for (const [category, count] of Object.entries(result.summary)) {
      lines.push(`• ${category}: ${count}`)
    }
  }
  
  if (result.filesDeleted > 0) {
    lines.push(``)
    lines.push(`⚠️ Check the **Review** tab to approve or keep the junk files.`)
  }
  
  if (result.errors.length > 0) {
    lines.push(``)
    lines.push(`**Errors:** ${result.errors.length}`)
    for (const error of result.errors.slice(0, 3)) {
      lines.push(`• ${error}`)
    }
  }
  
  return lines.join('\n')
}