/**
 * Load `lib/client.js` outside a browser.
 *
 * The browser half is a module-factory bundle: it registers itself through
 * `window.__ModuleLoader__.load({ id, factory })` and only requires the platform
 * baseline (`react`, `react/jsx-runtime`). This shim captures that registration
 * and materialises the factory with a minimal React stand-in, so exported pure
 * helpers (`describeScope`, `formatCny`, `pickTurn`, …) can be asserted without
 * a DOM. Deliberately no jsdom dependency — see the audit's P1-01 stop condition.
 *
 * @returns the module's exports.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CLIENT = join(here, '..', '..', 'lib', 'client.js')

/** Minimal `react` stand-in: enough for module bodies, never for rendering. */
function fakeReact() {
  const noop = () => {}
  // 错误边界是 class 组件，所以替身必须提供 Component（只用到构造与 props）。
  class Component {
    constructor(props) {
      this.props = props
    }
  }
  return {
    Component,
    createElement: (type, props, ...kids) => ({ type, props, kids }),
    useState: (init) => [typeof init === 'function' ? init() : init, noop],
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    useEffect: noop,
    useMemo: (fn) => fn(),
    memo: (c) => c,
  }
}

export function loadClient() {
  // Save and restore the global so repeated loads cannot leak state into each
  // other (AUD-TEST-003): the module's own module-level caches stay per-instance
  // only if nothing of ours survives the call.
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window')
  const savedWindow = globalThis.window

  let captured = null
  try {
    globalThis.window = { __ModuleLoader__: { load: (mod) => { captured = mod } } }

    const source = readFileSync(CLIENT, 'utf8')
    // The bundle is CJS-ish inside the factory; run it with the shim globals.
    const run = new Function(
      'window', 'document', 'MutationObserver', 'requestAnimationFrame',
      'cancelAnimationFrame', 'setTimeout', 'clearTimeout', source
    )
    run(
      globalThis.window,
      { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {} }),
        head: { appendChild: () => {} }, body: {}, documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {} },
        addEventListener() {}, removeEventListener() {} },
      function () {},
      () => 0,
      () => {},
      () => 0,
      () => {}
    )
    if (captured === null) throw new Error('client.js did not register a module')
    const react = fakeReact()
    // Stand in the platform modules a real deployment provides. Without them
    // every load would record `panel:react-dom` and `brand:primitives` as
    // degradations, drowning the cases that are actually about a missing module.
    const reactDom = { createPortal: () => null }
    const primitives = { BrandWordmark: () => null }
    return captured.factory((spec) => {
      if (spec === 'react' || spec === 'react/jsx-runtime') return react
      if (spec === 'react-dom') return reactDom
      if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
      throw new Error('unexpected platform module: ' + spec)
    })
  } finally {
    if (hadWindow) globalThis.window = savedWindow
    else delete globalThis.window
  }
}
