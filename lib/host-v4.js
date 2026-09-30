/**
 * `dsh-hud` — host half.
 *
 * Contributes one client-visible `sessionCost` session projection: a pure fold
 * over the committed session log that books every billed model attempt into
 * peak / off-peak token buckets, attributed to the model **and provider route**
 * the request was built under — once for the whole session and once for the
 * turn (task) it belongs to.
 *
 * Money is computed in the wire view, never stored, from a price book built
 * from three sources, most authoritative first:
 *
 *  1. `DEEPSEEK_CNY` below — DeepSeek's official **CNY** list, which is what a
 *     mainland account is actually billed, including its peak/off-peak scheme.
 *  2. The vendored `@earendil-works/pi-ai` provider catalog that ships inside
 *     this app (`dist/providers/data/*.json`), read from disk at load. Every
 *     route this build can talk to is priced from its vendor's own published
 *     numbers, so an OpenAI/Anthropic/Google/… model is never priced as if it
 *     were DeepSeek.
 *  3. `prices.json` beside this file — optional, re-read live, for corrections
 *     and for models no catalog covers. It also carries the USD→CNY rate.
 *
 * A model that no source prices is **not** billed into any amount; it is
 * reported as unpriced so the UI can say so instead of inventing a figure.
 *
 * @module dsh-hud
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name. */
export const name = 'hud-cost'

/** The projection registry is the plugin's whole purpose; without it the fiber stays pending. */
export const inject = ['sessionProjections']

//#region price book

/**
 * DeepSeek's official CNY list, **peak-hour** rates per 1M tokens.
 * Source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *
 * Off-peak is exactly half of these. The CNY table is authoritative for a
 * mainland account (its balance and invoices are in CNY), so it deliberately
 * wins over the USD figure the vendored catalog carries for the same model.
 */
const DEEPSEEK_CNY = {
  'deepseek-flash': { cacheHit: 0.04, cacheMiss: 2, output: 8, cacheWrite: 0 },
  'deepseek-v4-flash': { cacheHit: 0.04, cacheMiss: 2, output: 8, cacheWrite: 0 },
  'deepseek-v4-flash-vision-exp': { cacheHit: 0.04, cacheMiss: 2, output: 8, cacheWrite: 0 },
  'deepseek-v4-pro': { cacheHit: 0.3, cacheMiss: 9, output: 27, cacheWrite: 0 },
}

/** Off-peak rates are exactly half of peak. */
const OFF_PEAK_MULTIPLIER = 0.5

/** Fallback USD→CNY rate; `prices.json` may override it. */
const DEFAULT_USD_TO_CNY = 7

/**
 * Chinese statutory public holidays, Beijing time. Peak pricing skips these
 * weekdays entirely. Source: 国办发明电〔2025〕7号 (2026 年节假日安排).
 * `prices.json` may replace the list.
 */
const DEFAULT_HOLIDAYS = [
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
  '2026-10-06', '2026-10-07',
]

/** The optional user price file, beside this module. */
const OVERRIDE_PATH = fileURLToPath(new URL('./prices.json', import.meta.url))

/** Read one non-negative finite number, tolerating anything else. */
function num(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * Locate the vendored pi-ai provider catalog inside the running app.
 * @returns the catalog directory, or null when the app layout is unfamiliar.
 */
function catalogDirectory() {
  const roots = []
  try {
    if (typeof process.resourcesPath === 'string') roots.push(process.resourcesPath)
  } catch { /* not Electron */ }
  try {
    roots.push(join(process.execPath, '..', '..', 'Resources'))
  } catch { /* ignore */ }
  for (const root of roots) {
    for (const carrier of ['app.asar', 'app.asar.unpacked']) {
      const dir = join(root, carrier, 'dsh', 'node_modules', '@earendil-works', 'pi-ai', 'dist', 'providers', 'data')
      try {
        if (statSync(dir).isDirectory()) return dir
      } catch { /* try the next candidate */ }
    }
  }
  return null
}

/**
 * Build the model index from the vendored catalog. The cost fields are the
 * vendor's own published prices per 1M tokens in USD.
 *
 * One model id appears in several catalogs — the vendor's own plus every
 * gateway that resells it — so two lookups are built: `byRoute` for an exact
 * `provider/model` pair (a route literally named `openai`), and `byModel` as
 * the fallback, where the shortest vendor name wins because canonical vendors
 * are named briefly (`openai`) and resellers are not
 * (`azure-openai-responses`).
 * @param dir - catalog directory.
 * @returns the two indexes.
 */
function readCatalog(dir) {
  const byModel = new Map()
  const byRoute = new Map()
  let files
  try {
    files = readdirSync(dir)
  } catch {
    return { byModel, byRoute }
  }
  for (const file of files) {
    if (!file.endsWith('.json') || file.startsWith('.')) continue
    let doc
    try {
      doc = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    } catch {
      continue
    }
    if (typeof doc !== 'object' || doc === null) continue
    const vendor = file.slice(0, -'.json'.length)
    for (const group of Object.values(doc)) {
      if (typeof group !== 'object' || group === null) continue
      for (const [key, entry] of Object.entries(group)) {
        if (typeof entry !== 'object' || entry === null) continue
        const cost = entry.cost
        if (typeof cost !== 'object' || cost === null) continue
        const model = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : key
        const provider = typeof entry.provider === 'string' ? entry.provider : vendor
        const candidate = {
          model,
          vendor: provider,
          label: typeof entry.name === 'string' ? entry.name : model,
          currency: 'USD',
          source: `pi-ai 目录 · ${vendor}`,
          peakPriced: false,
          rates: {
            cacheHit: num(cost.cacheRead),
            cacheMiss: num(cost.input),
            cacheWrite: num(cost.cacheWrite),
            output: num(cost.output),
          },
        }
        byRoute.set(`${provider}\u0000${model}`, candidate)
        const existing = byModel.get(model)
        if (existing === undefined || provider.length < existing.vendor.length) byModel.set(model, candidate)
      }
    }
  }
  return { byModel, byRoute }
}

/** The immutable part of the book: the vendored catalog plus the CNY list. */
let baseBook = null
/** Byte stamp of the last `prices.json` read. */
let overrideStamp = null
/** Parsed `prices.json`, or null when absent or malformed. */
let overrideDoc = null

/**
 * Read `prices.json` when its bytes changed. Failure keeps the previous book:
 * a malformed edit must never break the projection drive.
 * @returns the parsed document, or null.
 */
function readOverrides() {
  let stamp = null
  try {
    const stat = statSync(OVERRIDE_PATH)
    stamp = `${String(stat.mtimeMs)}:${String(stat.size)}`
  } catch {
    stamp = null
  }
  if (stamp === overrideStamp) return overrideDoc
  overrideStamp = stamp
  overrideDoc = null
  if (stamp !== null) {
    try {
      const parsed = JSON.parse(readFileSync(OVERRIDE_PATH, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null) overrideDoc = parsed
    } catch { /* keep the built-in book */ }
  }
  return overrideDoc
}

/**
 * The live price book: vendored catalog, then DeepSeek's official CNY list,
 * then the user's overrides, plus the holiday calendar and FX rate. Rebuilt
 * whenever `prices.json` changes, so a correction applies without a restart.
 * @returns the resolved book.
 */
function priceBook() {
  if (baseBook === null) {
    const dir = catalogDirectory()
    baseBook = dir === null ? { byModel: new Map(), byRoute: new Map() } : readCatalog(dir)
    for (const [model, rates] of Object.entries(DEEPSEEK_CNY)) {
      const entry = {
        model,
        vendor: 'deepseek',
        label: model,
        currency: 'CNY',
        source: 'DeepSeek 官方人民币价目',
        peakPriced: true,
        rates,
      }
      baseBook.byModel.set(model, entry)
      for (const route of ['deepseek', 'deepseek-account', 'deepseek-api-key']) {
        baseBook.byRoute.set(`${route}\u0000${model}`, entry)
      }
    }
  }
  const overrides = readOverrides()
  const book = {
    byModel: new Map(baseBook.byModel),
    byRoute: new Map(baseBook.byRoute),
    usdToCny: DEFAULT_USD_TO_CNY,
    holidays: new Set(DEFAULT_HOLIDAYS),
    catalogSize: baseBook.byModel.size,
  }
  if (overrides !== null) {
    if (typeof overrides.usdToCny === 'number' && overrides.usdToCny > 0) book.usdToCny = overrides.usdToCny
    if (Array.isArray(overrides.holidays)) {
      book.holidays = new Set(overrides.holidays.filter((day) => typeof day === 'string'))
    }
    if (typeof overrides.models === 'object' && overrides.models !== null) {
      for (const [model, entry] of Object.entries(overrides.models)) {
        if (typeof entry !== 'object' || entry === null) continue
        const base = book.byModel.get(model)
        const resolved = {
          model,
          vendor: typeof entry.vendor === 'string' ? entry.vendor : (base === undefined ? 'custom' : base.vendor),
          label: typeof entry.label === 'string' ? entry.label : (base === undefined ? model : base.label),
          currency: entry.currency === 'USD' ? 'USD' : 'CNY',
          source: typeof entry.source === 'string' ? entry.source : 'prices.json',
          peakPriced: entry.peakPriced === true,
          rates: {
            cacheHit: entry.cacheHit === undefined ? (base === undefined ? 0 : base.rates.cacheHit) : num(entry.cacheHit),
            cacheMiss: entry.cacheMiss === undefined ? (base === undefined ? 0 : base.rates.cacheMiss) : num(entry.cacheMiss),
            cacheWrite: entry.cacheWrite === undefined ? (base === undefined ? 0 : base.rates.cacheWrite) : num(entry.cacheWrite),
            output: entry.output === undefined ? (base === undefined ? 0 : base.rates.output) : num(entry.output),
          },
        }
        book.byModel.set(model, resolved)
        // An explicit `provider` scopes the override to one route; otherwise it
        // replaces the model wherever it appears.
        if (typeof entry.provider === 'string') book.byRoute.set(`${entry.provider}\u0000${model}`, resolved)
        else for (const [key, existing] of book.byRoute) {
          if (key.endsWith(`\u0000${model}`)) book.byRoute.set(key, resolved)
        }
      }
    }
  }
  return book
}

//#endregion

//#region calendar

/**
 * Asia/Shanghai is a fixed +08:00 offset with no DST, so shifting the instant
 * and reading UTC fields is an exact Beijing wall clock without `Intl` cost.
 */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * Whether one instant falls in a peak-priced window: Beijing time, Monday to
 * Friday, excluding Chinese statutory public holidays, 09:00–12:00 and
 * 14:00–18:00. Everything else — nights, weekends and holidays in full — is
 * off-peak. Vendors without time-of-day pricing ignore this.
 * @param ms - commit time of the usage event, epoch milliseconds.
 * @param holidays - the holiday set in force.
 * @returns true when the request's window is peak.
 */
function isPeakTime(ms, holidays = new Set(DEFAULT_HOLIDAYS)) {
  const shifted = new Date(ms + BEIJING_OFFSET_MS)
  const day = shifted.getUTCDay()
  if (day === 0 || day === 6) return false
  const month = shifted.getUTCMonth() + 1
  const date = String(shifted.getUTCFullYear())
    + '-' + String(month).padStart(2, '0')
    + '-' + String(shifted.getUTCDate()).padStart(2, '0')
  if (holidays.has(date)) return false
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  return (minutes >= 9 * 60 && minutes < 12 * 60) || (minutes >= 14 * 60 && minutes < 18 * 60)
}

//#endregion

//#region fold

/** @returns a fresh zeroed billing bucket. */
function zeroBuckets() {
  return { cacheHit: 0, cacheMiss: 0, cacheWrite: 0, output: 0 }
}

/** @returns fresh peak/off-peak counters. */
function zeroCounts() {
  return { peak: 0, offPeak: 0 }
}

/** @returns fresh peak/off-peak buckets. */
function zeroBucketPair() {
  return { peak: zeroBuckets(), offPeak: zeroBuckets() }
}

/** @returns one model's accumulator inside a scope. */
function emptyModelEntry() {
  return { provider: '', requests: zeroCounts(), buckets: zeroBucketPair() }
}

/**
 * One priced scope: the session, or one turn. `models` carries the same shape
 * one level down so a scope that mixed models still prices each correctly.
 * @returns a fresh empty scope.
 */
function emptyScope() {
  return { requests: zeroCounts(), buckets: zeroBucketPair(), models: {} }
}

/**
 * The four disjoint billing buckets one settlement reports.
 * @param usage - the `assistant/message` usage record.
 * @returns the buckets, or null when the event carries no usage at all.
 */
function bucketsFromUsage(usage) {
  if (typeof usage !== 'object' || usage === null) return null
  return {
    cacheHit: num(usage.cacheReadTokens),
    cacheMiss: num(usage.inputTokens),
    cacheWrite: num(usage.cacheWriteTokens),
    output: num(usage.outputTokens),
  }
}

/**
 * `left + sign * right`, bucket by bucket.
 * @param left - accumulator buckets.
 * @param right - contributing buckets.
 * @param sign - 1 to add, -1 to remove a replaced attempt.
 * @returns new buckets.
 */
function combineBuckets(left, right, sign) {
  return {
    cacheHit: left.cacheHit + sign * right.cacheHit,
    cacheMiss: left.cacheMiss + sign * right.cacheMiss,
    cacheWrite: left.cacheWrite + sign * right.cacheWrite,
    output: left.output + sign * right.output,
  }
}

/**
 * Book one attempt (or un-book a replaced one) into one scope's peak/off-peak
 * totals and its per-model breakdown, without mutating the input.
 * @param entry - the scope before the contribution, or undefined when new.
 * @param model - model id the attempt was built under.
 * @param provider - the provider route that served it.
 * @param slot - `peak` or `offPeak` (the wall-clock tier, not the billed tier).
 * @param buckets - the attempt's billing buckets.
 * @param sign - 1 to add, -1 to remove.
 * @returns the new scope.
 */
function contribute(entry, model, provider, slot, buckets, sign) {
  const scope = entry ?? emptyScope()
  const previous = Object.hasOwn(scope.models, model) ? scope.models[model] : emptyModelEntry()
  return {
    requests: { ...scope.requests, [slot]: scope.requests[slot] + sign },
    buckets: { ...scope.buckets, [slot]: combineBuckets(scope.buckets[slot], buckets, sign) },
    models: {
      ...scope.models,
      [model]: {
        provider: provider.length > 0 ? provider : previous.provider,
        requests: { ...previous.requests, [slot]: previous.requests[slot] + sign },
        buckets: { ...previous.buckets, [slot]: combineBuckets(previous.buckets[slot], buckets, sign) },
      },
    },
  }
}

/** Empty fold state; also the shape a malformed checkpoint is reset to. */
function emptyState() {
  return { header: null, last: null, ...emptyScope(), turns: {} }
}

/**
 * Tolerant parse: the registry calls `parse` on restored checkpoints and on
 * published view values. It must never throw inside the projection drive, so a
 * shape that is not ours degrades to a fresh empty value instead. A checkpoint
 * written by an older `stateVersion` never reaches here — the registry refuses
 * it and the cache refolds the whole log from seq 0.
 * @param value - candidate state.
 * @returns a usable state.
 */
function normalizeState(value) {
  if (typeof value !== 'object' || value === null) return emptyState()
  const state = value
  if (typeof state.requests !== 'object' || state.requests === null) return emptyState()
  if (typeof state.buckets !== 'object' || state.buckets === null) return emptyState()
  if (typeof state.models !== 'object' || state.models === null) return emptyState()
  return {
    header: typeof state.header === 'object' ? state.header : null,
    last: typeof state.last === 'object' ? state.last : null,
    requests: state.requests,
    buckets: state.buckets,
    models: state.models,
    turns: typeof state.turns === 'object' && state.turns !== null ? state.turns : {},
  }
}

//#endregion


//#region quote expansion

/**
 * Recent assistant prose by message id, so a `@引用#<id>` mark in a submitted
 * message can be expanded into the reply it names. Bounded: only the newest
 * entries are kept, and a mark naming an evicted reply is left as written.
 */
const QUOTE_INDEX_LIMIT = 400
const quoteIndex = new Map()

/** The durable mark a quote action writes into the composer draft. */
const QUOTE_MARK = /@引用#([0-9a-fA-F]{6,36})/g

/**
 * The assistant prose of one durable message: its visible text blocks in order.
 * Reasoning and tool-call blocks are left out, matching the client's quote action.
 * @param message - a durable core message.
 * @returns the joined prose, or null.
 */
function proseOfMessage(message) {
  const content = message?.content
  if (!Array.isArray(content)) return null
  const parts = []
  for (const block of content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
      parts.push(block.text)
    }
  }
  return parts.length === 0 ? null : parts.join('\n\n')
}

/**
 * Remember one reply under its message id, evicting the oldest past the bound.
 * @param id - durable assistant message id.
 * @param prose - the reply's visible prose.
 */
function rememberProse(id, prose) {
  quoteIndex.delete(id)
  quoteIndex.set(id, prose)
  while (quoteIndex.size > QUOTE_INDEX_LIMIT) {
    const oldest = quoteIndex.keys().next()
    if (oldest.done === true) break
    quoteIndex.delete(oldest.value)
  }
}

/**
 * Resolve a mark's id prefix. The client writes the hyphen-free first twelve hex
 * characters of a UUID, which is unique within a Session in practice.
 * @param prefix - the id fragment the mark carried.
 * @returns the prose, or null when nothing matches.
 */
function proseForPrefix(prefix) {
  const wanted = prefix.toLowerCase()
  let hit = null
  for (const [id, prose] of quoteIndex) {
    if (id.replace(/-/g, '').toLowerCase().startsWith(wanted)) hit = prose
  }
  return hit
}

/**
 * Rewrite one text into its expanded form, leaving unknown marks untouched.
 * @param text - the submitted text.
 * @returns the text to send.
 */
function expandQuoteText(text) {
  if (!QUOTE_MARK.test(text)) {
    QUOTE_MARK.lastIndex = 0
    return null
  }
  QUOTE_MARK.lastIndex = 0
  return text.replace(QUOTE_MARK, (mark, prefix) => {
    const prose = proseForPrefix(prefix)
    if (prose === null) return mark
    const quoted = prose.split('\n').map((line) => (line.length === 0 ? '>' : '> ' + line)).join('\n')
    return '【引用此前的回复】\n' + quoted + '\n'
  })
}

/**
 * Expand every quote mark in the messages entering one step. Only text blocks are
 * touched, and a batch with no marks is returned as null so the caller keeps the
 * original decision object.
 * @param messages - the decision's entering batch.
 * @returns the rewritten batch, or null when nothing changed.
 */
function expandQuoteMarks(messages) {
  if (!Array.isArray(messages)) return null
  let changed = false
  const out = messages.map((message) => {
    if (message === null || typeof message !== 'object' || !Array.isArray(message.content)) return message
    let touched = false
    const content = message.content.map((block) => {
      if (block === null || typeof block !== 'object' || block.type !== 'text' || typeof block.text !== 'string') return block
      const expanded = expandQuoteText(block.text)
      if (expanded === null) return block
      touched = true
      return { ...block, text: expanded }
    })
    if (!touched) return message
    changed = true
    return { ...message, content }
  })
  return changed ? out : null
}

//#endregion

//#region view

/**
 * The four rates one model carries after the tier that applies to it.
 * @param entry - the price-book entry.
 * @param tier - `peak` or `offPeak`.
 * @param usdToCny - the conversion rate in force.
 * @returns vendor-currency and CNY rates per 1M tokens, plus the multiplier.
 */
function ratesFor(entry, tier, usdToCny) {
  // Only a time-of-day vendor charges more at peak; every other vendor bills
  // one rate whatever the wall clock says.
  const multiplier = entry.peakPriced && tier === 'offPeak' ? OFF_PEAK_MULTIPLIER : 1
  const vendor = {
    cacheHit: entry.rates.cacheHit * multiplier,
    cacheMiss: entry.rates.cacheMiss * multiplier,
    cacheWrite: entry.rates.cacheWrite * multiplier,
    output: entry.rates.output * multiplier,
  }
  const fx = entry.currency === 'USD' ? usdToCny : 1
  return {
    multiplier,
    vendor,
    cny: {
      cacheHit: vendor.cacheHit * fx,
      cacheMiss: vendor.cacheMiss * fx,
      cacheWrite: vendor.cacheWrite * fx,
      output: vendor.output * fx,
    },
  }
}

/**
 * Per-bucket CNY of one tier's buckets under its rates.
 * @param buckets - tokens in that tier.
 * @param cnyRates - CNY per 1M tokens.
 * @returns CNY per bucket.
 */
function tierCost(buckets, cnyRates) {
  return {
    cacheHit: buckets.cacheHit * cnyRates.cacheHit / 1e6,
    cacheMiss: buckets.cacheMiss * cnyRates.cacheMiss / 1e6,
    cacheWrite: buckets.cacheWrite * cnyRates.cacheWrite / 1e6,
    output: buckets.output * cnyRates.output / 1e6,
  }
}

const BUCKET_KEYS = ['cacheHit', 'cacheMiss', 'cacheWrite', 'output']

/**
 * Money, tokens and per-model detail of one scope.
 * @param scope - a session or turn accumulator.
 * @param book - the price book in force.
 * @returns the summary shared by the session figures and every turn figure.
 */
function summarize(scope, book) {
  const tokens = zeroBuckets()
  const cost = zeroBuckets()
  const models = []
  const unpriced = []
  let cny = 0
  let requests = 0
  let peakRequests = 0

  for (const [model, entry] of Object.entries(scope.models)) {
    // An exact provider route wins: a route named `openai` must price from
    // OpenAI's own list even when the same model id is also resold elsewhere.
    const route = entry.provider.length > 0 ? `${entry.provider}\u0000${model}` : ''
    const price = (route === '' ? undefined : book.byRoute.get(route)) ?? book.byModel.get(model)
    requests += entry.requests.peak + entry.requests.offPeak
    peakRequests += entry.requests.peak

    const tierTokens = { peak: { ...entry.buckets.peak }, offPeak: { ...entry.buckets.offPeak } }
    const tierCosts = {}
    const tierRates = {}
    let modelCny = 0
    if (price !== undefined) {
      for (const tier of ['peak', 'offPeak']) {
        const applied = ratesFor(price, tier, book.usdToCny)
        const bucketCost = tierCost(entry.buckets[tier], applied.cny)
        tierCosts[tier] = bucketCost
        tierRates[tier] = { vendor: applied.vendor, cny: applied.cny, multiplier: applied.multiplier }
        for (const key of BUCKET_KEYS) {
          tokens[key] += entry.buckets[tier][key]
          cost[key] += bucketCost[key]
          modelCny += bucketCost[key]
        }
      }
      cny += modelCny
    } else {
      unpriced.push(model)
      for (const tier of ['peak', 'offPeak']) {
        for (const key of BUCKET_KEYS) tokens[key] += entry.buckets[tier][key]
      }
    }

    models.push({
      model,
      provider: entry.provider,
      vendor: price === undefined ? '' : price.vendor,
      label: price === undefined ? model : price.label,
      known: price !== undefined,
      currency: price === undefined ? '' : price.currency,
      source: price === undefined ? '' : price.source,
      peakPriced: price !== undefined && price.peakPriced,
      fx: price !== undefined && price.currency === 'USD' ? book.usdToCny : null,
      cny: modelCny,
      requests: entry.requests,
      tokens: tierTokens,
      cost: tierCosts,
      rates: tierRates,
    })
  }

  return { cny, requests, peakRequests, tokens, cost, models, unpriced }
}

/** Memoizes each state's view so an unchanged fold keeps one view reference. */
let viewCache = new WeakMap()
/** Identifies the price book a memoized view was built from. */
let viewStamp = null

/**
 * Project fold state to the client-visible value: session money and per-turn
 * money, per-bucket tokens and money, and the per-model detail that makes the
 * arithmetic auditable. Prices are applied here, never stored.
 * @param state - the current fold state.
 * @returns the wire view (identity-stable for an unchanged state).
 */
function viewOf(state) {
  const book = priceBook()
  const stamp = `${String(overrideStamp)}|${String(book.usdToCny)}|${String(book.catalogSize)}`
  if (stamp !== viewStamp) {
    viewStamp = stamp
    viewCache = new WeakMap()
  }
  const cached = viewCache.get(state)
  if (cached !== undefined) return cached

  const session = summarize(state, book)
  const turns = Object.entries(state.turns).map(([turn, scope]) => {
    const summary = summarize(scope, book)
    return {
      turn: Number(turn),
      cny: summary.cny,
      requests: summary.requests,
      peakRequests: summary.peakRequests,
      tokens: summary.tokens,
      cost: summary.cost,
      models: summary.models,
      unpriced: summary.unpriced,
    }
  })

  const view = {
    cny: session.cny,
    requests: session.requests,
    peakRequests: session.peakRequests,
    tokens: session.tokens,
    cost: session.cost,
    models: session.models,
    unpriced: session.unpriced,
    turns,
    usdToCny: book.usdToCny,
    peakNow: isPeakTime(Date.now(), book.holidays),
    catalogSize: book.catalogSize,
  }
  viewCache.set(state, view)
  return view
}

const EMPTY_VIEW = {
  cny: 0,
  requests: 0,
  peakRequests: 0,
  tokens: zeroBuckets(),
  cost: zeroBuckets(),
  models: [],
  unpriced: [],
  turns: [],
  usdToCny: DEFAULT_USD_TO_CNY,
  peakNow: false,
  catalogSize: 0,
}

/** The `sessionCost` projection unit. */
const sessionCostProjection = {
  key: 'sessionCost',
  // v3 records the provider route per model so a vendor's own prices apply.
  stateVersion: 3,
  stateSchema: { parse: normalizeState },
  init: () => emptyState(),
  apply: (state, event) => {
    switch (event.type) {
      // The model and route that price the attempts after it. Logged only when
      // the header changes, so the latest one is what is in force.
      case 'request/header': {
        const config = event.data?.header?.config
        const model = typeof config?.model === 'string' && config.model.length > 0 ? config.model : null
        if (model === null) return state
        const provider = typeof config?.provider === 'string' ? config.provider : ''
        if (state.header !== null && state.header.model === model && state.header.provider === provider) return state
        return { ...state, header: { provider, model } }
      }
      // A retry in the same step is billed as its own attempt, so the next
      // settlement must add rather than replace — the `tokenUsage` slot rule.
      case 'llm/retry-started': {
        const last = state.last
        if (last === null || last.turn !== event.data?.turn || last.step !== event.data?.step) return state
        return { ...state, last: null }
      }
      case 'assistant/message': {
        const buckets = bucketsFromUsage(event.data?.usage)
        if (buckets === null) return state
        const turn = event.data.turn
        const step = event.data.step
        const model = state.header === null ? '(unknown)' : state.header.model
        const provider = state.header === null ? '' : state.header.provider
        const slot = isPeakTime(event.time, priceBook().holidays) ? 'peak' : 'offPeak'
        let next = state
        const last = state.last
        // A later settlement for the same step supersedes the earlier sample,
        // in the session totals and in its own turn alike.
        if (last !== null && last.turn === turn && last.step === step) {
          next = {
            ...next,
            ...contribute(next, last.model, last.provider, last.slot, last.buckets, -1),
            turns: { ...next.turns, [turn]: contribute(next.turns[turn], last.model, last.provider, last.slot, last.buckets, -1) },
          }
        }
        next = {
          ...next,
          ...contribute(next, model, provider, slot, buckets, 1),
          turns: { ...next.turns, [turn]: contribute(next.turns[turn], model, provider, slot, buckets, 1) },
        }
        return { ...next, last: { turn, step, model, provider, slot, buckets } }
      }
      default: return state
    }
  },
  wire: {
    viewSchema: { parse: (value) => (typeof value === 'object' && value !== null ? value : EMPTY_VIEW) },
    view: viewOf,
  },
}

/**
 * Register the `sessionCost` unit; registration is an effect on this fiber, so
 * unloading the plugin removes the key and its cached cells.
 * @param ctx - registrant context carrying the projection registry.
 */
export function apply(ctx) {
  ctx.sessionProjections.register(sessionCostProjection)
  // Index every settled reply so a quote mark can be resolved at submit time.
  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'assistant/message') return
    const message = event.data?.message
    const id = message?.id
    if (typeof id !== 'string' || id.length === 0) return
    const prose = proseOfMessage(message)
    if (prose !== null) rememberProse(id, prose)
  })
  // Expand `@引用#<id>` marks into the named reply as the batch enters the step:
  // the composer stays short, and the model still reads the whole answer.
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision === null || decision === void 0 || decision.kind !== 'enter') return decision
    const expanded = expandQuoteMarks(decision.messages)
    return expanded === null ? decision : { ...decision, messages: expanded }
  })
}

export { sessionCostProjection, isPeakTime, DEEPSEEK_CNY, DEFAULT_USD_TO_CNY, expandQuoteMarks, proseOfMessage, rememberProse }
