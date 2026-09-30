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
  return {
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
  let captured = null
  globalThis.window = globalThis.window ?? {}
  globalThis.window.__ModuleLoader__ = { load: (mod) => { captured = mod } }

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
  return captured.factory((spec) => {
    if (spec === 'react' || spec === 'react/jsx-runtime') return react
    throw new Error('unexpected platform module: ' + spec)
  })
}
