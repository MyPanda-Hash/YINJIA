#!/usr/bin/env node
/** 英文环境复检:开弹窗后**不刷新**直接切 locale store,看日期框标签/占位词是否英文 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 9465
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-en-'))
spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT); const ev = cdp.ev
const fails = []
const log = (ok, m) => { console.log((ok?'   [PASS] ':'   [FAIL] ')+m); if(!ok) fails.push(m) }
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const waitFor = async (e, ms=30000) => { for (let i=0;i<ms/250;i++){ if(await ev(e)) return true; await sleep(250) } return false }
const shot = async (n) => { const r = await cdp.send('Page.captureScreenshot', { format:'png', captureBeyondViewport:true, fromSurface:true })
  const f = path.join(__dirname,'shots',n+'.png'); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f, Buffer.from(r.result.data,'base64')); console.log('   截图', path.relative(process.cwd(), f)) }
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false })
// 先以英文登录
await cdp.send('Page.navigate', { url: 'http://127.0.0.1:8090/#/login' })
await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
await ev(`(()=>{try{localStorage.setItem('mes_locale','en')}catch(e){};return 1})()`)
await cdp.send('Page.reload'); await waitFor(`document.querySelectorAll('.login-form input').length >= 2`); await sleep(1500)
await ev(`(()=>{const i=[...document.querySelectorAll('.login-form input')];const set=(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))};set(i[0],'admin');set(i[1],'123456');return 1})()`)
await ev(`(()=>{const s=document.querySelector('.login-form .el-select');if(s)s.click();return 1})()`); await sleep(700)
await ev(`(()=>{const t=[...document.querySelectorAll('.el-select-dropdown__item')].find(e=>e.textContent.includes('YINJIA-MES'));if(t)t.click();return 1})()`); await sleep(400)
await ev(`(()=>{const b=document.querySelector('.login-submit');if(b)b.click();return 1})()`)
if (!await waitFor(`location.hash.indexOf('/login') < 0`, 30000)) throw new Error('登录失败')
await ev(`(location.hash='#/panelx/list/PU_ORDER','ok')`)
await waitFor(`document.querySelectorAll('.el-table__row').length > 0`, 45000); await sleep(2500)
// 打开弹窗(工具栏是 .tb-group 自绘;下拉项在 .tb-menu)
await ev(`(() => { const c=[...document.querySelectorAll('.tb-group')].find(g=>g.querySelector('.tb-main'));
  const g=[...document.querySelectorAll('.tb-group')].find(x=>/print/i.test(x.querySelector('.tb-main')?.textContent||'') );
  if(g) { const caret=g.querySelector('.tb-caret'); if(caret) caret.click() } return !!g })()`)
await sleep(700)
const ok = await ev(`(() => { const t=[...document.querySelectorAll('.tb-menu *')].filter(e=>e.children.length===0 && /material qr|打印材料码/i.test(e.textContent))[0]
  if(!t) return false; t.click(); return true })()`)
const alt = ok ? true : await ev(`(() => { const t=[...document.querySelectorAll('.tb-menu *')].filter(e=>e.children.length===0)[0]; return false })()`)
if (!await waitFor(`document.querySelector('.mlq') !== null`, 20000)) throw new Error('弹窗没出来')
await sleep(1500)
const en = await ev(`(() => {
  const d=document.querySelector('.mlq-prod-inp'); const chip=d&&d.closest('.mlq-chip')
  return { label: chip?chip.textContent.replace(/\\s+/g,' ').trim().slice(0,40):'',
           placeholder: d?(d.querySelector('input')?.placeholder||''):'',
           recHead: [...document.querySelectorAll('.mlq-records th')].map(t=>t.textContent.trim()),
           batchLabel: (document.querySelector('.mlq-batch .mlq-batch-inp')?.closest('.mlq-chip')?.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40) }
})()`, true)
console.log('   英文弹窗:', JSON.stringify(en))
log(en.placeholder === 'Select date', '日期框占位词 = Select date(实际: '+en.placeholder+')')
log(/Production Date/i.test(en.label) && !/生产日期/.test(en.label), '日期框标签 = Production Date(实际: '+en.label+')')
log(Array.isArray(en.recHead) && en.recHead.includes('Production Date'), '记录表头含 Production Date(实际: '+JSON.stringify(en.recHead)+')')
log(!/批次号/.test(en.batchLabel), '批次号标签已英文化(实际: '+en.batchLabel+')')
await shot('03-dialog-en')
console.log('')
console.log(fails.length ? 'RESULT: FAIL-'+fails.length : 'RESULT: PASS')
await cdp.close()
try { fs.rmSync(profile,{recursive:true,force:true}) } catch {}
process.exit(fails.length?1:0)
