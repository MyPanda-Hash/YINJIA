/**
 * _shots.mjs — 「附件一 智慧工厂系统明细清单」WMS 部分:真实登录本地系统 + 真实页面截图
 * (2026-10-05;配套说明见同目录 README.md)
 *
 * 用途:客户/招标附件要求按模块名配「系统界面截图」,本脚本用真实账号登录本地实例
 * (默认 http://127.0.0.1:8090 = java -jar 正式账套 HSDZ_MES),逐个打开本地真实页面截图,
 * 不做任何造数、不改库、只读浏览。
 *
 * 用法:
 *   node tools/archive/_wms-doc-shots/_shots.mjs [http://127.0.0.1:8090]
 *   node tools/archive/_wms-doc-shots/_shots.mjs --dump=/panelx/list/INV   # 只打印该页工具栏 DOM
 * 产物:同目录 shots/*.png + shots/_summary.json + 控制台逐页 DOM 摘要
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9411
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const ADMIN = { userName: 'admin', password: '123456', factory: 'YINJIA-MES' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 截图清单:[文件名, 路由, 说明(映射到附件一的哪个模块)] */
const PAGES = [
  ['08-材料仓库条码管理-采购入库单', '/panelx/list/PURCHASE_IN', '材料入库:采购入库单(工具栏「打印标识卡」)'],
  ['08b-材料仓库条码管理-商品档案二维码标签', '/panelx/list/INV', '材料档案 + 勾选即打「二维码标签」(75×100mm)'],
  ['09-半成品仓库条码管理-库存状况表', '/panelx/list/STOCK_BALANCE', '半成品仓(CK04)结存:按仓库×存货,首屏即半成品仓行'],
  ['10-成品仓库条码管理-产成品入库单', '/panelx/list/FINISH_IN', '成品入库:产成品入库单'],
  ['10b-成品仓库条码管理-销售出库单', '/panelx/list/SALE_OUT', '成品出库:销售出库单'],
  ['11-库内管理-库存状况表', '/panelx/list/STOCK_BALANCE', '库内管理:按仓库×存货的结存状况'],
  ['11d-库内管理-仓库与库位档案', '/panelx/list/WH', '库内管理:仓库档案(11 仓,含半成品仓/成品仓)'],
  ['12-ERP系统集成模块-ERP导入日志', '/panelx/list/ERPLG', 'ERP 集成:金蝶云对接导入日志'],
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-wmsshot-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-popup-blocking',                     // 二维码标签走 window.open → 不能被拦
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)
  const summary = []
  let cdp = null
  try {
    cdp = await attachCdp(PORT, undefined, (msg) => {
      // window.open 被拦时前端会 alert(浏览器拦截了打印窗口…) —— 自动确认,否则页面 JS 被阻塞
      if (msg.method === 'Page.javascriptDialogOpening') {
        console.log('       [页面弹窗]', String(msg.params?.message || '').slice(0, 80))
        cdp.send('Page.handleJavaScriptDialog', { accept: true })
      }
    })
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

    const ev = cdp.ev
    /** 带用户手势的求值:window.open 需要 transient user activation,普通 .click() 不算手势会被拦 */
    const evG = async (expression) => (await cdp.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true, userGesture: true,
    }))?.result?.result?.value
    const clickTextG = async (text) => evG(`(() => {
      const l = [...document.querySelectorAll('button, span, div, li, a')]
        .filter(e => e.textContent.trim() === ${JSON.stringify(text)} && e.children.length === 0)
      if (!l.length) return ''
      l[l.length - 1].click(); return 'clicked:' + ${JSON.stringify(text)}
    })()`)
    const waitFor = async (expr, ms = 25000) => {
      for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) }
      return false
    }
    const navigate = async (url) => {
      await cdp.send('Page.navigate', { url })
      await waitFor(`document.readyState === 'complete'`, 30000)
      await sleep(1200)
    }
    const goto = async (route) => {
      await ev(`(location.hash = ${JSON.stringify('#' + route)}, 'ok')`)
      await waitFor(`document.readyState === 'complete'`, 15000)
      await sleep(2600)   // 面板配置 + 列表数据两跳请求
      await ev(`(() => { const s = document.querySelector('.wz-skip, .el-tour__close'); if (s) s.click(); return 1 })()`)
      await sleep(600)
    }
    const shot = async (name, opts = {}) => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true, ...opts })
      const f = path.join(OUT, name + '.png')
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    /** 点「最内层文案 === text」的元素(工具栏动作渲染成 span/div 文案,不是 button) */
    const clickText = async (text) => clickTextIn(null, text)
    /** 同上,但限定在 scopeSel 容器内(如查询弹窗 .el-dialog) */
    const clickTextIn = async (scopeSel, text) => ev(`(() => {
      const root = ${scopeSel ? `document.querySelector(${JSON.stringify(scopeSel)})` : 'document'}
      if (!root) return ''
      const l = [...root.querySelectorAll('button, span, div, li, a')]
        .filter(e => e.textContent.trim() === ${JSON.stringify(text)} && e.children.length === 0)
      if (!l.length) return ''
      l[l.length - 1].click(); return 'clicked:' + ${JSON.stringify(text)}
    })()`)
    const pressEnter = async () => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter' })
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter' })
    }
    /** 报告类「查询」弹窗:填 仓库(可搜索下拉)+ 存货(参照选择弹窗)后提交(位置法:该弹窗不用 el-form-item) */
    const fillReportDialog = async (whName, invKey) => {
      // ① 仓库:占位符文案「输入搜索」的 el-select(EP 的占位符在 .el-select__placeholder,不在 input)
      const s1 = await ev(`(() => {
        const s = [...document.querySelectorAll('.el-select')].find(e => e.offsetParent
          && ((e.querySelector('.el-select__placeholder') || {}).textContent || '').includes('输入搜索'))
        if (!s) return 0
        s.click(); return 1
      })()`)
      if (s1) {
        await sleep(500)
        await ev(`(() => { const i = [...document.querySelectorAll('.el-select input')].find(e => e.offsetParent); if (i) { i.focus(); i.click() } return 1 })()`)
        await cdp.send('Input.insertText', { text: whName })
        await sleep(1200)
        const picked = await ev(`(() => {
          const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter(e => e.offsetParent)
          if (!items.length) return ''
          items[0].click(); return items[0].textContent.trim()
        })()`)
        console.log('       仓库选择:', picked || '(下拉无候选项)')
        await sleep(500)
      } else console.log('       仓库: 没找到「输入搜索」下拉')
      // ② 存货:占位符「请选择」→ 打开「参照选择」弹窗 → 关键字过滤 → 查询 → 勾第一行 → 确定导入
      const opened = await ev(`(() => {
        const i = [...document.querySelectorAll('input')].find(e => e.offsetParent && e.placeholder === '请选择')
        if (!i) return 0
        i.focus(); i.click(); return 1
      })()`)
      if (opened) {
        await sleep(1800)
        await typeInto('input[placeholder="输入关键字过滤"]', 0, invKey)
        await sleep(500)
        await ev(`(() => {
          const d = [...document.querySelectorAll('.el-dialog, .el-overlay')].find(e => e.offsetParent && e.innerText.includes('参照选择'))
          const b = d && [...d.querySelectorAll('button')].find(x => x.textContent.trim() === '查询')
          if (!b) return 0
          b.click(); return 1
        })()`)
        await sleep(2200)
        const row = await ev(`(() => {
          const d = [...document.querySelectorAll('.el-dialog, .el-overlay')].find(e => e.offsetParent && e.innerText.includes('参照选择'))
          const c = d && d.querySelector('.el-table__body-wrapper .el-table__row .el-checkbox__inner')
          if (!c) return ''
          c.click()
          const tr = c.closest('.el-table__row')
          return tr ? tr.innerText.slice(0, 40).replace(/\\s+/g, ' ') : 'row'
        })()`)
        console.log('       存货参照行:', row || '(没有可勾选行)')
        await sleep(600)
        const confirmed = await ev(`(() => {
          const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && x.textContent.includes('确定导入'))
          if (!b) return 0
          b.click(); return 1
        })()`)
        console.log('       参照选择确认:', confirmed ? 'ok' : '没找到「确定导入」')
        await sleep(1200)
      } else console.log('       存货: 没找到「请选择」输入框')
      // ③ 提交:弹窗内的「查询」按钮
      const sub = await ev(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '查询' && x.closest('.el-overlay, .el-dialog, [class*=dialog], [class*=modal]'))
        if (!b) return 0
        b.click(); return 1
      })()`)
      await sleep(3500)
      return !!sub
    }
    /** 页面/弹窗内的日期区间(2 个 el-date-editor input = 起/止),用真实键入 + 回车提交 */
    const fillDateRange = async (start, end) => {
      const n = await ev(`document.querySelectorAll('.el-date-editor input').length`)
      if (!n || n < 2) return false
      await typeInto('.el-date-editor input', 0, start)
      await typeInto('.el-date-editor input', 1, end)
      await ev(`document.body.click()`)   // 关掉可能弹出的日历面板
      await sleep(600)
      return true
    }
    /** 真实键入(CDP Input.insertText,带 input 事件;先聚焦并点击目标输入框) */
    const typeInto = async (selector, index, text) => {
      const ok = await ev(`(() => { const l = [...document.querySelectorAll(${JSON.stringify(selector)})]; const e = l[${index}]; if (!e) return 0; e.focus(); e.click(); return 1 })()`)
      if (!ok) return false
      await sleep(350)
      await cdp.send('Input.insertText', { text })
      await sleep(400)
      await pressEnter()
      await sleep(500)
      return true
    }
    /** 按标签文案给表单里的输入框填值(查询弹窗的必填「仓库」「存货」等,填完回车选第一个匹配) */
    const fillByLabel = async (label, value) => {
      const ok = await ev(`(() => {
        const item = [...document.querySelectorAll('.el-form-item, .qc-item, .qf-item')]
          .find(e => (e.querySelector('label, .el-form-item__label')?.textContent || '').includes(${JSON.stringify(label)}))
        const inp = item?.querySelector('input')
        if (!inp) return 0
        inp.focus(); inp.click(); return 1
      })()`)
      if (!ok) return false
      await sleep(400)
      await cdp.send('Input.insertText', { text: value })
      await sleep(1200)   // 参照字段的候选查询
      await pressEnter()
      await sleep(600)
      return true
    }
    /** 打开二维码/标识卡打印窗口并截图(返回文件名或空串) */
    const capturePopup = async (name, actionText, needSelect) => {
      if (needSelect) {
        await ev(`(() => { const c = document.querySelector('.el-table__body-wrapper .el-table__row .el-checkbox__inner'); if (c) c.click(); return !!c })()`)
        await sleep(600)
      }
      const before = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).map((t) => t.targetId)
      const clicked = await clickTextG(actionText)
      if (!clicked) { console.log(`       ${actionText}: 页面上没有该动作`); return '' }
      // 打印窗口是 window.open('', '_blank') 出来的:Chromium 可能复用既有的 about:blank 目标,
      // 所以不看"新增目标",而是把所有非本应用页的目标都探一遍,谁有内容就截谁。
      await sleep(2200)
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      if (process.env.YJ_DEBUG_POPUP) {
        for (const t of list.filter((x) => x.type === 'page')) {
          try {
            const p = await attachCdp(PORT, t.targetId)
            await p.send('Page.enable')
            const i = await p.ev(`({ title: document.title, len: document.body ? document.body.innerText.length : -1, head: (document.body ? document.body.innerText : '').slice(0, 60).replace(/\\s+/g, ' ') })`)
            console.log(`       [目标] ${t.targetId === cdp.targetId ? '主' : '  '} ${JSON.stringify(i)} url=${String(t.url).slice(0, 60)}`)
            p.close()
          } catch { /* 跳过 */ }
        }
      }
      const cands = list.filter((t) => t.type === 'page' && t.targetId !== cdp.targetId)
      let target = null
      for (const t of cands) {
        try {
          const p = await attachCdp(PORT, t.targetId)
          await p.send('Page.enable')
          const info = await p.ev(`({ title: document.title, text: (document.body ? document.body.innerText : '').slice(0, 400) })`)
          // 卡面窗口:标题就是版式名(商品标识卡/材料二维码标签/库位标识卡…);应用页标题带 '· YINJIA-MES' 要排除
          const title = info?.title || ''
          const hit = /标识卡|标签/.test(title) && !/MES/.test(title)
          if (hit) { target = { t, p, info }; break }
          p.close()
        } catch { /* 目标不可挂:跳过 */ }
      }
      if (!target) { console.log(`       ${actionText}: 已点击,但没有弹出打印窗口(候选目标 ${cands.length} 个都不像卡面)`); return '' }
      console.log(`       卡面窗口标题: ${target.info.title}`)
      const pcdp = target.p
      await pcdp.send('Emulation.setDeviceMetricsOverride', { width: 520, height: 360, deviceScaleFactor: 3, mobile: false })
      await sleep(1500)
      const pr = await pcdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      const file = path.join(OUT, name + '.png')
      fs.writeFileSync(file, Buffer.from(pr.result.data, 'base64'))
      console.log(`       ${actionText} → ${name}.png`)
      pcdp.close()
      return name + '.png'
    }
    /** 页面健康度摘要(行数/报错/表头),写进 _summary.json 便于核对"真的有数据" */
    const inspect = async () => ev(`(() => {
      const errs = [...document.querySelectorAll('.el-message--error')].map(e => e.textContent.trim())
      const rows = document.querySelectorAll('.el-table__body-wrapper .el-table__row').length
      const btns = [...document.querySelectorAll('button, .px-toolbar span, .toolbar span')].map(b => b.textContent.trim()).filter(x => x && x.length < 12)
      const head = (document.querySelector('.el-table__header-wrapper') || document.body).innerText.slice(0, 160).replace(/\\s+/g, ' ')
      const grid = document.querySelector('.el-table__body-wrapper')
      return { rows, errs, btns: [...new Set(btns)].slice(0, 26), head, gridH: grid ? grid.scrollHeight : 0, url: location.hash }
    })()`)

    // ── ① 真实登录(UI 填表,不走接口绕登录) ──
    await navigate(`${BASE}/#/login`)
    await waitFor(`document.querySelectorAll('.login-form input').length >= 2`, 20000)
    await shot('00-登录页')
    await ev(`(() => {
      const ins = [...document.querySelectorAll('.login-form input')]
      const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; d.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      set(ins[0], ${JSON.stringify(ADMIN.userName)}); set(ins[1], ${JSON.stringify(ADMIN.password)}); return ins.length
    })()`)
    await ev(`(() => { const s = document.querySelector('.login-form .el-select'); if (!s) return 'no-select'; s.click(); return 'opened' })()`)
    await sleep(700)
    const picked = await ev(`(() => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')]
      const t = items.find(i => i.textContent.trim() === ${JSON.stringify(ADMIN.factory)})
        || items.find(i => i.textContent.includes(${JSON.stringify(ADMIN.factory)}))
      if (!t) return 'no-item:' + items.map(i => i.textContent.trim()).join('|')
      t.click(); return t.textContent.trim()
    })()`)
    console.log('[login] 登录工厂选择:', picked)
    await sleep(400)
    await shot('00b-登录页-已填账号与工厂')
    await ev(`(() => { const b = document.querySelector('.login-submit'); if (!b) return 'no-btn'; b.click(); return 'clicked' })()`)
    const ok = await waitFor(`location.hash.indexOf('/login') < 0`, 25000)
    console.log('[login] 进入系统:', ok ? 'OK' : 'FAIL(仍在登录页)')
    await sleep(2500)
    // 业务页截图拉到 2 倍像素密度(贴进文档后字清楚);登录页先前按 1 倍截,免得 3MB/张
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false })
    await sleep(800)

    // ── 调试模式:--dump=<路由> 打印该页工具栏 DOM(排查动作按钮在哪),打印完即退出 ──
    const dumpArg = process.argv.find((a) => a.startsWith('--dump='))
    if (dumpArg) {
      await goto(dumpArg.slice('--dump='.length))
      const dump = await ev(`(() => {
        const texts = [...document.querySelectorAll('button, li, span, div')]
          .filter(e => e.children.length === 0).map(e => e.textContent.trim()).filter(x => x && x.length < 12)
        return { texts: [...new Set(texts)].slice(0, 90) }
      })()`)
      console.log('候选文案:', JSON.stringify(dump.texts))
      const pg = await ev(`(() => { const p = document.querySelector('[class*=pag]'); return p ? p.className + ' :: ' + p.outerHTML.slice(0, 900) : '无分页元素' })()`)
      console.log('分页 DOM:', pg)
      const th = await ev(`(() => {
        const t = [...document.querySelectorAll('.el-table__header-wrapper th')].find(e => e.innerText.trim().startsWith('仓库'))
        return t ? t.outerHTML.slice(0, 900) : '无仓库表头'
      })()`)
      console.log('仓库表头 DOM:', th)
      // 顺手打开查询弹窗,列出弹窗里的输入框(排查条件怎么填)
      if (await clickText('查询')) {
        await sleep(1500)
        const dlg = await ev(`(() => {
          const d = document.querySelector('.el-dialog, .el-drawer')
          const modalRoots = [...document.querySelectorAll('[class*=dialog], [class*=modal], [class*=popup]')].map(e => e.className).slice(0, 12)
          return { modalRoots, dlgFound: !!d,
            inputs: [...document.querySelectorAll('input')].map((e, i) => ({ i, ph: e.placeholder, cls: String(e.className).slice(0, 34), item: (e.closest('.el-form-item') || e.parentElement).innerText.slice(0, 24).replace(/\\s+/g, ' ') })).slice(0, 14) }
        })()`)
        console.log('弹窗输入框:', JSON.stringify(dlg, null, 1))
      }
      return
    }

    // ── ② 逐页截图 ──
    const ONLY = process.env.YJ_ONLY || ''
    for (const [name, route, note] of PAGES.filter((p) => !ONLY || p[0].includes(ONLY))) {
      await goto(route)
      let info = await inspect()
      // 报表类页面数据是异步取的:先等最多 12s,别把"还在加载"当成"空表"
      for (let i = 0; i < 12 && !info.rows; i++) { await sleep(1000); info = await inspect() }
      if (!info.rows) {
        // (a) 页面自带条件区(工单列表:日期范围 + 查找)
        await fillDateRange('2026-01-01', '2026-12-31')
        if (await clickText('查找')) { console.log(`       ${name}: 补条件 → 已点「查找」`); await sleep(3000) }
        info = await inspect()
        // (b) 查询式报表:工具栏「查询」开弹窗,弹窗内补条件后再查询
        if (!info.rows && await clickText('查询')) {
          await sleep(1200)
          await fillDateRange('2026-01-01', '2026-12-31')
          await fillReportDialog(process.env.YJ_WH || '原料仓', process.env.YJ_INV || 'PP')
          info = await inspect()
        }
      }
      // 半成品仓库那页:库存状况表默认按仓库编码升序(CK04 半成品仓在中间)→ 点「仓库编码」排序变降序,
      // 再把表体滚到半成品仓那一段,截图里就能直接看到「半成品仓」行
      if (name.startsWith('09-')) {
        // ① 半成品仓在第 2 页(93 条 / 每页 50)→ 先翻页
        await ev(`(() => {
          const b = [...document.querySelectorAll('.page-btn')].find(e => (e.getAttribute('title') || '') === '下一页')
            || [...document.querySelectorAll('.page-btn')].slice(-2)[0]
          if (!b) return 0
          b.click(); return 1
        })()`)
        await sleep(1800)
        // ② 点「仓库编码」排序:升序 → 降序
        await ev(`(() => {
          const th = [...document.querySelectorAll('.el-table__header-wrapper th')].find(e => e.innerText.trim().startsWith('仓库编码'))
          const s = th && th.querySelector('.report-col-sorter')
          if (s) { s.click(); s.click(); return 1 }
          return 0
        })()`)
        await sleep(1500)
        // ③ 把表体滚到「半成品仓」那一段
        const seen = await ev(`(() => {
          const rows = [...document.querySelectorAll('.el-table__body-wrapper .el-table__row')]
          if (!rows.length) return '无行'
          const idx = rows.findIndex(r => (r.innerText || '').includes('半成品仓'))
          if (idx > 0) rows[idx].scrollIntoView({ block: 'start' })   // 交给浏览器处理嵌套滚动容器
          return '半成品仓在页内第 ' + idx + ' 行 → 可视仓库=' + rows.slice(Math.max(0, idx), Math.max(0, idx) + 22).map(r => (r.innerText || '').split('\\t')[1]).filter(Boolean).join('/')
        })()`)
        console.log('       ' + seen)
        await sleep(900)
      }
      const file = await shot(name)
      console.log(`[shot] ${name} → ${path.basename(file)} | 行=${info.rows} 报错=${JSON.stringify(info.errs)}`)
      console.log(`       表头: ${info.head}`)
      console.log(`       按钮: ${info.btns.join(' / ')}`)
      summary.push({ name, route, note, rows: info.rows, errs: info.errs, btns: info.btns, head: info.head, file: path.basename(file) })

      // 条码管理的直接证据:真实打开打印窗口,把「卡面」也截一张
      if (name.startsWith('08-')) {
        const f1 = await capturePopup('08d-材料仓库条码管理-采购入库单打印标识卡', '打印标识卡', false)
        if (f1) summary.push({ name: '08d-采购入库单打印标识卡', route, note: '材料标识卡卡面(含二维码)', rows: null, errs: [], btns: [], head: '', file: f1 })
      }
      if (name.startsWith('08b')) {
        const f2 = await capturePopup('08c-材料仓库条码管理-二维码标签卡面', '二维码标签', true)
        if (f2) summary.push({ name: '08c-商品二维码标签卡面', route, note: '商品二维码标签 75×100mm(含二维码)', rows: null, errs: [], btns: [], head: '', file: f2 })
      }
    }

    fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(summary, null, 2), 'utf8')
    console.log(`\n[done] ${summary.length} 页 → ${OUT}`)
  } finally {
    try { cdp?.close() } catch { /* ignore */ }
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
