import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from './helpers/load-client.mjs'

/**
 * 客户端纯函数的断言（审计 AUD-QUAL-001 / 任务卡 P1-01）。
 *
 * 只测 `describeScope` 的账单文本：它是悬停提示与花费面板共用的输出，
 * 覆盖 FM-006（花费面板）与 FM-007（峰谷拆分 + 两项省钱）的全部验收点。
 * 不引入 jsdom，也不渲染任何组件——`load-client.mjs` 已经用最小替身把
 * 模块工厂物化出来。
 */

/** DeepSeek flash 现行人民币价目：高峰价，空闲价为一半。 */
const DEEPSEEK_RATES = {
  peak: {
    cny: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    vendor: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
  },
  offPeak: {
    cny: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
    vendor: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
  },
}

/**
 * 一条 DeepSeek 模型的投影记录：峰时与谷时各花 0.64 元。
 * 缓存省下 = 峰 1M ×(2−0.04) + 谷 2M ×(1−0.02) = 3.92 元；
 * 谷时折扣省下 = 谷时实付 0.64 元；可挪动的峰时花费 = 0.64 / 2 = 0.32 元。
 */
function deepseekEntry() {
  return {
    model: 'deepseek-flash',
    provider: 'deepseek-account',
    vendor: 'DeepSeek',
    source: '官方人民币价目',
    known: true,
    peakPriced: true,
    rates: DEEPSEEK_RATES,
    tokens: {
      peak: { cacheHit: 1_000_000, cacheMiss: 100_000, cacheWrite: 0, output: 50_000 },
      offPeak: { cacheHit: 2_000_000, cacheMiss: 200_000, cacheWrite: 0, output: 100_000 },
    },
    cost: {
      peak: { cacheHit: 0.04, cacheMiss: 0.2, cacheWrite: 0, output: 0.4 },
      offPeak: { cacheHit: 0.04, cacheMiss: 0.2, cacheWrite: 0, output: 0.4 },
    },
    requests: { peak: 3, offPeak: 5 },
    cny: 1.28,
    fx: null,
  }
}

test('describeScope：峰谷混合的 DeepSeek 会话，拆分与两项省钱都在', () => {
  const { describeScope } = loadClient()
  const scope = { requests: 8, peakRequests: 3, models: [deepseekEntry()], unpriced: [] }
  const text = describeScope(scope, undefined, '本会话总费用 1.28 元')

  assert.match(text, /^本会话总费用 1\.28 元$/m, '首行是调用方给的标题')
  assert.match(text, /计费请求 8 次 · 高峰 3 次/)
  assert.match(text, /deepseek-flash · DeepSeek · 官方人民币价目/)
  assert.match(text, /小计 ¥1\.28/)

  // FM-007：峰谷拆分与「挪到谷时还能省多少」。
  assert.match(text, /按时段/)
  assert.match(text, /^ {2}峰时 ¥0\.640$/m)
  assert.match(text, /^ {2}谷时 ¥0\.640$/m)
  assert.match(text, /峰时改到谷时，还能再省 ¥0\.320/)

  // FM-006：两项省钱。
  assert.match(text, /缓存为你省下 ¥3\.92/)
  assert.match(text, /这些 token 若未命中缓存，会按未命中价计费/)
  assert.match(text, /谷时折扣为你省下 ¥0\.640/)
})

test('describeScope：非峰谷定价的厂商不产生「挪到谷时」的数字，也不产生谷时折扣', () => {
  const { describeScope } = loadClient()
  const scope = {
    requests: 2,
    peakRequests: 1,
    models: [{
      model: 'flat-model',
      vendor: 'FlatVendor',
      known: true,
      peakPriced: false,
      rates: {
        offPeak: {
          cny: { cacheHit: 1, cacheMiss: 3, output: 6 },
          vendor: { cacheHit: 1, cacheMiss: 3, output: 6 },
        },
      },
      tokens: { offPeak: { cacheHit: 500_000, cacheMiss: 50_000, cacheWrite: 0, output: 10_000 } },
      cost: { offPeak: { cacheHit: 0.5, cacheMiss: 0.15, cacheWrite: 0, output: 0.06 } },
      requests: { peak: 0, offPeak: 2 },
      cny: 0.71,
      fx: null,
    }],
    unpriced: [],
  }
  const text = describeScope(scope, undefined, '本次任务（第 3 轮）费用 0.71 元')

  assert.match(text, /单一价（该厂商不分时段）/, 'flat 厂商按单一时段报告')
  assert.match(text, /^ {2}谷时 ¥0\.710$/m)
  assert.match(text, /没有可挪到谷时的峰时用量/, '可挪动金额为 0 时给的是说明而不是数字')
  assert.doesNotMatch(text, /峰时改到谷时，还能再省/)
  assert.doesNotMatch(text, /谷时折扣为你省下/, 'flat 厂商没有谷时折扣')
})

test('describeScope：未收录价目的模型不计入金额，并单独列出', () => {
  const { describeScope } = loadClient()
  const scope = {
    requests: 2,
    peakRequests: 0,
    models: [{ model: 'mystery-model', vendor: 'Someone', known: false, cny: 0 }],
    unpriced: ['mystery-model'],
  }
  const text = describeScope(scope, undefined, '本会话总费用 0.00 元')

  assert.match(text, /全部空闲时段/, '没有峰时请求时写明全部空闲')
  assert.match(text, /未收录价目，未计入金额/)
  assert.match(text, /未计价模型：mystery-model/)
  assert.doesNotMatch(text, /缓存为你省下/)
  assert.doesNotMatch(text, /按时段/, '没有可拆分的峰谷金额时不出现时段段')
})

test('describeScope：scope 缺字段时不抛错，退化为最小文本', () => {
  const { describeScope } = loadClient()
  assert.match(describeScope({}, undefined, '标题'), /^标题$/m)
  assert.match(describeScope({ models: null }, undefined, '标题'), /标题/)
})

test('两次加载互相独立（AUD-TEST-003 的守卫）', () => {
  const a = loadClient()
  const b = loadClient()
  assert.notEqual(a, b, '每次加载都应得到独立的模块实例')
  assert.equal(typeof a.describeScope, 'function')
  assert.equal(typeof b.describeScope, 'function')
  const scope = { requests: 1, peakRequests: 1, models: [deepseekEntry()], unpriced: [] }
  assert.equal(a.describeScope(scope, undefined, 'x'), b.describeScope(scope, undefined, 'x'))
})

test('formatCny：金额精度随量级自适应', () => {
  const { formatCny } = loadClient()
  assert.equal(formatCny(0), '0.00')
  assert.equal(formatCny(1.28), '1.28')
  assert.equal(formatCny(0.64), '0.640')
  assert.equal(formatCny(0.0032), '0.0032')
})

test('registerSlotCell：同一实例内重复 id 被跳过，不再打给注册表（AUD-OPS-001）', () => {
  const { registerSlotCell } = loadClient()
  const registered = []
  const ctx = { slots: { register: (options) => { registered.push(options.id); return () => {} } } }

  const first = registerSlotCell(ctx, 'conversation.composer.dock', 'sym-cost', 10, () => null)
  const second = registerSlotCell(ctx, 'conversation.composer.dock', 'sym-cost', 10, () => null)

  assert.equal(typeof first, 'function', '首次注册返回注册表的 disposer')
  assert.equal(second, null, '重复注册被跳过')
  assert.deepEqual(registered, ['sym-cost'], '注册表只被调用一次')
})

test('registerSlotCell：注册表拒绝时吞掉异常并返回 null，后续插槽不受影响', () => {
  const { registerSlotCell } = loadClient()
  const attempted = []
  const ctx = {
    slots: {
      register: (options) => {
        attempted.push(options.id)
        if (options.id === 'bad') throw new Error('duplicate id')
        return () => {}
      },
    },
  }

  assert.equal(registerSlotCell(ctx, 'some.slot', 'bad', 1, () => null), null)
  assert.equal(typeof registerSlotCell(ctx, 'some.slot', 'good', 2, () => null), 'function',
    '一个插槽失败不连累其他插槽')
  assert.deepEqual(attempted, ['bad', 'good'])
})

test('降级日志：每个来源只记录一次，不随渲染刷屏（P2-01）', () => {
  const { registerSlotCell } = loadClient()
  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  try {
    const ctx = { slots: { register: () => { throw new Error('boom') } } }
    registerSlotCell(ctx, 'some.slot', 'a', 1, () => null)
    registerSlotCell(ctx, 'some.slot', 'a', 1, () => null)
    registerSlotCell(ctx, 'some.slot', 'b', 2, () => null)
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 2, '同一 id 的重复失败只记录一次，不同 id 各记一次')
  assert.match(warnings[0], /^\[dsh-sym\] slot:some\.slot#a 降级：注册被拒：boom$/)
  assert.match(warnings[1], /slot:some\.slot#b/)
})

test('quickButtonsOf：只保留能寻址的按钮，其余丢弃', () => {
  const { quickButtonsOf } = loadClient()
  assert.deepEqual(quickButtonsOf(null), [])
  assert.deepEqual(quickButtonsOf(undefined), [])
  assert.deepEqual(quickButtonsOf({}), [])
  assert.deepEqual(quickButtonsOf({ buttons: 'nope' }), [])
  const kept = quickButtonsOf({ buttons: [
    { id: 'ok', label: '可用', kind: 'command', value: '/compact' },
    { id: '', value: '/x' },
    { id: 'no-value', value: '' },
    null,
    'junk',
  ] })
  assert.deepEqual(kept.map((button) => button.id), ['ok'])
  assert.equal(kept[0].kind, 'command')
})

test('设置页：配置值与编辑草稿之间的转换', () => {
  const { toConfigButton } = loadClient()
  const config = toConfigButton({ id: 'a', label: 'A', icon: 'search', kind: 'skill', value: 'x', extra: 1 })
  assert.deepEqual(Object.keys(config).sort(), ['icon', 'id', 'kind', 'label', 'value'],
    '只写 schema 声明的字段，别把界面状态写回文件')
  assert.equal(config.kind, 'skill')
  assert.equal(toConfigButton({}).icon, 'dot', '缺字段补默认')
  assert.equal(toConfigButton({ kind: 'nope' }).kind, 'prompt')
})

test('快捷按钮：配置存在本地，读不出来时回落默认', () => {
  const { readStoredQuickActions, writeStoredQuickActions } = loadClient()
  const saved = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
  try {
    assert.equal(readStoredQuickActions(), null, '没配过时返回 null')
    assert.equal(writeStoredQuickActions([{ id: 'a', value: 'v' }], true), true)
    const stored = readStoredQuickActions()
    assert.deepEqual(stored.buttons.map((b) => b.id), ['a'])
    assert.equal(stored.enabled, true)
    // 清掉（传 null）＝ 恢复内置默认
    writeStoredQuickActions(null, true)
    assert.equal(readStoredQuickActions(), null)
    // 坏了的值不能让界面炸掉
    store.set('dsh-sym.quick-actions', '{ not json')
    assert.equal(readStoredQuickActions(), null)
  } finally {
    if (saved === undefined) delete globalThis.localStorage
    else globalThis.localStorage = saved
  }
})

test('渲染冒烟：竖条与设置页组件能被调用而不抛错', () => {
  // 这条是补课：曾把竖条里的 `projected` 改名成 `fromProjection` 却漏改一处引用，
  // 组件一渲染就抛 ReferenceError，React 把整条竖条卸载掉，界面上「什么都没有」，
  // 查了很久。让组件真的被调用一次，这类错误就再也跑不掉。
  const client = loadClient()
  const rail = client.QuickActionsRail({
    text: (key) => key,
    inputActions: null,
    sessionId: 's1',
    useProjection: () => null,
    commands: null,
  })
  assert.ok(rail !== null && typeof rail === 'object', '竖条要能渲染出元素')
  const page = client.QuickActionsSettings({ text: (key) => key })
  assert.ok(page !== null && typeof page === 'object', '设置页要能渲染出元素')
})

test('导入：接受 { buttons } 与裸数组，坏文件返回 null', () => {
  const { parseQuickActionsFile } = loadClient()
  assert.deepEqual(parseQuickActionsFile('{"buttons":[{"id":"a","value":"v"}]}').map((b) => b.id), ['a'])
  assert.deepEqual(parseQuickActionsFile('[{"id":"b","value":"w"}]').map((b) => b.id), ['b'])
  assert.equal(parseQuickActionsFile('{ not json'), null)
  assert.equal(parseQuickActionsFile('{"buttons":[]}'), null, '空的导入等于没内容')
  assert.equal(parseQuickActionsFile('{"buttons":"nope"}'), null)
})

test('显示项：三个开关默认全开，读写往返正确，坏值回落全开', () => {
  const { readDisplayOptions, writeDisplayOptions } = loadClient()
  const saved = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
  try {
    assert.deepEqual(readDisplayOptions(), { balance: true, cost: true, memory: true })
    writeDisplayOptions({ balance: false, cost: true, memory: false })
    assert.deepEqual(readDisplayOptions(), { balance: false, cost: true, memory: false })
    // 只关心显式 false：别的值都当"开"
    store.set('dsh-sym.display-options', '{"balance":"nope"}')
    assert.deepEqual(readDisplayOptions(), { balance: true, cost: true, memory: true })
    store.set('dsh-sym.display-options', '{ 坏的 json')
    assert.deepEqual(readDisplayOptions(), { balance: true, cost: true, memory: true })
  } finally {
    if (saved === undefined) delete globalThis.localStorage
    else globalThis.localStorage = saved
  }
})

test('指令下拉：解析 commands.list 的各种返回形状', () => {
  const { commandNamesOf } = loadClient()
  assert.deepEqual(commandNamesOf(['compact', '/model']), ['/compact', '/model'], '字符串元素')
  assert.deepEqual(commandNamesOf([{ name: 'compact' }, { name: '/model' }]), ['/compact', '/model'], '描述符元素')
  assert.deepEqual(commandNamesOf({ ok: true, value: [{ name: 'compact' }] }), ['/compact'], '{ ok, value } 包装')
  assert.deepEqual(commandNamesOf(['/a', '/a', 'a']), ['/a'], '去重')
  assert.deepEqual(commandNamesOf(null), [])
  assert.deepEqual(commandNamesOf({ nope: 1 }), [])
})

test('指令下拉：返回结构更复杂时也能找出命令数组', () => {
  const { commandNamesOf } = loadClient()
  assert.deepEqual(commandNamesOf({ ok: true, value: { commands: [{ name: 'compact' }] } }), ['/compact'])
  assert.deepEqual(commandNamesOf({ value: { items: ['/model'] } }), ['/model'])
  assert.deepEqual(commandNamesOf({ data: ['/export'] }), ['/export'])
})
