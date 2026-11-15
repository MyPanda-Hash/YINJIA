/**
 * round-13.mjs — 现役 8090 **真实点击**两处打印,读打印层(#yj-print-host)取证(2026-11-15)。
 *
 * 断言:
 *   ① 排单计划(成型车间排单计划)「生产计划数量」= 25(工序口径,改前 50)
 *   ② 打印工单 → 成型生产任务单「成型折算后数量」= 25(改前 50)
 *
 * 做法:先把 page 里的 window.print 打成空函数(否则会阻塞当前页),
 *   再点真实按钮 → 打印层 #yj-print-host 的 innerText 就是纸面内容。
 */
const APP = 'http://127.0.0.1:8090'
const LINE = '4号车间'
const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')
const results = []
const check = (label, actual, ok) => results.push(`${ok ? '[PASS]' : '[FAIL]'} ${label} = ${JSON.stringify(actual)}`)

// ── 登录(正式库) ───────────────────────────────────────────────────────────────
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { try { localStorage.clear() } catch { } })
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.reload()
await page.waitForTimeout(4500)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const sel = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select'); if (sel) sel.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(800)
  await page.evaluate(() => { const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((it) => (it.textContent || '').trim() === 'YINJIA-MES'); if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
  await page.waitForTimeout(6500)
}
console.log('账套=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('*')].map((e) => (e.textContent || '').trim()).filter((t) => t === 'YINJIA-MES' || t === 'YINJIA-MES·测试库')[0] || '')))

// ── 工单排产页 → 选中 4号车间 ─────────────────────────────────────────────────────
await page.goto(`${APP}/#/prod/plan/workOrderBoard`, { timeout: 45000 })
await page.reload()
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.wb-left *')].find((el) => (el.textContent || '').replace(/\s+/g, '') === '4号车间')
  if (hit) hit.setAttribute('data-e2e', 'line-hit')
})
try { await page.click('[data-e2e="line-hit"]') } catch (e) { console.log('line click: ' + e.message) }
await page.waitForTimeout(7000)

// 打印不真弹对话框(否则窗口阻塞)
await page.evaluate(() => { window.print = () => { /* 取证用:吞掉打印对话框 */ } })

// 勾第一行
const checked = await page.evaluate(() => {
  const tr = document.querySelector('.el-table__body tbody tr')
  const cb = tr && tr.querySelector('.el-checkbox')
  if (cb) { cb.setAttribute('data-e2e', 'row-check'); return true }
  return false
})
if (checked) { try { await page.click('[data-e2e="row-check"]') } catch (e) { console.log('check: ' + e.message) } }
await page.waitForTimeout(1200)

// 抓打印层内容
async function hostText() {
  return page.evaluate(() => {
    const h = document.getElementById('yj-print-host')
    return h ? (h.innerText || '').replace(/\s+/g, ' ').trim() : ''
  })
}

// ── ① 排单计划 ─────────────────────────────────────────────────────────────────
const clickedPlan = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('排单计划') && !/设置/.test(x.textContent || ''))
  if (b) { b.setAttribute('data-e2e', 'btn-plan'); return true }
  return false
})
if (clickedPlan) { try { await page.click('[data-e2e="btn-plan"]') } catch (e) { console.log('plan click: ' + e.message) } }
await page.waitForTimeout(4000)
const planText = await hostText()
console.log('排单计划打印层(前 400): ' + JSON.stringify(planText.slice(0, 400)))
check('排单计划已出纸', planText.length > 0, planText.length > 0)
check('纸面标题=成型车间排单计划', planText.includes('成型车间排单计划'), planText.includes('成型车间排单计划'))
// 列头顺序:... 未完成总数 订单数量 生产计划数量 实际完成数量 ...
// 行数据 = 「GD-... T410 63*40*193 4号车间 ▸ 未完成总数 订单数量 生产计划数量 实际完成数量」
const planNums = /GD-2026-11-0028[^\d]*T410[^\d]*63\*40\*193[^\d]*4号车间\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/.exec(planText)
console.log('排单计划四个数字列 = ' + JSON.stringify(planNums && planNums.slice(1)))
check('生产计划数量 = 25(工序计划量)', planNums && planNums[3], !!planNums && planNums[3] === '25')
check('未完成总数/订单数量 = 50(成品口径保持不变)', planNums && planNums[1] + '/' + planNums[2], !!planNums && planNums[1] === '50' && planNums[2] === '50')

await page.evaluate(() => { try { document.getElementById('yj-print-host')?.remove() } catch { } })

// ── ② 打印工单 → 成型生产任务单 ──────────────────────────────────────────────────
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('打印工单'))
  if (b) { b.setAttribute('data-e2e', 'btn-print'); return true }
  return false
})
await page.waitForTimeout(300)
if (opened) { try { await page.click('[data-e2e="btn-print"]') } catch (e) { console.log('print click: ' + e.message) } }
await page.waitForTimeout(900)
const picked = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item, li')].find((x) => (x.textContent || '').includes('成型生产任务单'))
  if (it) { it.setAttribute('data-e2e', 'mi-mold'); return true }
  return false
})
if (picked) { try { await page.click('[data-e2e="mi-mold"]') } catch (e) { console.log('menu click: ' + e.message) } }
await page.waitForTimeout(5000)
const taskText = await hostText()
console.log('任务单打印层(前 300): ' + JSON.stringify(taskText.slice(0, 300)))
check('任务单已出纸', taskText.length > 0, taskText.length > 0)
check('纸面标题=成型生产任务单', taskText.includes('成型生产任务单'), taskText.includes('成型生产任务单'))
// 行数据 = 「1 GD-... 否 T410 A级烧结炭棒/滤芯 63*40*193 ▸ 订单数量 成型折算后数量 计划完工日期」
const taskNums = /63\*40\*193\s+([\d.-]+)\s+([\d.-]+)\s+2026-\d\d-\d\d/.exec(taskText)
console.log('任务单 订单数量/成型折算后数量 = ' + JSON.stringify(taskNums && taskNums.slice(1)))
check('成型折算后数量 = 25', taskNums && taskNums[2], !!taskNums && taskNums[2] === '25')
check('订单数量 = 50(不变)', taskNums && taskNums[1], !!taskNums && taskNums[1] === '50')

console.log('\n' + results.join('\n'))
const fail = results.filter((x) => x.startsWith('[FAIL]')).length
console.log(fail === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fail})`)

