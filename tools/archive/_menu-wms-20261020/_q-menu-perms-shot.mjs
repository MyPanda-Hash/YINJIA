/**
 * _q-menu-perms-shot.mjs — 导航改版 + 角色面板权限矩阵 活体取证(2026-10-20)
 *
 * 用户口径:「给组织架构的角色面板权限更新一下,现在少了几个面板;库存管理名字改为WMS管理系统;
 *   把生产制造的生产计划和生产过程提成一级目录,生产制造这个一级目录不要了;把设备维护挪到系统管理平台」。
 *
 * 做四件事:① 侧栏一级目录列表(应为 WMS管理系统/生产计划/生产过程,不再有 生产制造);
 *   ② 展开「系统管理平台」看「设备维护」在不在;③ 打开 /sys/org 选角色 → 截权限矩阵分组;
 *   ④ 抓矩阵里 4 个新面板(数采三页 + 扫码领料)是否存在。
 * 用法:node tools/archive/_menu-wms-20261020/_q-menu-perms-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9491
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-menu2-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('   截图', name)
}
try {
  fs.mkdirSync(OUT, { recursive: true })
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await ev(`(() => { const ins=[...document.querySelectorAll('.login-form input')]
    const set=(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
    set(ins[0],'admin'); set(ins[1],'123456'); return 1 })()`)
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); (s.querySelector('.el-select__wrapper')||s).click(); return 1 })()`)
  await sleep(1000)
  await ev(`(() => { const it=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent)
    const t=it.find(i=>i.textContent.indexOf('YINJIA-MES')>=0 && i.textContent.indexOf('测试')>=0); if(t) t.click(); return 1 })()`)
  await sleep(400)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
  await waitFor(`location.hash.indexOf('/login') < 0`)
  await sleep(1500)

  // ① 侧栏一级目录
  const groups = await ev(`(() => [...document.querySelectorAll('.nav-group')].map(e=>e.innerText.replace(/\\s+/g,'').trim()).filter(Boolean))()`)
  console.log('[侧栏一级目录]', groups)
  await shot('sidebar-top-1440.png')

  // ② 展开「系统管理平台」看设备维护
  await ev(`(() => { const g=[...document.querySelectorAll('.nav-group')].find(e=>/系统管理平台/.test(e.innerText)); if(g) g.click(); return 1 })()`)
  await sleep(800)
  const mods = await ev(`(() => [...document.querySelectorAll('.nav-module')].map(e=>e.innerText.replace(/\\s+/g,'').trim()).filter(Boolean))()`)
  console.log('[系统管理平台 二级]', mods)
  await shot('sidebar-sys-1440.png')

  // ③ 组织架构 → 角色与面板权限(非超级角色才铺开矩阵;admin 行是超级权限,不渲染矩阵)
  await ev(`(location.hash='#/sys/org','ok')`)
  await sleep(2500)
  // ⚠ 页面有四张表(部门/用户/角色/…):角色表在 .org-col.roles 里,选择器必须限定,
  //   否则会点到左侧「用户」表的第一行(admin)而矩阵根本不渲染(admin=超级权限)。
  const picked = await ev(`(() => { const rows=[...document.querySelectorAll('.org-col.roles .el-table__body tr')]
    const r = rows.find((x) => x.innerText.indexOf('超级') < 0 && x.innerText.trim())
    if (!r) return 'no-row:' + rows.length; r.click(); return r.innerText.replace(/\\s+/g,' ').slice(0,60) })()`)
  console.log('[选中角色]', picked)
  await sleep(2800)
  const permGroups = await ev(`(() => [...document.querySelectorAll('.perm-head, .perm-row-head, .el-collapse-item__header')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,20))()`)
  console.log('[权限矩阵分组]', permGroups)
  // 分组默认折叠 ⇒ 先展开「数采平台」「WMS管理系统」,再确认 4 个新面板都在矩阵里
  await ev(`(() => { const hs=[...document.querySelectorAll('.perm-head, .el-collapse-item__header')]
    for (const h of hs) if (/数采平台|WMS管理系统/.test(h.innerText)) h.click(); return 1 })()`)
  await sleep(1500)
  // 矩阵里 4 个新面板(数采三页 + 扫码领料)必须在
  const has = await ev(`(() => ['设备配置管理','数据监控','状态统计','扫码领料'].map((n) => (document.body.innerText.indexOf(n) >= 0 ? n + '✓' : n + '✗')).join(' '))()`)
  console.log('[矩阵内新面板]', has)
  await shot('org-perm-matrix-1440.png')
} finally {
  cdp.close?.()
  edge.kill()
}
