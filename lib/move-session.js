/**
 * Session workspace moves — IMPLEMENTED BUT NOT WIRED UP.
 *
 * This module relocates one Session into another Workspace by changing the three
 * places that together define membership: the Session directory under
 * `~/.dsh/sessions/<encoded-path>/`, the `cwd` field in the Session header, and
 * the Workspace roster in `~/.dsh/storages/workspace.json`. DSH's own internal
 * `attachSession` requires `cwd` to equal the Workspace path, which is why the
 * header must move with the roster.
 *
 * It is verified against copies of real data but nothing calls it: reaching it
 * from the UI needs a client-to-host channel, and DSH exposes none for a plugin
 * (client Remote namespaces are selected at build time by `dsh-api-remotes`, and
 * the Host-side extension points are either unreachable from the browser or
 * require generated codecs). Kept because the logic is correct and is the whole
 * hard part of the feature should a channel appear.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'

/** 路径 → 会话目录名：`/a/b` → `--a-b--` */
export function encodeWorkspaceDir(path) {
  return '--' + path.replace(/^\//, '').replace(/\//g, '-') + '--'
}

/** 解开 zstd 多 frame 的 JSONL */
function decodeSession(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const parts = []
  let start = 0
  for (let i = 1; i < buf.length - 3; i++) {
    if (buf.compare(MAGIC, 0, 4, i, i + 4) === 0) { parts.push(buf.subarray(start, i)); start = i }
  }
  parts.push(buf.subarray(start))
  let out = ''
  for (const part of parts) out += zstdDecompressSync(part).toString('utf8')
  return out
}

/**
 * 把一个会话移到另一个工作区：三处一致地改。
 * @returns 变更摘要，供调用方核对
 */
export function moveSession({ root, sessionId, targetWorkspaceId, dryRun = false }) {
  const storePath = join(root, 'storages', 'workspace.json')
  const store = JSON.parse(readFileSync(storePath, 'utf8'))
  const workspaces = store.tables.workspaces

  const source = Object.entries(workspaces).find(([, w]) => w.sessionIds.includes(sessionId))
  if (source === undefined) throw new Error(`会话不在任何工作区：${sessionId}`)
  const [sourceId, sourceWs] = source
  const targetWs = workspaces[targetWorkspaceId]
  if (targetWs === undefined) throw new Error(`目标工作区不存在：${targetWorkspaceId}`)
  if (sourceId === targetWorkspaceId) throw new Error('源与目标工作区相同')

  // 1) 会话目录：--旧路径--/ → --新路径--/
  const fromDir = join(root, 'sessions', encodeWorkspaceDir(sourceWs.path), sessionId)
  const toDir = join(root, 'sessions', encodeWorkspaceDir(targetWs.path), sessionId)
  if (!existsSync(fromDir)) throw new Error(`找不到会话目录：${fromDir}`)
  if (existsSync(toDir)) throw new Error(`目标位置已存在同名会话：${toDir}`)

  // 2) 会话头里的 cwd
  const file = join(fromDir, 'session.v4.jsonl.zstd')
  const lines = decodeSession(readFileSync(file)).split('\n').filter((l) => l.trim() !== '')
  const header = JSON.parse(lines[0])
  const oldCwd = header.cwd
  header.cwd = targetWs.path
  lines[0] = JSON.stringify(header)
  const recompressed = zstdCompressSync(Buffer.from(lines.join('\n') + '\n', 'utf8'))

  if (dryRun) return { sourceId, sourcePath: sourceWs.path, targetPath: targetWs.path, oldCwd, newCwd: header.cwd, fromDir, toDir, events: lines.length }

  // 执行：先移动目录，再改文件，最后改名单（名单是 UI 的依据，放最后）
  mkdirSync(dirname(toDir), { recursive: true })
  renameSync(fromDir, toDir)
  writeFileSync(join(toDir, 'session.v4.jsonl.zstd'), recompressed)
  sourceWs.sessionIds = sourceWs.sessionIds.filter((id) => id !== sessionId)
  targetWs.sessionIds = [...targetWs.sessionIds, sessionId]
  sourceWs.updatedAt = new Date().toISOString()
  targetWs.updatedAt = sourceWs.updatedAt
  writeFileSync(storePath, JSON.stringify(store, null, 2))

  return { sourceId, sourcePath: sourceWs.path, targetPath: targetWs.path, oldCwd, newCwd: header.cwd, fromDir, toDir, events: lines.length }
}
