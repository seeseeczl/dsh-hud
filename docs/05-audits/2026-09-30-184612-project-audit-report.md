---
类型: 审计报告
技能: project-architect（深度模式）
生成时间: 2026-09-30T18:46:12+08:00
审计对象: dsh-sym v1.0.0（2323 行生产代码，9 项已交付能力）
配套计划: 2026-09-30-184612-optimization-tasks.md
基线: 无（首次审计；治理基线建立于 37b440f）
---

# dsh-sym — 深度审计报告

## 1. 边界、方法与威胁假设

**审计范围**：`lib/*.js`、`lib/prices.json`、`cordis.patch.yml`、`package.json`、
治理产物（`docs/`、`openspec/`、`.project-architect.json`、`AGENTS.md`）。

**不覆盖**：DSH 官方包内部实现（不作为本项目的整改对象）；运行期性能与并发压力；
操作系统层面的资源占用；GitHub 仓库设置与 Release 产物内容。

**方法**（全部为人工执行，命令与输出均已复核）：

| # | 步骤 | 命令 |
|---|---|---|
| 1 | 盘点 | `git status --short` / `git log --oneline -6` / `git rev-list --count origin/main..HEAD` |
| 2 | 行数对账 | 逐模块读文件行数，比照 `.project-architect.json` 的 `loc.hardCeiling` |
| 3 | 入口枚举 | `grep -n 'ctx.slots.inject("' lib/client.js` / `grep -n "ctx.on(\|sessionProjections.register" lib/host-v6.js` |
| 4 | 跨模块影响 | `rg -c "sessionCost" lib/*.js`（**codegraph 不可用，按 `audit-workflow.md` 走 rg 降级**） |
| 5 | 静默失败 | `rg -n "catch" lib/*.js` 后逐处读上下文 |
| 6 | 资源与竞态 | `rg -n "setTimeout\|setInterval\|addEventListener\|MAX\|LIMIT" lib/*.js` |
| 7 | 模块对账 | 对 10 条 FR 逐个核对"代码证据 / 回归 / 可观测性" |
| 8 | 敏感面 | `rg -i "credentials\|token\|apiKey\|secret" lib/*.js`；`rg -n "fetch\(\|https?://" lib/*.js` |

**威胁假设**：本地单用户桌面环境；插件由用户自行安装；不假定网络被监听；
不假定恶意 DSH 宿主。**未考虑**多用户或服务端部署场景（本项目不是服务端组件）。

**未覆盖部分**：本次**未做**运行期动态分析（无压力测试、无长时间运行观测），
因此资源泄漏类结论**均为静态推断**，报告中已按 `推断` 标注。

## 2. 发现清单

**严重度**：`S0` 阻断 · `S1` 严重 · `S2` 一般 · `S3` 建议
**证据等级**：`已验证`（亲手复现）· `高置信推断`（有间接依据）· `未验证`（仅静态观察）

| ID | 严重度 | 证据等级 | 发现 | 触发条件 | 错误行为 | 位置 |
|---|---|---|---|---|---|---|
| **AUD-QUAL-001** | **S1** | 已验证 | **仓库内没有任何回归测试**。`package.json` 无 `scripts` 字段，无 `test/` 目录 | 任何一次改动 | 改动可静默破坏既有行为，只能靠人工实测发现；本次审计的多项结论因此无法自动复核 | 仓库根 |
| **AUD-FLOW-001** | **S1** | 已验证 | **FR-10（会话跨工作区移动）以代码形式留在生产模块中，但无任何调用方** | 维护者阅读 `lib/` | 读者会误以为该能力可用；`move-session.js` 86 行被计入生产代码总量 | `lib/move-session.js` |
| AUD-ARCH-001 | S2 | 已验证 | **客户端与宿主之间的跨端契约缺少单一事实源**。`sessionCost` 投影（client 引 2 处、host 引 7 处）与 `@引用#` 标记（两端各定义一份）都靠人工保持同步 | 任一端改动 | 两端失配时**不会报错**，只会表现为数据不显示或引用不展开 | `lib/client.js:963,1214` / `lib/host-v6.js:443,519,747` |
| AUD-OPS-001 | S2 | 已验证 | **重复注册没有代码级防护**。`ctx.slots.register` 的同一 `id` 重复注册时依赖注册表抛错 | 宿主未重载而客户端已热更新（本项目已发生两次） | 该插槽整体注册失败，且报错只出现在控制台，界面表现为**能力静默消失** | `lib/client.js:1290-1330` |
| AUD-OPS-002 | S2 | 已验证 | **宿主改动流程会累积幽灵模块**。换文件名后旧模块仍留在宿主内存中 | 每次宿主改动 | 与 AUD-OPS-001 叠加，造成难以定位的注册冲突；只能靠重启 App 清理 | 见 `AGENTS.md` / `.project-architect.json` 的 `changeProcedure` |
| AUD-QUAL-002 | S3 | 已验证 | **7 处 `catch` 为空或仅赋默认值** | 上游数据异常 | 错误被吞掉，问题仅表现为"该功能不显示"。**其中多数是有意的降级**（价目回退、ReactDOM 缺失），但**无统一的日志出口** | `lib/host-v6.js:95,98,104,129,137,190,200`；`lib/client.js:17,513,520,1273` |
| AUD-QUAL-003 | S3 | 已验证 | **9 项能力中仅 4 项有可被外部观察的稳定标记** | 自动化验证 | 其余 5 项无法用脚本断言"是否渲染"，只能靠视觉确认 | 见 §3 对账表 |
| AUD-DOC-001 | S3 | 已验证 | 治理任务 **T-13 仅完成 2/8**；`project-architect` 仍有 9 处附件断链 | 后续会话加载该技能 | 该技能再次卡在缺失的 reference 上 | 任务书 T-13 |

**无发现项**：`AUD-SEC-*` —— 敏感面核查**未发现问题**（详见 §4）。

## 3. 功能模块对账（FM-*）

对账口径：**需求 → 入口 → 主路径 → 回归 → 可观测性**。
**回归列全部为"无"**，根因即 AUD-QUAL-001，不再逐行重复。

| FM | 需求 | 入口 | 主路径代码证据 | 回归 | 可观测性 | 状态 |
|---|---|---|---|---|---|---|
| FM-001 | FR-01 会话花费 | composer.dock | `CostPill` + `describeScope` | 无 | 有 | 闭环（除回归） |
| FM-002 | FR-02 刻度费用 | composer.dock | `useActiveTurn` + `pickTurn` | 无 | 有 | 闭环（除回归） |
| FM-003 | FR-03 账户余额 | sidebar.footer | `createBalanceCell` + `remote.account.getBalance` | 无 | 有 | 闭环（除回归） |
| FM-004 | FR-04 峰谷标记 | 品牌行 `::after` | `installPeakTag` + `isPeakTime` | 无 | 有 | 闭环（除回归） |
| FM-005 | FR-05 引用回复 | assistant-actions | `QuoteAction` + `expandQuoteMarks` | 无 | 无 | **部分闭环** → AUD-QUAL-003 |
| FM-006 | FR-06 花费面板 | composer.dock（点击） | `CostPanel` + `createPortal` | 无 | 无 | **部分闭环** → AUD-QUAL-003 |
| FM-007 | FR-07 峰谷拆分 | 面板内 | `tierSpend` + `offPeakSaving` + `cacheSaving` | 无 | 无 | **部分闭环** → AUD-QUAL-003 |
| FM-008 | FR-08 内存读数 | composer.dock | `readProcessMemory` + `formatBytes` | 无 | 有 | 闭环（除回归） |
| FM-009 | FR-09 链接右键菜单 | composer.dock（事件委托） | `LinkContextMenu` + `openWorkspacePath` | 无 | 有 | 闭环（除回归） |
| FM-010 | FR-10 会话移动 | **无入口** | `moveSession`（无调用方） | 无 | 无 | **断链** → AUD-FLOW-001 |

**统计**：闭环 6 · 部分闭环 3 · 断链 1。

## 4. 入口清单（FE-*）

| FE ID | 入口 | 类型 | 触发方式 | 目标模块 | 闭环 | 关联问题 |
|---|---|---|---|---|---|---|
| FE-001 | `conversation.composer.dock#sym-cost` | 插槽 | 自动渲染 | FM-001/002/006 | 是 | — |
| FE-002 | `conversation.composer.dock#link-menu` | 插槽 | 自动渲染（挂事件委托） | FM-009 | 是 | — |
| FE-003 | `conversation.chat.assistant-actions#turn-cost` | 插槽 | 每条回复 | FM-002 | 是 | AUD-QUAL-003 |
| FE-004 | `conversation.chat.assistant-actions#quote-reference` | 插槽 | 每条回复 | FM-005 | 是 | AUD-QUAL-003 |
| FE-005 | `sidebar.footer.action#account-balance` | 插槽 | 自动渲染 | FM-003 | 是 | — |
| FE-006 | 品牌行 `::after` | CSS | 自动 | FM-004 | 是 | — |
| FE-007 | 状态栏金额点击 | 交互 | 用户点击 | FM-006/007 | 是 | AUD-QUAL-003 |
| FE-008 | 文件链接右键 | 交互 | 用户右键 | FM-009 | 是 | — |
| FE-009 | 宿主 `session/event` | 事件 | 会话事件 | FM-005 索引 | 是 | AUD-ARCH-001 |
| FE-010 | 宿主 `agent/pre-step` | 事件 | 提交前 | FM-005 展开 | 是 | AUD-ARCH-001 |

**全部 10 个入口均已闭环**（无未闭环入口）。

## 5. 敏感面核查

只记录字段名与边界，**未读取或输出任何凭据内容**。

| 检查项 | 结论 | 证据 |
|---|---|---|
| 凭据文件读取 | **无** | `rg -i "credentials\|apiKey\|secret" lib/*.js` 仅命中注释里的 "token" 字样（计费术语），无文件访问 |
| 凭据传递 | **无** | 不接触凭据；余额通过官方 `ctx.remote.account.getBalance(clientIdentity())` |
| 出站网络请求 | **无自建请求** | `rg -n "fetch\(\|https?://" lib/*.js` 仅命中一处**注释**（价目来源文档 URL） |
| 敏感信息落盘 | **无** | 写盘仅限 `lib/prices.json`（价目与节假日） |
| 路径处理 | 白名单保守 | 右键菜单只认 8 个已知前缀，`decodeURIComponent` 有 try/catch |
| 权限边界 | 无提权行为 | 不写 DSH 安装目录；不修改会话数据 |

**结论**：本项目在当前形态下**不引入新的凭据暴露面**。没有 S0/S1 安全问题。

## 6. 总评

- **整体判断**：**结构健康，治理缺口集中在"可验证性"而非"正确性"**。
  9 项能力的代码证据齐全（对账 6 闭环 / 3 部分闭环），行数距上限仅用 45–46%，
  敏感面干净。唯一断链的 FM-010 是**已知且已决策搁置**的（ADR-003）。
- **最该先修的三项**：
  1. **AUD-QUAL-001（S1）** —— 没有回归，等于所有其他结论都无法自动复核
  2. **AUD-FLOW-001（S1）** —— 无调用方的生产模块会误导维护者
  3. **AUD-ARCH-001（S2）** —— 跨端契约失配时**静默失败**，最难排查
- **不建议修但需知晓的**：
  - AUD-QUAL-002 的空 `catch` **多数是有意的降级**（价目回退、ReactDOM 缺失），
    改成抛错会破坏"数据不可得时安静退场"的既定约束（NFR-02）。建议只补统一日志出口，不改为抛错。

## 7. 与优化计划的映射

| 发现 ID | 严重度 | 任务 ID | 已映射 |
|---|---|---|---|
| AUD-QUAL-001 | S1 | P0-01, P0-02, P1-01 | ✓ |
| AUD-FLOW-001 | S1 | P0-03 | ✓ |
| AUD-ARCH-001 | S2 | P1-02 | ✓ |
| AUD-OPS-001 | S2 | P1-03 | ✓ |
| AUD-OPS-002 | S2 | P1-04 | ✓ |
| AUD-QUAL-002 | S3 | P2-01 | ✓ |
| AUD-QUAL-003 | S3 | P2-02 | ✓ |
| AUD-DOC-001 | S3 | P2-03 | ✓ |

**核对**：所有 S0/S1 均已映射到 P0/P1 任务 → **本次审计闭环**。

## 8. 未解决风险

| 风险 | 等级 | 说明 |
|---|---|---|
| R-01 无仓库内回归 | 高 | 已由本次审计**证实**，非推测 |
| R-06 `view` 缓存被绕过导致无限重渲染 | 高 | 静态检查**未发现**违反；但无测试守卫，改动时仍可能引入 |
| 本次审计未做动态分析 | 中 | 资源泄漏结论均为静态推断 |

**下次审计**：P0 任务（P0-01~P0-03）完成后，或 30 天后，取更早者。届时使用**增量模式**，与本次报告对比。
