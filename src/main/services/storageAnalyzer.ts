import * as fs from 'fs/promises'
import * as path from 'path'

// ============ Types ============

export interface FileItem {
  name: string
  path: string
  size: number
  modified: string
  age: number // days since modified
  extension: string
}

export interface CategoryStats {
  type: string
  size: number
  count: number
  percentage: number
  color: string
}

export interface StorageAnalysis {
  totalSize: number
  totalFiles: number
  folderPath: string
  byType: CategoryStats[]
  largestFiles: FileItem[]
  oldFiles: FileItem[]
  oldFilesSize: number
  suggestions: string[]
  scannedAt: string
}

// ============ Constants ============

const FILE_CATEGORIES = {
  'Videos': { extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'm4v'], color: '#ef4444' },
  'Images': { extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'bmp', 'ico'], color: '#8b5cf6' },
  'Archives': { extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'], color: '#f59e0b' },
  'Documents': { extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'], color: '#3b82f6' },
  'Spreadsheets': { extensions: ['xlsx', 'xls', 'csv', 'ods'], color: '#10b981' },
  'Audio': { extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma'], color: '#ec4899' },
  'Code': { extensions: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml', 'jsx', 'tsx'], color: '#06b6d4' },
  'Executables': { extensions: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'app'], color: '#84cc16' },
  'Other': { extensions: [], color: '#6b7280' }
}

const OLD_FILE_THRESHOLD_DAYS = 180 // 6 months
const LARGE_FILE_THRESHOLD_MB = 100

// ============ Helper Functions ============

function getCategoryForExtension(ext: string): string {
  ext = ext.toLowerCase().replace('.', '')
  
  for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
    if (config.extensions.includes(ext)) {
      return category
    }
  }
  
  return 'Other'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export { formatBytes }

function getFileAge(modifiedDate: Date): number {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - modifiedDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// ============ Main Analysis Function ============

async function scanDirectory(
  dirPath: string,
  files: FileItem[],
  depth: number = 0,
  maxDepth: number = 3
): Promise<void> {
  if (depth > maxDepth) return

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      // Skip hidden files and system folders
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'node_modules') continue
      if (entry.name === '$RECYCLE.BIN') continue
      if (entry.name === 'System Volume Information') continue

      try {
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, files, depth + 1, maxDepth)
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          const extension = path.extname(entry.name)
          const age = getFileAge(stats.mtime)

          files.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            age,
            extension
          })
        }
      } catch (err) {
        // Skip files we can't access (permissions, etc.)
        console.warn(`[STORAGE] Cannot access: ${fullPath}`)
      }
    }
  } catch (err) {
    console.error(`[STORAGE] Cannot read directory: ${dirPath}`, err)
  }
}

export async function analyzeStorage(
  folderPath: string,
  maxDepth: number = 3
): Promise<StorageAnalysis> {
  console.log(`[STORAGE] Analyzing: ${folderPath} (depth: ${maxDepth})`)

  const files: FileItem[] = []
  await scanDirectory(folderPath, files, 0, maxDepth)

  console.log(`[STORAGE] Found ${files.length} files`)

  // Calculate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  // Group by category
  const categoryMap = new Map<string, { size: number; count: number }>()

  for (const file of files) {
    const category = getCategoryForExtension(file.extension)
    const existing = categoryMap.get(category) || { size: 0, count: 0 }
    categoryMap.set(category, {
      size: existing.size + file.size,
      count: existing.count + 1
    })
  }

  // Convert to array with percentages
  const byType: CategoryStats[] = Array.from(categoryMap.entries())
    .map(([type, stats]) => ({
      type,
      size: stats.size,
      count: stats.count,
      percentage: (stats.size / totalSize) * 100,
      color: FILE_CATEGORIES[type as keyof typeof FILE_CATEGORIES]?.color || '#6b7280'
    }))
    .sort((a, b) => b.size - a.size)

  // Find largest files (top 20)
  const largestFiles = files
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)

  // Find old files (older than threshold)
  const oldFiles = files
    .filter(f => f.age > OLD_FILE_THRESHOLD_DAYS)
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)

  const oldFilesSize = oldFiles.reduce((sum, file) => sum + file.size, 0)

  // Generate suggestions
  const suggestions: string[] = []

  if (oldFilesSize > 100 * 1024 * 1024) { // > 100MB
    suggestions.push(`${formatBytes(oldFilesSize)} in files older than 6 months`)
  }

  const largeFiles = files.filter(f => f.size > LARGE_FILE_THRESHOLD_MB * 1024 * 1024)
  if (largeFiles.length > 5) {
    suggestions.push(`${largeFiles.length} files larger than ${LARGE_FILE_THRESHOLD_MB}MB`)
  }

  const topCategory = byType[0]
  if (topCategory && topCategory.percentage > 40) {
    suggestions.push(`${topCategory.type} files use ${topCategory.percentage.toFixed(0)}% of space`)
  }

  if (files.length > 1000) {
    suggestions.push(`${files.length} files total - consider organizing into folders`)
  }

  return {
    totalSize,
    totalFiles: files.length,
    folderPath,
    byType,
    largestFiles,
    oldFiles,
    oldFilesSize,
    suggestions,
    scannedAt: new Date().toISOString()
  }
}