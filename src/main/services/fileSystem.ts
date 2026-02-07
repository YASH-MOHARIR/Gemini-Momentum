import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import { app } from 'electron'
import * as fileParsers from './fileParsers'

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

// Trash directory
const getTrashDir = (): string => {
  const trashPath = path.join(app.getPath('userData'), 'trash')
  if (!fsSync.existsSync(trashPath)) {
    fsSync.mkdirSync(trashPath, { recursive: true })
  }
  return trashPath
}

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

// Get file extension
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

// Read file content (with parser support)
export const readFile = async (filePath: string): Promise<string> => {
  const ext = getExtension(filePath)

  // Use parser for supported document types
  if (['pdf', 'docx', 'xlsx', 'xls', 'csv'].includes(ext)) {
    const result = await fileParsers.parseFile(filePath)
    return `[${result.type}]\n\n${result.content}`
  }

  // Regular text files
  return await fs.readFile(filePath, 'utf-8')
}

// Read file as buffer (for binary files)
export const readFileBuffer = async (filePath: string): Promise<Buffer> => {
  return await fs.readFile(filePath)
}

// Parse file with type detection
export const parseFile = async (filePath: string): Promise<{ content: string; type: string }> => {
  return await fileParsers.parseFile(filePath)
}

// Check if file type is supported for parsing
export const isFileSupported = (filePath: string): boolean => {
  return fileParsers.isSupported(filePath)
}

// Get supported file types
export const getSupportedFileTypes = (): string[] => {
  return fileParsers.getSupportedTypes()
}

// Write file
export const writeFile = async (filePath: string, content: string): Promise<OperationResult> => {
  try {
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
    const trashDir = getTrashDir()
    const timestamp = Date.now()
    const fileName = path.basename(filePath)
    const trashName = `${timestamp}-${fileName}`
    const trashPath = path.join(trashDir, trashName)

    await fs.rename(filePath, trashPath)

    const manifest = await loadTrashManifest()
    manifest.unshift({
      originalPath: filePath,
      trashPath,
      deletedAt: new Date().toISOString(),
      name: fileName
    })

    await saveTrashManifest(manifest.slice(0, 100))

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Permanently delete
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

// ============ IMPROVED MOVE/COPY/RENAME ============

/**
 * Recursively copy a directory
 */
async function copyDirectoryRecursive(source: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Move a file or folder to a new location.
 * Handles cross-drive moves, special characters, and various edge cases.
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<OperationResult> {
  console.log(`[FS] Moving: ${sourcePath} → ${destPath}`)

  try {
    const normalizedSource = path.normalize(sourcePath)
    const normalizedDest = path.normalize(destPath)

    // Check if source exists
    try {
      await fs.access(normalizedSource)
    } catch {
      return { success: false, error: `Source does not exist: ${normalizedSource}` }
    }

    const sourceStats = await fs.stat(normalizedSource)

    // Determine if destination is a directory or full path
    let finalDest = normalizedDest
    try {
      const destStats = await fs.stat(normalizedDest)
      if (destStats.isDirectory()) {
        finalDest = path.join(normalizedDest, path.basename(normalizedSource))
      }
    } catch {
      // Destination doesn't exist - ensure parent exists
      const destDir = path.dirname(normalizedDest)
      await fs.mkdir(destDir, { recursive: true })
    }

    // Check if destination already exists
    try {
      await fs.access(finalDest)
      return { success: false, error: `Destination already exists: ${finalDest}` }
    } catch {
      // Good - destination doesn't exist
    }

    // Try simple rename first (works for same drive)
    try {
      await fs.rename(normalizedSource, finalDest)
      console.log(`[FS] Move successful (rename): ${finalDest}`)
      return { success: true, data: { newPath: finalDest } }
    } catch (renameError: unknown) {
      const error = renameError as NodeJS.ErrnoException

      // EXDEV = cross-device link, need to copy + delete
      if (error.code === 'EXDEV') {
        console.log(`[FS] Cross-drive move detected, using copy+delete`)

        try {
          if (sourceStats.isDirectory()) {
            await copyDirectoryRecursive(normalizedSource, finalDest)
          } else {
            await fs.copyFile(normalizedSource, finalDest)
          }

          // Delete source after successful copy
          if (sourceStats.isDirectory()) {
            await fs.rm(normalizedSource, { recursive: true, force: true })
          } else {
            await fs.unlink(normalizedSource)
          }

          console.log(`[FS] Move successful (copy+delete): ${finalDest}`)
          return { success: true, data: { newPath: finalDest } }
        } catch (copyError) {
          // Clean up partial copy
          try {
            await fs.rm(finalDest, { recursive: true, force: true })
          } catch {}
          return { success: false, error: `Copy failed during cross-drive move: ${copyError}` }
        }
      }

      // EPERM or EBUSY = file in use or permission issue
      if (error.code === 'EPERM' || error.code === 'EBUSY') {
        return { success: false, error: `File is in use or permission denied: ${normalizedSource}` }
      }

      // ENOENT = path component doesn't exist
      if (error.code === 'ENOENT') {
        return { success: false, error: `Path not found: ${error.path || normalizedSource}` }
      }

      return { success: false, error: `Move failed: ${error.message}` }
    }
  } catch (err) {
    console.error(`[FS] Move error:`, err)
    return { success: false, error: `Unexpected error: ${err}` }
  }
}

/**
 * Copy a file or folder to a new location.
 */
export async function copyFile(sourcePath: string, destPath: string): Promise<OperationResult> {
  console.log(`[FS] Copying: ${sourcePath} → ${destPath}`)

  try {
    const normalizedSource = path.normalize(sourcePath)
    const normalizedDest = path.normalize(destPath)

    // Check source exists
    try {
      await fs.access(normalizedSource)
    } catch {
      return { success: false, error: `Source does not exist: ${normalizedSource}` }
    }

    const sourceStats = await fs.stat(normalizedSource)

    // Determine final destination
    let finalDest = normalizedDest
    try {
      const destStats = await fs.stat(normalizedDest)
      if (destStats.isDirectory()) {
        finalDest = path.join(normalizedDest, path.basename(normalizedSource))
      }
    } catch {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(normalizedDest), { recursive: true })
    }

    // Check if destination already exists
    try {
      await fs.access(finalDest)
      return { success: false, error: `Destination already exists: ${finalDest}` }
    } catch {
      // Good
    }

    // Perform copy
    if (sourceStats.isDirectory()) {
      await copyDirectoryRecursive(normalizedSource, finalDest)
    } else {
      await fs.copyFile(normalizedSource, finalDest)
    }

    console.log(`[FS] Copy successful: ${finalDest}`)
    return { success: true, data: { newPath: finalDest } }
  } catch (err) {
    console.error(`[FS] Copy error:`, err)
    return { success: false, error: `Copy failed: ${err}` }
  }
}

/**
 * Rename a file or folder.
 */
export async function renameFile(filePath: string, newName: string): Promise<OperationResult> {
  console.log(`[FS] Renaming: ${filePath} → ${newName}`)

  try {
    const normalizedPath = path.normalize(filePath)

    // Check source exists
    try {
      await fs.access(normalizedPath)
    } catch {
      return { success: false, error: `File does not exist: ${normalizedPath}` }
    }

    // Build new path
    const dir = path.dirname(normalizedPath)
    const newPath = path.join(dir, newName)

    // Check if new name already exists
    try {
      await fs.access(newPath)
      return { success: false, error: `A file with name "${newName}" already exists` }
    } catch {
      // Good
    }

    // Perform rename
    await fs.rename(normalizedPath, newPath)

    console.log(`[FS] Rename successful: ${newPath}`)
    return { success: true, data: { newPath } }
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException
    console.error(`[FS] Rename error:`, error)

    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      return { success: false, error: `File is in use or permission denied` }
    }

    return { success: false, error: `Rename failed: ${error.message}` }
  }
}

// ============ TRASH OPERATIONS ============

export const getTrashContents = async (): Promise<TrashEntry[]> => {
  return await loadTrashManifest()
}

export const restoreFromTrash = async (trashPath: string): Promise<OperationResult> => {
  try {
    const manifest = await loadTrashManifest()
    const entry = manifest.find((e) => e.trashPath === trashPath)

    if (!entry) {
      return { success: false, error: 'Item not found in trash' }
    }

    const originalDir = path.dirname(entry.originalPath)
    await fs.mkdir(originalDir, { recursive: true })

    await fs.rename(trashPath, entry.originalPath)

    const newManifest = manifest.filter((e) => e.trashPath !== trashPath)
    await saveTrashManifest(newManifest)

    return { success: true, data: { restoredPath: entry.originalPath } }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

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
