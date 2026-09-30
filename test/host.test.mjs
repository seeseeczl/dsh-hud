import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPeakTime, expandQuoteMarks, rememberProse, proseOfMessage, readProcessMemory,
  DEEPSEEK_CNY, DEFAULT_USD_TO_CNY,
  QUICK_ACTIONS_KEY, DEFAULT_QUICK_ACTIONS, normalizeQuickActions, quickActionsProjection,
} from '../lib/host-v8.js'

/** Beijing wall-clock on 2026-09-30 (a Wednesday) as epoch ms. */
const bj = (y, m, d, hh, mm = 0) => Date.UTC(y, m - 1, d, hh - 8, mm)

test('isPeakTime: 峰时窗口的边界（含端点内、端点外）', () => {
  const before = new Set()
  assert.equal(isPeakTime(bj(2026, 9, 30, 8, 59), before), false, '08:59 应为谷时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 9, 0), before), true, '09:00 应为峰时（含起点）')
  assert.equal(isPeakTime(bj(2026, 9, 30, 11, 59), before), true, '11:59 仍为峰时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 12, 0), before), false, '12:00 应为谷时（峰段结束）')
  assert.equal(isPeakTime(bj(2026, 9, 30, 13, 59), before), false, '13:59 仍为谷时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 14, 0), before), true, '14:00 应为峰时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 17, 59), before), true, '17:59 仍为峰时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 18, 0), before), false, '18:00 应为谷时')
})

test('isPeakTime: 周末全天谷时', () => {
  const before = new Set()
  assert.equal(isPeakTime(bj(2026, 10, 3, 10, 0), before), false, '周六上午应为谷时')
  assert.equal(isPeakTime(bj(2026, 10, 4, 15, 0), before), false, '周日下午应为谷时')
})

test('isPeakTime: 节假日表内的日期全天谷时', () => {
  const holidays = new Set(['2026-10-01'])
  assert.equal(isPeakTime(bj(2026, 10, 1, 10, 0), holidays), false, '国庆当天应为谷时')
  assert.equal(isPeakTime(bj(2026, 10, 2, 10, 0), holidays), true, '不在表内则按工作日算')
})

test('proseOfMessage：提取可见正文，忽略推理与工具块', () => {
  const message = { content: [
    { type: 'text', text: '第一段' },
    { type: 'reasoning', text: '不应出现' },
    { type: 'tool-call', name: 'x' },
    { type: 'text', text: '第二段' },
  ] }
  assert.equal(proseOfMessage(message), '第一段\n\n第二段')
  assert.equal(proseOfMessage({ content: [{ type: 'reasoning', text: 'only reasoning' }] }), null)
  assert.equal(proseOfMessage({}), null, '没有 content 数组时应为 null')
  assert.equal(proseOfMessage(null), null, 'null 入参不应抛错')
})

test('引用：标记能展开成被引用的正文', () => {
  const id = 'abcdef1234567890'
  // The client writes the hyphen-free first twelve hex characters.
  rememberProse(id, '这是被引用的那一段正文。')
  const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `请参考 @引用#${id.slice(0, 12)} 的做法` }] }])
  assert.equal(out.length, 1)
  assert.match(out[0].content[0].text, /这是被引用的那一段正文。/)
  assert.doesNotMatch(out[0].content[0].text, /@引用#/, '标记本身应被替换掉')
})

test('引用：未知 id 保留标记，且不再产生新批次（AUD-LOGIC-001）', () => {
  // A mark that cannot be resolved is written back verbatim, so nothing was
  // actually substituted and the batch must not be copied. The caller keeps its
  // original decision object.
  const input = [{ role: 'user', content: [{ type: 'text', text: '参考 @引用#ffffffffffff 的做法' }] }]
  assert.equal(expandQuoteMarks(input), null, '无成功替换 ⇒ 返回 null')
})

test('引用：同一批里未知 id 与已知 id 混合时，整批仍会展开', () => {
  const id = 'a1b2c3d4e5f60000'
  rememberProse(id, '已知的正文')
  const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#ffffffffffff 与 @引用#${id.slice(0, 12)}` }] }])
  assert.ok(out !== null, '有一个成功替换即算改动')
  assert.match(out[0].content[0].text, /@引用#ffffffffffff/, '未知 id 保持原样')
  assert.match(out[0].content[0].text, /已知的正文/, '已知 id 正常展开')
})

test('引用：无标记的消息返回 null，非数组入参也返回 null', () => {
  assert.equal(expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: '一条普通消息' }] }]), null)
  assert.equal(expandQuoteMarks(null), null)
  assert.equal(expandQuoteMarks('not an array'), null)
})

test('记忆索引有界：超过 400 条后最旧的无法再被引用', () => {
  // The lookup itself (`proseForPrefix`) is internal and matches by prefix, so ids
  // must differ inside their first twelve hex characters the way real message ids
  // do — a zero-padded counter would make every prefix identical.
  const mkId = (n) => (n.toString(16).padStart(12, '0') + 'ffff').slice(0, 16)
  for (let i = 0; i < 450; i += 1) rememberProse(mkId(i), 'prose-' + i)

  const oldest = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#${mkId(0).slice(0, 12)}` }] }])
  assert.equal(oldest, null, '最旧的应已被淘汰：标记解析不到 ⇒ 无替换 ⇒ null')

  const newest = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#${mkId(449).slice(0, 12)}` }] }])
  assert.match(newest[0].content[0].text, /prose-449/, '最新的应仍可展开')
  assert.doesNotMatch(newest[0].content[0].text, /@引用#/)
})

test('引用：展开结果以引用块呈现，且多段正文按行加 > 前缀', () => {
  const id = 'feedfacecafe0000'
  rememberProse(id, '第一行\n\n第二行')
  const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#${id.slice(0, 12)}` }] }])
  const text = out[0].content[0].text
  assert.match(text, /【引用此前的回复】/)
  assert.match(text, /^> 第一行$/m)
  assert.match(text, /^>$/m, '空行应写成单独的 >')
  assert.match(text, /^> 第二行$/m)
})

test('价目常量：DeepSeek 现行价与汇率', () => {
  assert.equal(DEEPSEEK_CNY['deepseek-flash'].cacheHit, 0.04)
  assert.equal(DEEPSEEK_CNY['deepseek-flash'].cacheMiss, 2)
  assert.equal(DEEPSEEK_CNY['deepseek-flash'].output, 8)
  assert.equal(DEFAULT_USD_TO_CNY, 7)
})

test('readProcessMemory：返回字节数，且 rss 大于 0', () => {
  const mem = readProcessMemory()
  assert.ok(mem !== null, '在 Node 里应可用')
  assert.ok(mem.rss > 0 && mem.heapUsed > 0)
})

// ---------------------------------------------------------------------------
// 失败路径与非法入参（AUD-TEST-002 的整改）。代码里 return null 出现 20 次，
// 全是失败分支；下面把主要入口的失败行为固定下来。
// ---------------------------------------------------------------------------

test('失败路径：expandQuoteMarks 对非法入参一律返回 null', () => {
  assert.equal(expandQuoteMarks(null), null)
  assert.equal(expandQuoteMarks(undefined), null)
  assert.equal(expandQuoteMarks('not an array'), null)
  assert.equal(expandQuoteMarks(42), null)
  assert.equal(expandQuoteMarks({}), null)
})

test('失败路径：内容块缺失或类型异常时整条消息原样保留', () => {
  const messages = [
    { role: 'user' },                                    // 没有 content
    { role: 'user', content: 'plain string' },            // content 不是数组
    { role: 'user', content: null },
  ]
  // 无标记 ⇒ 无变化 ⇒ null（调用方保留原对象）
  assert.equal(expandQuoteMarks(messages), null)
})

test('失败路径：proseOfMessage 对各类非法入参返回 null 而不抛错', () => {
  assert.equal(proseOfMessage(null), null)
  assert.equal(proseOfMessage(undefined), null)
  assert.equal(proseOfMessage({}), null)
  assert.equal(proseOfMessage({ content: null }), null)
  assert.equal(proseOfMessage({ content: 'string' }), null)
  assert.equal(proseOfMessage({ content: [] }), null)
  assert.equal(proseOfMessage({ content: [{ type: 'text', text: '' }] }), null, '空文本不计入')
})

test('失败路径：isPeakTime 对极端时间戳不抛错', () => {
  const none = new Set()
  assert.equal(typeof isPeakTime(0, none), 'boolean')
  assert.equal(typeof isPeakTime(Number.MAX_SAFE_INTEGER, none), 'boolean')
  assert.equal(typeof isPeakTime(-1, none), 'boolean')
})

test('失败路径：引用标记格式不完整时不匹配', () => {
  rememberProse('abcdef1234567890', '正文')
  const cases = ['@引用#', '@引用#abc', '@引用', '@引用#zzzzzzzzzzzz']
  for (const text of cases) {
    const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text }] }])
    assert.equal(out, null, `「${text}」不应被视为有效标记`)
  }
})

// ---------------------------------------------------------------------------
// 快捷按钮条（conversation.input.dock 的那条横条）
// ---------------------------------------------------------------------------

test('快捷按钮：内置清单每条都能寻址，且命令按钮的值是 slash 命令', () => {
  assert.ok(DEFAULT_QUICK_ACTIONS.length >= 3 && DEFAULT_QUICK_ACTIONS.length <= 8,
    '先做三五个按钮看效果')
  for (const button of DEFAULT_QUICK_ACTIONS) {
    assert.equal(typeof button.id, 'string')
    assert.ok(button.id.length > 0, 'id 不能为空')
    assert.ok(button.label.length > 0, 'label 不能为空')
    assert.ok(button.kind === 'prompt' || button.kind === 'command')
    assert.ok(button.value.length > 0, 'value 不能为空')
    if (button.kind === 'command') assert.match(button.value, /^\//, '命令按钮的值必须以 / 开头')
  }
  const ids = DEFAULT_QUICK_ACTIONS.map((button) => button.id)
  assert.equal(new Set(ids).size, ids.length, 'id 不能重复')
})

test('快捷按钮：normalizeQuickActions 丢弃残缺记录而不整条失败', () => {
  assert.equal(normalizeQuickActions(null), null)
  assert.equal(normalizeQuickActions('nope'), null)
  assert.equal(normalizeQuickActions({}), null, '没有 buttons 数组')
  const out = normalizeQuickActions({ buttons: [
    { id: 'a', label: 'A', kind: 'command', value: '/a' },
    { id: '', value: '/x' },
    { id: 'b', value: '' },
    'junk',
    { id: 'c', value: '一段预设' },
  ] })
  assert.deepEqual(out.buttons.map((button) => button.id), ['a', 'c'])
  assert.equal(out.buttons[0].kind, 'command')
  assert.equal(out.buttons[1].kind, 'prompt', 'kind 缺省时按 prompt 处理')
  assert.equal(typeof out.buttons[0].icon, 'string')
  // 也接受裸数组
  assert.deepEqual(normalizeQuickActions([{ id: 'z', value: 'v' }]).buttons.map((b) => b.id), ['z'])
})

test('快捷按钮：投影视图按引用稳定（击穿 viewCache 会无限重渲染）', () => {
  assert.equal(quickActionsProjection.key, QUICK_ACTIONS_KEY)
  assert.equal(quickActionsProjection.stateVersion, 1)
  const first = quickActionsProjection.wire.view({})
  const second = quickActionsProjection.wire.view({})
  assert.equal(first, second, 'view 必须返回同一引用')
  assert.equal(first.buttons, DEFAULT_QUICK_ACTIONS)
  const state = { any: 'state' }
  assert.equal(quickActionsProjection.apply(state, { type: 'turn/start' }), state,
    'apply 是恒等的：按钮来自配置，不来自会话日志')
})
