# dsh-sym 项目约定

> 本文件是**项目级**指令，叠加在用户级 `~/.dsh/AGENTS.md` 之后，**项目内的要求优先**。
> 上游依据：`docs/01-architecture/project-architecture-and-requirements.md`（需求与架构基线）
> 与 `docs/04-delivery/project-plan-task-charter.md`（任务书）。
> 阈值与公开契约只在 `.project-architect.json` 维护，**不要在本文件另立一套**。

## 这是什么项目

`dsh-sym`（symbiote，共生体）是给 DeepSeek Harness 接的界面读数层：把 DSH 界面**已经存在
但未呈现**的数字变成可用读数，对**反复手动做的事**给一键。名字刻意不限定功能范围。

**不要**用"插件叫 sym 所以只能做计费"这类理由限制范围；也**不要**因为加了新能力就改名。

## 动手前必须知道的边界（已证实，勿重复投入）

以下结论都经过实测，**不要重新验证**；要推翻必须先给出新证据：

1. **不能新增客户端 → 宿主的 Remote 通道。** 客户端能调的命名空间由 `dsh-api-remotes`
   在**构建期**选定，插件加不了新的。`ctx.typert.register()` 在宿主侧能注册成功，但客户端
   那一半挂载不了，且客户端自挂载要求**生成的严格 codec**。
   → 任何"界面点一下 → 宿主做一件本没有的事"的想法，**先确认有没有现成 Remote**。
   → 会话移动（`lib/move-session.js`）就死在这里；右键菜单能活是因为
   `session.openWorkspacePath` 本来就存在。

2. **`dynamicCordisRunner` 不是通道。** 它的沙箱刻意禁用 fs / 网络 / 进程 / 定时器
   （引导到 `ctx.fs` 等 Cordis 服务），而且语义是"定义并运行一个插件"，不是"执行一次动作"。

3. **宿主代码不热重载。** 改 `lib/host-v*.js` 后必须走：
   **停用插件 → 换新文件名 → 同步引用 → 启用**。直接改内容或只改文件名都不会生效（模块缓存）。
   换名与同步引用已经脚本化：`node scripts/reload-host.mjs --dry-run` 先看要改哪些行，
   加 `--apply` 才真正改名；脚本**不**碰停用/启用（那两步由人做）。
   每次这样做都会在宿主内存里留下旧模块注册，**重启 App 可清**。

4. **`single` 型插槽是替换，`list` 型才是加法。** 接管 `single` 会丢掉官方行为
   （例如账户菜单里的"退出登录"）。能加法就不要替换；确实要改视觉时优先 CSS
   （品牌行的峰谷标记就是 `::after`，没有接管任何组件）。

5. **视觉常量必须先查官方源码。** 面板配色曾因猜测 `--dsw-alias-bg-elevated` 而与官方不一致，
   正确值是 `--dsw-specific-menu`。官方弹层的标准配方：
   `--dsw-specific-menu` + `--dsw-elevation-prominent` + `--dsw-radius-lg` + `--dsw-menu-backdrop-filter`。

## 接口契约（**改动前先读这里**）

**这一节是审计 `AUD-TEST-001`（S1）的整改产物。** 在那次审计中，同一个 AI 在同一会话内
对下面这些接口**连续误判 6 次**——因为契约此前只存在于实现里。**签名与返回契约以实现为准，
本节是它的可读副本；发现不一致时先改本节。**

### `lib/host-v9.js`

```js
isPeakTime(ms, holidays = new Set(DEFAULT_HOLIDAYS)) -> boolean
    // 峰段：北京时间周一至周五 09:00–12:00、14:00–18:00（含起点、不含终点）
    // 周末与 holidays 中的日期全天为 false。holidays 是 'YYYY-MM-DD' 字符串集合。

expandQuoteMarks(messages) -> 新批次 | null
    // ⚠ 无标记、或入参不是数组时返回 null（调用方保留原 decision 对象）。
    // ⚠ message.content 必须是【块数组】：[{ type:'text', text:'…' }]。
    //    传字符串会被整条跳过，表现为"没改动"。
    // ⚠ 只有**成功替换过**才返回新批次；标记的 id 解析不到时返回 null
    //    （AUD-LOGIC-001 的整改，2026-09-30 落地）。

proseOfMessage(message) -> string | null
    // ⚠ 入参是【message 对象】，不是 id。
    // 从 content 中按顺序取 type==='text' 的块，用 '\n\n' 连接；
    // 忽略 reasoning 与 tool-call 块。无文本块或入参为 null 时返回 null。

rememberProse(id, prose) -> void
    // 按 id 存入引用索引（重复 id 会先删后插，保持"最新"）。
    // 上限 QUOTE_INDEX_LIMIT = 400，超出淘汰最旧的。

readProcessMemory() -> { rss, heapUsed } | null
    // 无 process 时返回 null。

PROJECTION_KEY / QUOTE_MARK_PREFIX / QUOTE_MARK_ID_LENGTH
    // 跨端契约常量，两端各有一份拷贝（不能共享模块），由
    // test/contracts.test.mjs 断言两边相等。见下面「公开契约」。
```

### `lib/client.js`

```js
formatCny(value) -> string          // 金额文本（货币符号由语言包的 amount 负责）
pickTurn(turns, activeTurn) -> turn | null
describeScope(scope, t, title) -> string   // 悬停账单的多行文本
readActiveTurn() -> number | null          // 读右侧刻度当前选中项
quoteMark(messageId) -> string             // 客户端写出的引用标记（端到端由契约测试守卫）
registerSlotCell(ctx, name, id, order, component) -> disposer | null
    // ⚠ 同一实例内重复 id 会被**跳过并返回 null**（AUD-OPS-001 的整改）。
    // ⚠ 注册表拒绝时吞掉异常、记录一条降级日志，返回 null——不连累其他插槽。
```

### 降级日志（`noteDegrade`）

两端各有一个 `noteDegrade(where, detail)`：把"安静退场"的原因写到控制台，
**每个来源只记一次**（上限 40 条），所以不会随渲染刷屏。
看到 `[dsh-sym] <where> 降级：…` 就是某个可选能力主动缺席了，不是崩溃。
宿主侧唯一不记的情况是 `prices.json` 不存在（ENOENT）——那是正常态。

### 两个容易搞错的语义

1. **`null` 不是 `undefined`**：本项目一律用 `null` 表示"没有/无变化/不可用"。
   写断言时用 `assert.equal(x, null)`，不要写 `undefined`。
2. **"无变化返回 null" 是有意设计**，不是偷懒：让调用方保留原对象、避免无谓拷贝。
   见到 `null` 时**不要**当成错误。

## 汇报产物的格式（用户明确要求过）

列出任何产物时，每份都要**同时**具备两样东西，缺一不可：

1. **中文说明**：这一份是什么。审计产物固定叫「**审计报告**」与「**优化计划书**」
   （`project-architect` 那一侧的第二份叫「**优化任务书**」）。
2. **可点击链接**：`[审计报告：<主题>](/绝对/路径)`。

**不要**把产物路径放进代码块或写成裸路径——那样既点不开，也分不清哪份是哪份。
用户为此专门提过要求，**请严格执行**。

审计产物成对出现，读法固定：

| 想看什么 | 打开哪份 |
|---|---|
| 哪里有问题、证据是什么 | **审计报告** |
| 打算怎么修、谁负责 | **优化计划书 / 优化任务书** |

## 公开契约（改动前必须先立 CR）

| 契约 | 位置 | 规则 |
|---|---|---|
| 投影 `sessionCost`（stateVersion 3） | 宿主 ↔ 客户端**唯一**数据契约 | 只存 token 数与计数，**不存金额、单价、汇率** |
| 引用标记 `@引用#<12位id>` | 客户端写入、宿主展开 | **两端必须同步改** |
| `lib/prices.json` 字段 | 对用户可见 | `usdToCny` / `holidays` / `models`，破坏性变更需 CR |
| `data-sym-*` DOM 属性 | 供验证脚本定位 | **非稳定 API**，可改但需同步测试 |

### 跨端契约的单一事实源（AUD-ARCH-001 的整改，2026-09-30）

两端**不能共享模块**（客户端是浏览器 module factory，宿主是 Node 模块），所以
`PROJECTION_KEY`、`QUOTE_MARK_PREFIX`、`QUOTE_MARK_ID_LENGTH` 在两端各有一份拷贝：

| 常量 | 宿主 | 客户端 |
|---|---|---|
| `PROJECTION_KEY` | `lib/host-v9.js` 顶部 | `lib/client.js` 的 contract 区 |
| `QUOTE_MARK_PREFIX` / `QUOTE_MARK_ID_LENGTH` | 同上 | 同上 |

**守卫在 `test/contracts.test.mjs`**：它断言两边相等，并用"客户端生成标记 → 宿主展开"
证明两端真的对得上。**改任何一端都要跑 `npm test`**——失配不会报错，只会表现为
数据不显示或引用不展开。

## 代码约束

- **零依赖、无构建步骤。** 不要引入 dependencies、打包器或转译。平台模块（`react`、
  `react-dom`）用 `require` 取，且**必须包在 try/catch**——取不到时降级而不是崩溃。
- **单卡至多 5 个生产文件、净新增至多 300 行**；任一模块超过 `.project-architect.json`
  的 `loc.hardCeiling` 时**先拆分再继续**。
- **数据不可得时安静退场**：返回 `null`，**不要**显示 `0` 或占位符。
- **`view()` 里不要返回每次都是新引用的对象**——会击穿 `viewCache`，导致客户端无限重渲染。
  内存读数就因此只能随会话活动更新，这是刻意的。
- 加法接入优先；插件缺席或数据缺失时，**官方布局一个像素都不该变**。

## 验证要求

- **不落盘、未验证的产物不得宣称完成。** 说"做好了"必须附实测证据。
- 改动客户端 → 需要可复现验证；改动宿主 → **必须在真实运行环境验证**（只跑单测不算）。
- 报告要区分**已验证 / 推断 / 未验证**；没验证的明说没验证。
- **仓库内回归已建立**（2026-09-30，任务卡 T-03/T-04/T-05 与 ADV-P1-01/02）：
  入口是 `npm test`（即 `node --test`），三个文件
  `test/host.test.mjs`、`test/client.test.mjs`、`test/contracts.test.mjs`，
  共 31 个断言，零依赖。**注意 `node --test test/` 在 Node 24 下会被当成模块路径而失败，
  用不带参数的 `node --test`。**
- 但**回归只覆盖纯函数**：渲染、插槽注册、热更新仍要人工实测，改动宿主仍必须重启验证。

## 治理产物

- 需求与架构基线：`docs/01-architecture/project-architecture-and-requirements.md`
- 任务书（12 张原子任务卡）：`docs/04-delivery/project-plan-task-charter.md`
- 事实源（LOC 阈值 / 模块路径 / 公开契约 / 忽略项）：`.project-architect.json`
- 审计产物（未来）：`docs/05-audits/YYYY-MM-DD-HHMMSS-*.md`，同一时间戳，**永不覆盖历史**

**审计默认只读**：除非明确授权修复，不修改业务代码、配置、依赖或远程状态，不把发现顺手重构。

## 环境事实（省得重新查）

- `DSH_HOME=/Users/long/.dsh`；本项目位于 `~/.dsh/profiles/desktop/plugins/dsh-sym`
- DSH 的 skill 扫描根：`<项目根>/.dsh/skills`(100) → `<项目根>/.agents/skills`(200) →
  `custom`(300) → `$DSH_HOME/skills`(400) → `~/.agents/skills`(500)
- **技能目录是会话开始时的快照**，新建/复制进去的技能**当前会话看不到**，需开新会话
- `project-architect` 等四个技能的附件（`references/` `scripts/` `assets/`）**不存在**，
  只有 `SKILL.md`；照方法论人工执行，**不要假装跑了校验脚本**

### 宿主改动到底有没有生效（2026-09-30 踩过两次）

- **不要看 `fiberPhase: active`** —— 跑着旧模块的实例也是 active，`moduleName` 显示新文件名
  也可能是错觉。**唯一可靠判据**是
  `~/.dsh/storages/session_projcache/sessions/<sessionId>.json` 的 `rows` 里
  **有没有你新加的投影 key**（或老 key 的 `val` 有没有按你的新代码变化）。
- 流程必须是三步：**换文件名 → 停用插件 → 启用插件**。只换文件名不够（模块缓存），
  而且 HMR 只会重新组合配置、不会重载插件代码。停用/启用可以在会话里用插件管理器直接做
  （`set_plugin`，entryId 是 `include:sym-cost`），**不必重启 App**：

  ```
  node scripts/reload-host.mjs --apply     # 换名 + 同步引用（已经脚本化）
  # 然后 plugin_manager: set_plugin false → true
  ```

### 投影单元的一个坑（同一天踩到）

**`apply` 必须至少让 state 变一次**（哪怕只是翻转一个占位字段）。state 引用始终不变时，
宿主不会计算客户端视图、也不会缓存它，于是该 key 既不在 baseline 也不在增量里 ——
界面表现是**什么都不发生且没有任何报错**。`sessionCost` 之所以没暴露这个问题，是因为它
每轮都在变。守卫见 `test/host.test.mjs` 的「state 在首个事件后只变一次」。
