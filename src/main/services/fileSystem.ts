import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import { app } from 'electron'

// Types
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  children?: FileEntry[]
}

export interface FileInfo {
  size: number
  modified: string
  created: string
  isDirectory: boolean
  extension: string
}

export interface OperationResult {
  success: boolean
  error?: string
  data?: unknown
}

// Trash directory for safe deletions
const getTrashDir = (): string => {
  const trashPath = path.join(app.getPath('userData'), 'trash')
  if (!fsSync.existsSync(trashPath)) {
    fsSync.mkdirSync(trashPath, { recursive: true })
  }
  return trashPath
}

// Trash manifest to track original locations
interface TrashEntry {
  originalPath: string
  trashPath: string
  deletedAt: string
  name: string
}

const getTrashManifestPath = (): string => {
  return path.join(app.getPath('userData'), 'trash-manifest.json')
}

const loadTrashManifest = async (): Promise<TrashEntry[]> => {
  try {
    const data = await fs.readFile(getTrashManifestPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

const saveTrashManifest = async (manifest: TrashEntry[]): Promise<void> => {
  await fs.writeFile(getTrashManifestPath(), JSON.stringify(manifest, null, 2))
}

// Helper: Get file extension
export const getExtension = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase()
  return ext.startsWith('.') ? ext.slice(1) : ext
}

// Read directory contents
export const readDirectory = async (
  dirPath: string, 
  depth = 0, 
  maxDepth = 1
): Promise<FileEntry[]> => {
  const entries: FileEntry[] = []
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const item of items) {
      // Skip hidden files and system folders
      if (item.name.startsWith('.')) continue
      if (item.name === 'node_modules') continue
      if (item.name === '$RECYCLE.BIN') continue
      if (item.name === 'System Volume Information') continue
      
      const fullPath = path.join(dirPath, item.name)
      
      try {
        const stats = await fs.stat(fullPath)
        const entry: FileEntry = {
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          size: stats.size,
          modified: stats.mtime.toISOString()
        }
        
        if (item.isDirectory() && depth < maxDepth) {
          entry.children = await readDirectory(fullPath, depth + 1, maxDepth)
        } else if (item.isDirectory()) {
          entry.children = []
        }
        
        entries.push(entry)
      } catch {
        continue
      }
    }
    
    // Sort: directories first, then alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
    
  } catch (err) {
    console.error('Error reading directory:', err)
  }
  
  return entries
}

// Get file info
export const getFileInfo = async (filePath: string): Promise<FileInfo> => {
  const stats = await fs.stat(filePath)
  return {
    size: stats.size,
    modified: stats.mtime.toISOString(),
    created: stats.birthtime.toISOString(),
    isDirectory: stats.isDirectory(),
    extension: getExtension(filePath)
  }
}

// Read file content
export const readFile = async (filePath: string): Promise<string> => {
  return await fs.readFile(filePath, 'utf-8')
}

// Read file as buffer (for binary files)
export const readFileBuffer = async (filePath: string): Promise<Buffer> => {
  return await fs.readFile(filePath)
}

// Write file
export const writeFile = async (
  filePath: string, 
  content: string
): Promise<OperationResult> => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Create folder
export const createFolder = async (folderPath: string): Promise<OperationResult> => {
  try {
    await fs.mkdir(folderPath, { recursive: true })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Delete file/folder (move to trash)
export const deleteFile = async (filePath: string): Promise<OperationResult> => {
  try {
    const stats = await fs.stat(filePath)
    const trashDir = getTrashDir()
    const timestamp = Date.now()
    const fileName = path.basename(filePath)
    const trashName = `${timestamp}-${fileName}`
    const trashPath = path.join(trashDir, trashName)
    
    // Move to trash
    await fs.rename(filePath, trashPath)
    
    // Update manifest
    const manifest = await loadTrashManifest()
    manifest.unshift({
      originalPath: filePath,
      trashPath,
      deletedAt: new Date().toISOString(),
      name: fileName
    })
    
    // Keep only last 100 items in manifest
    await saveTrashManifest(manifest.slice(0, 100))
    
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Permanently delete (bypass trash)
export const permanentDelete = async (filePath: string): Promise<OperationResult> => {
  try {
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive: true })
    } else {
      await fs.unlink(filePath)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Move file/folder
export const moveFile = async (
  sourcePath: string, 
  destPath: string
): Promise<OperationResult> => {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destPath)
    await fs.mkdir(destDir, { recursive: true })
    
    await fs.rename(sourcePath, destPath)
    return { success: true }
  } catch (err) {
    // If rename fails (cross-device), try copy + delete
    try {
      await fs.cp(sourcePath, destPath, { recursive: true })
      await fs.rm(sourcePath, { recursive: true })
      return { success: true }
    } catch (copyErr) {
      return { success: false, error: String(copyErr) }
    }
  }
}

// Rename file/folder
export const renameFile = async (
  filePath: string, 
  newName: string
): Promise<OperationResult> => {
  try {
    const dir = path.dirname(filePath)
    const newPath = path.join(dir, newName)
    
    // Check if target already exists
    try {
      await fs.access(newPath)
      return { success: false, error: 'A file with this name already exists' }
    } catch {
      // File doesn't exist, good to proceed
    }
    
    await fs.rename(filePath, newPath)
    return { success: true, data: { newPath } }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Copy file/folder
export const copyFile = async (
  sourcePath: string, 
  destPath: string
): Promise<OperationResult> => {
  try {
    const destDir = path.dirname(destPath)
    await fs.mkdir(destDir, { recursive: true })
    
    await fs.cp(sourcePath, destPath, { recursive: true })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Get trash contents
export const getTrashContents = async (): Promise<TrashEntry[]> => {
  return await loadTrashManifest()
}

// Restore from trash
export const restoreFromTrash = async (trashPath: string): Promise<OperationResult> => {
  try {
    const manifest = await loadTrashManifest()
    const entry = manifest.find(e => e.trashPath === trashPath)
    
    if (!entry) {
      return { success: false, error: 'Item not found in trash' }
    }
    
    // Ensure original directory exists
    const originalDir = path.dirname(entry.originalPath)
    await fs.mkdir(originalDir, { recursive: true })
    
    // Move back
    await fs.rename(trashPath, entry.originalPath)
    
    // Update manifest
    const newManifest = manifest.filter(e => e.trashPath !== trashPath)
    await saveTrashManifest(newManifest)
    
    return { success: true, data: { restoredPath: entry.originalPath } }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Empty trash
export const emptyTrash = async (): Promise<OperationResult> => {
  try {
    const trashDir = getTrashDir()
    const items = await fs.readdir(trashDir)
    
    for (const item of items) {
      await fs.rm(path.join(trashDir, item), { recursive: true })
    }
    
    await saveTrashManifest([])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Check if path exists
export const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// Get directory size
export const getDirectorySize = async (dirPath: string): Promise<number> => {
  let totalSize = 0
  
  const calculateSize = async (currentPath: string): Promise<void> => {
    const stats = await fs.stat(currentPath)
    
    if (stats.isDirectory()) {
      const items = await fs.readdir(currentPath)
      for (const item of items) {
        await calculateSize(path.join(currentPath, item))
      }
    } else {
      totalSize += stats.size
    }
  }
  
  await calculateSize(dirPath)
  return totalSize
}