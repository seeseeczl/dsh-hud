import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPeakTime, expandQuoteMarks, rememberProse, proseOfMessage, readProcessMemory,
  DEEPSEEK_CNY, DEFAULT_USD_TO_CNY,
} from '../lib/host-v6.js'

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

test('引用：未知 id 保留标记，但仍产生新批次（记录了实际行为）', () => {
  // expandQuoteText returns a replacement string whenever a mark is present, so a
  // mark that cannot be resolved still counts as "changed" and the batch is copied.
  // This is the real contract; see AUD-LOGIC-001 in the adversarial audit.
  const input = [{ role: 'user', content: [{ type: 'text', text: '参考 @引用#ffffffffffff 的做法' }] }]
  const out = expandQuoteMarks(input)
  assert.ok(out !== null, '当前实现会返回新批次')
  assert.match(out[0].content[0].text, /@引用#ffffffffffff/, '未知 id 应保留标记原文')
  assert.notEqual(out, input, '返回的是新对象，不是原对象')
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
  assert.match(oldest[0].content[0].text, /@引用#/, '最旧的应已被淘汰，标记保持原样')

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
