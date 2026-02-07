import * as fileSystem from './fileSystem'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface PendingAction {
  id: string
  type: 'delete' | 'move' | 'rename' | 'overwrite'
  sourcePath: string
  destinationPath?: string
  fileName: string
  fileSize: number
  reason?: string
  createdAt: string
}

export interface ActionResult {
  id: string
  success: boolean
  error?: string
}

// In-memory queue of pending actions
let pendingQueue: PendingAction[] = []
let actionIdCounter = 0

function generateId(): string {
  return `action_${Date.now()}_${++actionIdCounter}`
}

export async function queueDeletion(filePath: string, reason?: string): Promise<PendingAction> {
  try {
    const stats = await fs.stat(filePath)
    const action: PendingAction = {
      id: generateId(),
      type: 'delete',
      sourcePath: filePath,
      fileName: path.basename(filePath),
      fileSize: stats.size,
      reason,
      createdAt: new Date().toISOString()
    }

    pendingQueue.push(action)
    console.log(`[PENDING] Queued deletion: ${action.fileName}`)

    return action
  } catch (error) {
    throw new Error(`Failed to queue deletion: ${error}`)
  }
}

export async function queueMultipleDeletions(
  filePaths: string[],
  reason?: string
): Promise<PendingAction[]> {
  const actions: PendingAction[] = []

  for (const filePath of filePaths) {
    try {
      const action = await queueDeletion(filePath, reason)
      actions.push(action)
    } catch (error) {
      console.error(`[PENDING] Failed to queue ${filePath}:`, error)
    }
  }

  return actions
}

export function getPendingActions(): PendingAction[] {
  return [...pendingQueue]
}

export function getPendingCount(): number {
  return pendingQueue.length
}

export function clearPendingActions(): void {
  pendingQueue = []
  console.log('[PENDING] Queue cleared')
}

export function removeAction(actionId: string): boolean {
  const index = pendingQueue.findIndex((a) => a.id === actionId)
  if (index !== -1) {
    const action = pendingQueue[index]
    pendingQueue.splice(index, 1)
    console.log(`[PENDING] Removed from queue (kept): ${action.fileName}`)
    return true
  }
  return false
}

export async function executeAction(actionId: string): Promise<ActionResult> {
  const index = pendingQueue.findIndex((a) => a.id === actionId)

  if (index === -1) {
    return { id: actionId, success: false, error: 'Action not found in queue' }
  }

  const action = pendingQueue[index]

  try {
    if (action.type === 'delete') {
      await fileSystem.deleteFile(action.sourcePath)
    }

    pendingQueue.splice(index, 1)
    console.log(`[PENDING] Executed: ${action.type} ${action.fileName}`)

    return { id: actionId, success: true }
  } catch (error) {
    console.error(`[PENDING] Failed to execute ${action.type}:`, error)
    return { id: actionId, success: false, error: String(error) }
  }
}

export async function executeAllActions(): Promise<ActionResult[]> {
  const results: ActionResult[] = []
  const actionsToProcess = [...pendingQueue]

  for (const action of actionsToProcess) {
    const result = await executeAction(action.id)
    results.push(result)
  }

  return results
}

export async function executeSelectedActions(actionIds: string[]): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const id of actionIds) {
    const result = await executeAction(id)
    results.push(result)
  }

  return results
}

export function keepAllFiles(): number {
  const count = pendingQueue.length
  pendingQueue = []
  console.log(`[PENDING] Kept all ${count} files`)
  return count
}

export function getPendingSize(): number {
  return pendingQueue.reduce((sum, action) => sum + action.fileSize, 0)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
