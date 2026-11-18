const PANELS = ['RD_ALKALINE','RD_ANTIBACT','RD_APPROVAL','RD_ASM_BOM','RD_ASM_PROC','RD_CHANGE',
  'RD_DOM_TEST','RD_DROP_PREC','RD_EQUIP_USE','RD_EXTRA_REC_FILE','RD_FILTER_EFF','RD_INSP_PLAN',
  'RD_INSTR_USE','RD_MINERAL','RD_MOLD_FORMULA','RD_MOLD_PROC','RD_PLAN','RD_PROD_DOCLIST',
  'RD_PROD_INFO','RD_PROGRESS','RD_RO_PROTECT','RD_SAMPLE_EXT','RD_SAMPLE_INT','RD_SAMPLE_ND',
  'RD_SCALE','RD_SHARE_FILE','RD_SOAK','RD_SPEC_DOC','RD_SPIKE_WATER']

const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
})
await page.reload(); await page.waitForTimeout(9000)

const MEASURE = () => {
  const paper = document.querySelector('.rsp-sheet, .approval-sheet')
  if (!paper) return { noSheet: true }
  const pr = paper.getBoundingClientRect()
  const paperW = Math.round(pr.width)
  const paperRight = Math.round(pr.right)
  const bad = []
  const seen = new Set()
  for (const el of paper.querySelectorAll('table, div, section')) {
    const r = el.getBoundingClientRect()
    if (r.width < 10) continue
    const w = Math.round(r.width)
    const over = w - paperW
    if (over > 8 && !seen.has(w)) {
      seen.add(w)
      bad.push({ cls: String(el.className).slice(0, 34) || el.tagName, w, over })
    }
  }
  bad.sort((a, b) => b.over - a.over)
  return { paperW, paperRight, scrollOver: paper.scrollWidth - paper.clientWidth, bad: bad.slice(0, 3) }
}

const results = []
for (const p of PANELS) {
  await page.evaluate((code) => { location.hash = '#/panelx/list/' + code }, p)
  await page.waitForTimeout(6500)
  // 页签(多页面板)
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.rsp-pages > *')]
    .map((e, i) => ({ i, t: (e.innerText || '').trim() })).filter(x => x.t).slice(0, 5))
  if (!tabs.length) {
    results.push({ panel: p, page: '-', ...(await page.evaluate(MEASURE)) })
  } else {
    for (const tb of tabs) {
      const ok = await page.evaluate((i) => {
        const els = [...document.querySelectorAll('.rsp-pages > *')]
        if (!els[i]) return false
        els[i].click(); return true
      }, tb.i)
      await page.waitForTimeout(1800)
      results.push({ panel: p, page: tb.t, ...(await page.evaluate(MEASURE)) })
    }
  }
}
const bad = results.filter((r) => r.bad && r.bad.length)
console.log('=== 溢出清单（' + bad.length + ' / ' + results.length + ' 页）===')
for (const b of bad) console.log(`  ${b.panel.padEnd(18)} [${b.page}] paperW=${b.paperW} scrollOver=${b.scrollOver} 最宽超 ${JSON.stringify(b.bad[0])}`)
const noSheet = results.filter((r) => r.noSheet).map((r) => `${r.panel}[${r.page}]`)
console.log('无纸面(可能未选单):', noSheet.join(', ') || '(无)')
await task.finish({ keep: [] })
process.exit(0)
