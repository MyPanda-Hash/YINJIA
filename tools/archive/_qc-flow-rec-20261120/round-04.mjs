/**
 * round-04:只看需检验的批次(勾「仅需检验」),确认中间格「来料检验单 ∥ 检验数据记录」两单并列;
 * 再点「检验数据记录」节点,确认能跳到 QC_INSP_REC 并定位到那张记录。
 */
const OUT = 'C:/Users/vigna/ego/qc-flow-rec-20261120'
const task = await taskSpace('qc-flow-rec-20261120')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8091/#/qc/flowMonitor', { timeout: 40000 })
await page.waitForSelector('.qcf-page', { timeout: 30000 })
await page.waitForTimeout(2500)

// 勾「仅需检验」(改前后端都会过滤,免检行不再占版面)
const onlyInspect = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.qcf-only')]
  const box = labels.map((l) => l.querySelector('.el-checkbox')).find(Boolean)
  return !!box
})
console.log('has 仅需检验 checkbox =', onlyInspect)
await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.qcf-only')]
  const lab = labels.find((l) => (l.textContent || '').includes('仅需检验'))
  const input = lab?.querySelector('input[type="checkbox"]')
  if (input && !input.checked) input.click()
})
await page.waitForTimeout(3000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const dump = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const rowInfo = (r) => ({
    batch: r.querySelector('.qcf-batch')?.textContent?.trim(),
    code: r.querySelector('.qcf-code')?.textContent?.trim(),
    stage: r.querySelector('.qcf-stage-tag')?.textContent?.trim(),
    slots: [...r.querySelectorAll('.qcf-slot')].map((slot) => [...slot.querySelectorAll('.qcf-node, .qcf-skip-chip')].map((n) => ({
      name: n.querySelector('.qcf-node-name')?.textContent?.trim() || n.textContent?.trim(),
      no: n.querySelector('.qcf-node-no')?.textContent?.trim() || '',
      badge: n.querySelector('.qcf-badge')?.textContent?.trim() || '',
      date: n.querySelector('.qcf-node-meta i')?.textContent?.trim() || '',
      qty: n.querySelector('.qcf-node-qty')?.textContent?.trim() || '',
      cls: n.className,
    }))),
  })
  // 找第一行带「检验数据记录」真实单号的(用于点它)
  const target = rows.find((r) => [...r.querySelectorAll('.qcf-node')].some((n) =>
    (n.textContent || '').includes('检验数据记录') && n.querySelector('.qcf-node-no') && !n.querySelector('.qcf-node-no.is-empty')))
  return {
    title: document.querySelector('.qcf-title')?.textContent?.trim() || '',
    stats: [...document.querySelectorAll('.qcf-stat')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()),
    rowCount: rows.length,
    rows: rows.slice(0, 4).map(rowInfo),
    targetIndex: target ? rows.indexOf(target) : -1,
    targetRecNo: target
      ? [...target.querySelectorAll('.qcf-node')].find((n) => (n.textContent || '').includes('检验数据记录'))?.querySelector('.qcf-node-no')?.textContent?.trim()
      : '',
  }
})
console.log(JSON.stringify(dump, null, 2))
await page.screenshot({ path: OUT + '/04-flow-only-inspect.png' })

// 点「检验数据记录」节点 → 应跳 QC_INSP_REC 并定位那张单
const recNo = dump.targetRecNo
if (recNo) {
  const clicked = await page.evaluate((no) => {
    const node = [...document.querySelectorAll('.qcf-node')].find((n) =>
      (n.textContent || '').includes('检验数据记录') && (n.querySelector('.qcf-node-no')?.textContent || '').trim() === no)
    if (!node) return false
    node.click()
    return true
  }, recNo)
  await page.waitForTimeout(4500)
  const after = await page.evaluate(() => ({
    hash: location.hash,
    bodyHasRecNo: document.body.innerText.includes('JYSJ-'),
    recNosInBody: [...new Set((document.body.innerText.match(/JYSJ-[0-9]{4}-[0-9]{4}/g) || []))].slice(0, 6),
    paperTitle: [...document.querySelectorAll('.rs-title, .rsp-title, [class*="sheet-title"]')].map((e) => e.textContent.trim()).slice(0, 3),
  }))
  console.log('click rec node ->', clicked, JSON.stringify(after, null, 2))
  await page.screenshot({ path: OUT + '/04b-jump-insp-rec.png' })
}

// 列表视图:确认「检验数据记录」列
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-radio-button__inner')]
  const b = btns.find((x) => (x.textContent || '').trim() === '列表')
  if (b) b.click()
})
await page.waitForTimeout(2500)
const listDump = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.qcf-table .el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const firstRow = [...document.querySelectorAll('.qcf-table .el-table__body tr')].slice(0, 2)
    .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  return { hash: location.hash, heads, firstRow }
})
console.log(JSON.stringify(listDump, null, 2))
await page.screenshot({ path: OUT + '/04c-list-view.png' })
console.log('done')
