---
类型: 设计（已定稿）
建立时间: 2026-09-30
状态: 待实施 —— V1/V2/V3 已验证，位置与配置形态已定
归属: dsh-sym
位置: A —— 输入框上方整宽条（`conversation.input.dock`）
配置: 插件 config + DSH 官方设置表单（§7 方案 A）
---

# 快捷按钮条（Quick Actions Bar）— 设计

## 1. 目标

在输入框上方加一条常驻的横向按钮条，放用户自己定义的常用动作。第一批支持两类：

1. **插入预设 prompt**：把一段文字放进输入框草稿，可选直接发送
2. **执行命令**：执行 `/compact` 这类 slash 命令——**直接对 agent 执行，不会变成模型消息**

## 2. 位置（含一次返工）

**最终形态：侧栏右缝里的竖排图标条（候选 D）。**

实现上它是两件事的组合：

- **注册**仍在会话作用域的 `conversation.input.dock` —— 只有会话作用域才拿得到
  `inputActions`、`sessionId`、`useProjection`（`shell.overlay` 是 root 作用域，没有这些）。
- **元素**是 `position: fixed`，横向定位到侧栏列的右边缘 +5px（避开官方那 8px 拖拽手柄的
  右半），纵向居中。它**完全脱离文档流**，所以既不占 dock 的位置，也不会挤走任何人。

| 项 | 实测值 |
|---|---|
| 注册槽位 | `conversation.input.dock`（list，session scope） |
| 该槽 standard props | 含 `inputActions`、`useInput`、`useProjection`、`useChat`、`sessionId` |
| 同槽其他占用者 | `todo`(0) · `goal`(10) · `queue`(20)（我们的元素是 fixed，不参与堆叠） |
| 定位依据 | `document.querySelector('[class*="_sidebarCol"]').getBoundingClientRect().right` |
| 跟随 | `ResizeObserver`（侧栏折叠/拖动改宽）+ `window resize` |

### 为什么撤掉候选 A（2026-09-30 实机反馈）

A（`conversation.input.dock` 的横排文字条）先做出来并被否决，原因是**位置冲突**：

- 这块是**公共堆叠区**，我们的条占了待办卡的位置；
- 待办卡出现后又被顶上去，**把上面的用时读数盖住了**。

D 的代价是要量 DOM 定位（`_sidebarCol` 的 class 是哈希前缀，官方没承诺稳定），
换来的是不占任何布局位置。找不到侧栏列时**安静退场**并记一条降级日志，不猜位置。

| 候选 | 槽位 | 结论 |
|---|---|---|
| **D 侧栏右边那条缝** | 会话槽注册 + `position: fixed` | **采用** |
| A 输入框上方整宽条 | `conversation.input.dock`（list） | 做过，占位与堆叠不可接受，已撤 |
| F 会话头部右侧工具区 | `conversation.session.header.utilities`（list） | 已有 3 个官方项占着（`open-in-app`、`schedule-catalog`、`session-log-download`），空间窄 |
| B / C 输入框工具行左右端 | `conversation.input.left` / `.right`（list，空位） | 位置顺手但很窄，只够纯图标 |
| G 「对话/轨迹」行右侧 | **无槽位** | 官方那行只渲染 tab 按钮，右侧是纯空白；想占只能浮层绝对定位 |

**关于 G 的结论一并记下**（避免以后重复调研）：会话头部是两行网格，`tabs` 那行 `grid-column: 1/-1` 只 map 出 tab 按钮，**没有声明任何 slot**；同带的官方口子是 `titleRow` 里的 `utilities`（右对齐、list）与 `corner`（`single`，已被占用，只能替换不能新增）。

## 3. 数据流（已验证）

```
插件 config（profile patch 里的 entry config）
        │  宿主插件读自己的 Config
        ▼
   会话投影（注册一个新 key，如 quickActions）
        │  useProjection("quickActions")
        ▼
      客户端条
```

依据：

- 宿主 `ctx.sessionProjections.register({ key, stateSchema, init, apply, wire, stateVersion })` 可注册**任意 key**；重载插件会让 key 消失再出现，cell 随之重建
- 客户端读到的投影值类型是 `Partial<SessionProjectionMap> & Readonly<Record<string, SessionProjectionValue>>`——**字符串 key 即可取**，不要求编译期声明
- 现有插件的 `sessionCost` 就是这条路的实证

**注意**：投影是 per-session 的，所以配置会随每个会话各下发一份（体积很小，可接受）。**未验证但不影响方案**：客户端半边能否直接拿到 entry config（文档未写明），因此统一走投影。

**实测踩到的两个坑（2026-09-30，都已修）**：

1. **只换文件名不生效**：宿主入口 v7→v8 之后 `fiberPhase` 显示 active、`moduleName` 也是新文件，但跑的还是旧模块，新 key 根本不存在。必须**停用 → 启用**（会话内用插件管理器即可，不必重启 App）。判据：`~/.dsh/storages/session_projcache/sessions/<id>.json` 的 `rows` 里有没有新 key。
2. **`apply` 恒等 → 客户端永远读不到**：state 引用从不变化时，宿主不计算也不缓存客户端视图，基线里没有这个 key。修法是让 `apply` 在首个事件翻转一个占位字段（守卫见 `test/host.test.mjs`）。界面上这个 bug 的表现是「什么都没发生、也没有任何报错」，最难查。

因为坑 2 的风险，客户端**内置了一份默认按钮**（`DEFAULT_QUICK_ACTIONS`）：投影有值就用投影的，没有就用自己的。两份清单由 `test/contracts.test.mjs` 守卫一致。

## 4. 配置格式（草案）

存放在插件 entry 的 config 里（`cordis.patch.yml` 的 `sym-cost` 行），由插件自带的 schema 约束：

```yaml
- id: sym-cost
  name: 'file:///…/lib/host-v9.js'
  config:
    buttons:
      - { id: compact, label: 压缩上下文, icon: compress, kind: command, value: "/compact" }
      - { id: review,  label: 审查改动,   icon: search,   kind: prompt,  value: "请审查这次改动……", submit: false }
    overflow: menu
```

- `kind: "prompt"` → `inputActions.insertText(value)`；`submit: true` 时改为提交
- `kind: "command"` → `remote.commands.execute(...)`（见 §5）
- `icon` 取自官方 primitives；未识别时退化为文字按钮

## 5. 动作执行（已验证，两条都有正路）

| 动作 | 接口 | 证据 |
|---|---|---|
| 插入草稿 | `inputActions.insertText(text, span)` | 现有插件的引用按钮已在用 |
| 直接发送 | `remote.session.prompt({ requestId, sessionId, mode: 'queue'\|'steer', content, clientTimeZone })` | host `sessionController` 的 `@Remote('prompt')` |
| **执行命令** | `remote.commands.execute(agent, line, submittedAttachments, signal)` | host `commands` 服务：`@Remote async execute(...)`，文档原文 "Parse and execute a known command **without sending it to the model**" |

返回值处理：

- `execute` 返回 `CommandExecution | undefined`；**`undefined` = 语法或命令名不认识** → 界面给出明确提示，不要静默
- `CommandExecution.result.kind` 为 `'success' | 'error'`，`text` 可直接展示
- 命令的执行会写进会话日志（`command/run` / `command/done`），并在模型历史之外渲染——这是官方行为，不需要我们处理

## 6. 界面

- **竖排图标条**，贴侧栏右缝；按钮是**纯图形**（无文字），每个 28×28，图标 16×16
- **纵向居中，从中间往两边排**（`top: 50%` + `translateY(-50%)` + `flex-direction: column`），
  和聊天区右侧的对话轮次刻度是同一种对齐观感：不论几个按钮，都以中心为基准上下展开
- 图标按按钮 `id` 取（`compact` 压缩、`review` 放大镜、`regression` 循环箭头、
  `explain` 问号圆圈、`commit-message` 文稿），认不出的 id 退化成中性圆点
- tooltip 与 `aria-label` 用 `label` 字段（文字不上屏，但键盘与读屏仍可达）
- 点击反馈用颜色而不是文字：成功转绿、失败/未识别转红、`remote.commands` 不可用时转灰
  （`data-state` 驱动，2 秒后恢复）
- **配置为空时不渲染任何节点**（本项目的硬规矩：插件缺席时官方布局一个像素都不变）。
  量不到侧栏列时同样不渲染，并记一条 `[dsh-sym] quick:sidebar 降级` 日志

## 7. 配置界面 —— 悲观结论撤回（已验证）

原以为「客户端写不了宿主配置，只能手改文件」。查完 host `settings` 服务后，**官方有正路**：

| 方法 | 用途 |
|---|---|
| `describe(options)` | 读出活跃插件 schemas 与实时值（`SettingsDescriptor`，含 `ns`、`schema`、`value`、`revision`、`autoGenerate`） |
| `update(ns, patch, expectedRevision)` | 把可编辑字段合并进某个 entry 的 config |
| `replace(ns, section, expectedRevision)` | 重置后整体设置 |
| `mutate(ns, ops, expectedRevision)` | 按路径编辑；**`unset` 一个数组下标即删除该元素**（正好用于增删按钮） |
| `prepareDocument()` | 定位 profile patch，供本地编辑 |

配合两处已有机制：

- 插件声明 Config schema → 设置界面**自动生成表单**（`autoGenerate`）
- `plugins.row.config` 槽的官方说明：bundle 里声明的**每一行**若带 config，就在插件页上长出「配置」入口

**采用 A：插件 config + 官方设置表单。** 按钮定义写进插件 entry 的 config，设置里由 DSH 自动生成表单（可增删改、写回 profile patch、重载生效）；我们**不写**编辑器，也不让用户手改文件。

备选 B（未采用，记录备查）：像 `prices.json` 那样放独立 JSON、宿主按 mtime 热加载；好处是改文件即生效、与现有插件一致；代价是界面只能只读展示，且用户要自己写 JSON。

## 8. 模块与工作量

| 模块 | 内容 | 估行 |
|---|---|---|
| 宿主 | Config schema + 投影注册 + 按钮定义校验 | ~130 |
| 客户端条 | dock 注册 + 横条 + 按钮 + 溢出 | ~180 |
| 动作层 | 插入 / 提交 / 命令执行 / 错误提示 | ~120 |

合计约 430 行，拆 1–2 张任务卡。选 A 不需要写配置编辑器；选 B 另需一个只读设置页（~80 行）。

## 9. 明确不做

- **不改 DSH 本体**：Info.plist 里有 app.asar 的 SHA256 完整性校验 + 官方签名公证
- **不新增 remote 通道**（做不到；本方案全部走现成接口）
- **不执行 shell 命令**：需要沙箱与批准链路，风险远高于收益

## 10. 验证结果（2026-09-30）

| ID | 问题 | 结论 |
|---|---|---|
| V1 | 客户端能否读任意投影 key | ✅ 能（值类型含 `Record<string, SessionProjectionValue>`；现有插件已实证） |
| V1b | 客户端能否直接拿 entry config | ➖ 未验证，不影响方案（统一走投影） |
| V2a | 能否插入 / 直接发送 | ✅ 插入走 `inputActions.insertText`；发送走 `remote.session.prompt` |
| V2b | 命令有没有执行入口 | ✅ 有：`remote.commands.execute`，且明确不产生模型消息 |
| V3 | 客户端能否写宿主配置 | ✅ 走官方 `settings` 服务（`update`/`replace`/`mutate`），无需自建通道 |
| V4 | 输入框上方多条堆叠在窄窗口的行为 | ⏳ 待真机观察（开工后第一次验证） |

## 11. 验收（草案）

- 真实会话里能看到这条 bar；**没有配置时看不到**（布局零变化）
- 点「插入预设 prompt」→ 文字进入草稿、光标位置合理；`submit: true` 时直接发出
- 点「执行命令」→ 命令真的执行（不产生模型消息）；命令名写错时给出可见提示
- 改配置（按 §7 选定形态）→ 生效，且不需要重启 App
- 与 `todo` / `goal` / `queue` 共存，顺序符合 `order`
