---
类型: 设计记录（ADR-003 的落地归档）
建立时间: 2026-09-30
决策: 不接通（ADR-003 已采纳）
来源: 原 lib/move-session.js —— 2026-09-30 由治理审计 P0-03 移入本文件，随后从生产代码中删除
上游: docs/01-architecture/project-architecture-and-requirements.md
---

# 会话跨工作区移动 — 设计记录（未接通）

## 1. 结论

这条能力**不接线**。DSH 没有提供「界面点一下 → 宿主做一件本没有的事」的通道，
而移动一个会话必须由宿主完成（要读写 `~/.dsh/sessions/` 与 `~/.dsh/storages/workspace.json`）。
依据 ADR-003：客户端 Remote 命名空间由 `dsh-api-remotes` 在**构建期**选定，插件加不了新的；
`dynamicCordisRunner` 的语义是「定义并运行一个插件」，不是「执行一次动作」，且其沙箱禁用 fs。

本文件保留实现要点与原始代码，供日后 DSH 开放通道时直接复用。
**它不是已交付能力**，README 与任何对外说明都不得这样写。

## 2. 为什么必须是宿主侧

三处状态分布在不同位置，且第三处是 UI 的依据：

| # | 位置 | 改什么 | 为什么容易漏 |
|---|---|---|---|
| 1 | `~/.dsh/sessions/<encode(工作区路径)>/<sessionId>/` | 整个会话目录要落到新工作区的目录名下 | 目录名是路径编码出来的，不是 id |
| 2 | 该目录下 `session.v4.jsonl.zstd` 的第一行 | `cwd` 字段要改成目标工作区路径 | DSH 内部 `attachSession` 要求 `cwd === workspace.path`，否则会话挂不上 |
| 3 | `~/.dsh/storages/workspace.json` 的 `tables.workspaces[*].sessionIds` | 从旧名单移除、加入新名单 | 名单是侧边栏的依据；三个地方不一致就会出现「看得见、打不开」 |

**执行顺序**（原实现即如此）：先移动目录 → 再改文件头 → 最后改名单。
名单放最后是因为它是 UI 的依据，前面任一步失败时宁可让它保持旧状态。

## 3. 两个实现细节（当时踩过的坑）

- **路径 → 目录名的编码**：`/a/b` 编码成 `--a-b--`（去掉首个斜杠、把斜杠换成连字符、两侧补 `--`）。
- **会话文件是 zstd 多 frame 的 JSONL**：一个 6 MB 的会话文件里含数千个独立 zstd frame。
  直接对整个 buffer 调 `zstdDecompressSync` **只会解出第一帧**（表现为「整个会话只有一行」）；
  必须按 magic `28 b5 2f fd` 切分后逐帧解压，再拼接。

## 4. 复活条件

满足任一条即可把下面的实现接回来：

- DSH 开放插件可用的客户端 → 宿主 Remote 通道；或
- DSH 官方自己提供「移动会话到工作区」的入口。

接回时注意：本文件里的代码**未经这次删除后的任何改动**，仍是当时用真实数据副本验证过的版本。

## 5. 原始实现（2026-09-30 移出生产代码，内容未改动）

```js
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
```
