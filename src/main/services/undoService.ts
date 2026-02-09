import * as fs from 'fs/promises'
import * as path from 'path'

export interface UndoOperation {
  id: string
  type: 'move' | 'rename' | 'delete' | 'create'
  timestamp: number
  originalPath: string
  newPath?: string
  originalName?: string
  newName?: string
  content?: string // For write_file operations
}

class UndoService {
  private operations: UndoOperation[] = []
  private readonly MAX_OPERATIONS = 100

  addOperation(operation: Omit<UndoOperation, 'id' | 'timestamp'>): string {
    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const op: UndoOperation = {
      ...operation,
      id,
      timestamp: Date.now()
    }
    
    this.operations.unshift(op) // Add to beginning
    if (this.operations.length > this.MAX_OPERATIONS) {
      this.operations = this.operations.slice(0, this.MAX_OPERATIONS)
    }
    
    return id
  }

  getRecentOperations(count = 10): UndoOperation[] {
    return this.operations.slice(0, count)
  }

  async undoOperation(operationId: string): Promise<{ success: boolean; error?: string }> {
    const index = this.operations.findIndex(op => op.id === operationId)
    if (index === -1) {
      return { success: false, error: 'Operation not found' }
    }

    const operation = this.operations[index]

    try {
      switch (operation.type) {
        case 'move':
          if (operation.newPath && operation.originalPath) {
            // Move back to original location
            await fs.rename(operation.newPath, operation.originalPath)
            // Remove from history after successful undo
            this.operations.splice(index, 1)
            return { success: true }
          }
          break

        case 'rename':
          if (operation.originalName && operation.newPath) {
            // Restore original name - file is currently at newPath
            const dir = path.dirname(operation.newPath)
            const originalPath = path.join(dir, operation.originalName)
            await fs.rename(operation.newPath, originalPath)
            // Remove from history after successful undo
            this.operations.splice(index, 1)
            return { success: true }
          }
          break

        case 'delete':
          // Note: Deletions go to trash, so we'd need to restore from trash
          // For now, we'll just note that undo isn't fully supported for deletions
          return { success: false, error: 'Undo for deletions requires restoring from trash (not yet implemented)' }

        case 'create':
          if (operation.newPath) {
            // Delete the created file/folder
            try {
              const stats = await fs.stat(operation.newPath)
              if (stats.isDirectory()) {
                await fs.rm(operation.newPath, { recursive: true, force: true })
              } else {
                await fs.unlink(operation.newPath)
              }
              // Remove from history after successful undo
              this.operations.splice(index, 1)
              return { success: true }
            } catch (err) {
              return { success: false, error: `Failed to delete created item: ${err}` }
            }
          }
          break
      }

      return { success: false, error: 'Invalid operation type or missing data' }
    } catch (error) {
      return { success: false, error: `Undo failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  clearHistory(): void {
    this.operations = []
  }
}

export const undoService = new UndoService()
