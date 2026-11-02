import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const output = process.env.CAPTURE_DIR
const target = process.env.CAPTURE_URL
if (!output || !target) throw new Error('Set CAPTURE_URL and CAPTURE_DIR.')
let url
try {
  url = new URL(target)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) capture URLs are supported.')
} catch (error) {
  throw new Error(`Invalid CAPTURE_URL: ${error.message}`)
}

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
let chromium
let config
try {
  ;({ chromium } = require('playwright'))
  config = JSON.parse(readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'))
} catch (error) {
  console.error(`Unable to load the capture browser runtime: ${error.message}`)
  process.exitCode = 75
}
if (!chromium || !config) process.exit(75)
if (process.platform === 'linux') {
  try { process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim() }
  catch (error) { console.error(`Unable to configure the capture display: ${error.message}`); process.exit(75) }
}

mkdirSync(output, { recursive: true })
let browser
let exitCode = 0
try {
  try { browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }) }
  catch (error) { throw Object.assign(new Error(`Browser launch failed: ${error.message}`), { exitCode: 75 }) }

  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    let page
    try { page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }) }
    catch (error) { throw Object.assign(new Error(`Could not create ${name} page: ${error.message}`), { exitCode: 75 }) }
    page.setDefaultTimeout(30000)
    let response
    try { response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 45000 }) }
    catch (error) { throw Object.assign(new Error(`Navigation failed for ${name}: ${error.message}`), { exitCode: 75 }) }
    if (!response) throw Object.assign(new Error(`No HTTP response while loading ${name}.`), { exitCode: 75 })
    if (!response.ok()) {
      const temporary = [408, 425, 429, 500, 502, 503, 504].includes(response.status())
      throw Object.assign(new Error(`HTTP ${response.status()} loading capture URL.`), { exitCode: temporary ? 75 : 1 })
    }

    // The game is intentionally built from fixed-position layers, so body itself may
    // have a zero-height box. Wait for its actual welcome screen instead.
    try {
      await page.locator('#welcome.open').waitFor({ state: 'visible', timeout: 30000 })
      await page.getByRole('heading', { name: 'THE ASCENT' }).waitFor({ state: 'visible', timeout: 10000 })
    } catch (error) {
      throw Object.assign(new Error(`Rendered game content was not visible in ${name}: ${error.message}`), { exitCode: 1 })
    }
    await page.waitForTimeout(500)
    try { await page.screenshot({ path: join(output, `final-${name}.png`), fullPage: true, timeout: 30000 }) }
    catch (error) {
      const temporary = !browser.isConnected() || /browser.*closed|target.*closed|timeout/i.test(error.message)
      throw Object.assign(new Error(`Screenshot failed for ${name}: ${error.message}`), { exitCode: temporary ? 75 : 1 })
    }
    console.log(`Saved ${name} capture: ${join(output, `final-${name}.png`)}`)
    await page.close()
  }
} catch (error) {
  console.error(error)
  exitCode = error.exitCode || 1
} finally {
  if (browser) {
    try { await browser.close() }
    catch (error) { console.error(`Browser cleanup failed: ${error.message}`); if (!exitCode) exitCode = 75 }
  }
}
process.exitCode = exitCode
