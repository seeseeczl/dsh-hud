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
   **停用插件 → 复制为新文件名 → 同步 `cordis.patch.yml` 与 `package.json` 的
   `main`/`exports`/`files` → 启用**。直接改内容或只改文件名都不会生效（模块缓存）。
   每次这样做都会在宿主内存里留下旧模块注册，**重启 App 可清**。

4. **`single` 型插槽是替换，`list` 型才是加法。** 接管 `single` 会丢掉官方行为
   （例如账户菜单里的"退出登录"）。能加法就不要替换；确实要改视觉时优先 CSS
   （品牌行的峰谷标记就是 `::after`，没有接管任何组件）。

5. **视觉常量必须先查官方源码。** 面板配色曾因猜测 `--dsw-alias-bg-elevated` 而与官方不一致，
   正确值是 `--dsw-specific-menu`。官方弹层的标准配方：
   `--dsw-specific-menu` + `--dsw-elevation-prominent` + `--dsw-radius-lg` + `--dsw-menu-backdrop-filter`。

## 公开契约（改动前必须先立 CR）

| 契约 | 位置 | 规则 |
|---|---|---|
| 投影 `sessionCost`（stateVersion 3） | 宿主 ↔ 客户端**唯一**数据契约 | 只存 token 数与计数，**不存金额、单价、汇率** |
| 引用标记 `@引用#<12位id>` | 客户端写入、宿主展开 | **两端必须同步改** |
| `lib/prices.json` 字段 | 对用户可见 | `usdToCny` / `holidays` / `models`，破坏性变更需 CR |
| `data-sym-*` DOM 属性 | 供验证脚本定位 | **非稳定 API**，可改但需同步测试 |

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
- ⚠️ **当前没有仓库内回归**（断言的旧脚本在 `/tmp`，未纳入仓库）——这是已知最大缺口，
  见任务卡 T-03~T-05。在补齐之前，任何改动都要靠手工实测，**并在回复中说明这一点**。

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
