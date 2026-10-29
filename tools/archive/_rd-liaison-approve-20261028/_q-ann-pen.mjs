/**
 * _q-ann-pen.mjs —— 标注笔两段式交互**活体实测**(8090 + Edge 无头)
 *
 * 用户口径(2026-10-28):「现在改为是可以直接鼠标划选然后点击一下就弹出颜色盘选择颜色」
 *
 * 验的是**真实 DOM 事件序列**(不是读源码):
 *   ① 划选一段文字后 mouseup → **不应该**出现色盘（改前会立刻弹）
 *   ② 紧接着拖拽补发的 click → 也**不应该**弹盘（时间差判据要挡住）
 *   ③ 稍等后再点一下（独立 click）→ 才弹出色盘，且盘里 8 个色块
 *
 * 【登录方式】走**真实登录页表单**，不再注入 localStorage ——
 *   navigate 是整页重载，注入的 token 会被新文档上下文清掉，
 *   实测表现为随机被打回 /#/login（同一个脚本有时能进、有时不能）。
 *
 * 用法: node _q-ann-pen.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
}

/** 用登录页真实表单登录（不注入 token，避开整页重载清状态的坑） */
async function loginViaForm(s) {
  await s.navigate(BASE + '/#/login')
  await sleep(3000)
  const r = await s.evaluate(`(() => {
    // ⚠ 不能按"第 1 个 input"取:页面上还有 el-select 的语言/工厂下拉(也是 input)
    //   ⇒ 必须按 placeholder 精确命中(实测账号=请输入登录账号 / 密码=请输入登录密码)
    const byPh = (ph) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(ph))
    const acc = byPh('登录账号'), pwd = byPh('登录密码')
    if (!acc || !pwd) return { ok: false, phs: [...document.querySelectorAll('input')].map(i => i.placeholder) }
    const setV = (el, v) => {
      el.focus()
      const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')
      d && d.set ? d.set.call(el, v) : (el.value = v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    setV(acc, 'admin'); setV(pwd, '123456')
    return { ok: true, acc: acc.value, pwdLen: pwd.value.length }
  })()`)
  log('登录表单', r)
  if (!r.ok) return false
  await sleep(500)
  const clicked = await s.evaluate(`(() => {
    const b = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(x => /进入系统/.test(x.textContent || ''))
    if (!b) return false
    b.click(); return true
  })()`)
  log('点击进入系统', clicked)
  await sleep(5000)
  const ok = await s.evaluate(`(() => ({ hash: location.hash, hasSide: !!document.querySelector('.as-side-btn, .panelx-list') }))()`)
  log('登录后', ok)
  return !/#\/login/.test(ok.hash)
}

async function main() {
  let docNo = process.argv[3] || ''
  if (!docNo) {
    const lr = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
    })
    const token = (await lr.json())?.data?.token || ''
    const rows = (await (await fetch(BASE + '/api/px/queryFormDataList', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: 'RD_APPROVAL', pageNo: 1, pageSize: 50, condition: {} }),
    })).json())?.data?.list || []
    const hit = rows
      .filter((r) => ['已审核', '已归档'].includes(String(r['单据状态'] || '')))
      .find((r) => !String(r['客户名'] || '').startsWith('PROBE'))
    docNo = String(hit?.['单据编号'] || '')
  }
  log('目标单据', docNo || '(无)')
  if (!docNo) { console.log('SKIP: 没有已审批的立项单'); process.exit(2) }

  const s = await launch({ port: 9413 })
  try {
    const logged = await loginViaForm(s)
    log('登录成功', logged)
    if (!logged) { log('结论', 'SKIP 无法通过表单登录'); return }

    await s.evaluate(`location.hash = '#/panelx/list/RD_APPROVAL?docNo=${docNo}'; true`)
    await sleep(5000)

    // ⚠ 只有**纸面本来就只读**(已审核/已归档)时 penReady 才为真、才能直接划选。
    //   若该单仍可编辑,必须先点侧栏「标注笔」进模式(标注笔本来就是那个模式的开关)。
    const needPen = await s.evaluate(`(() => {
      const h = [...document.querySelectorAll('.ann-host')].find(x => (x.textContent||'').trim().length >= 4)
      if (!h) return 'no-host'
      return h.classList.contains('ann-pen') ? 'ready' : 'need-pen'
    })()`)
    log('纸面态', needPen)
    if (needPen === 'need-pen') {
      const clicked = await s.evaluate(`(() => {
        const b = [...document.querySelectorAll('.as-side-btn')].find(x => /标注笔/.test(x.textContent || ''))
        if (!b) return false
        b.click(); return true
      })()`)
      log('点「标注笔」', clicked)
      await sleep(1200)
      const now = await s.evaluate(`(() => {
        const h = [...document.querySelectorAll('.ann-host')].find(x => (x.textContent||'').trim().length >= 4)
        return h ? h.classList.contains('ann-pen') : null
      })()`)
      log('点后是否可划选(ann-pen)', now)
    }

    const probe = await s.evaluate(`(() => {
      const hosts = [...document.querySelectorAll('.ann-host')].filter(h => (h.textContent || '').trim().length >= 4)
      return {
        count: hosts.length,
        sample: hosts.slice(0, 3).map(h => h.textContent.trim().slice(0, 20)),
        sideHints: [...document.querySelectorAll('.as-side-hint')].map(x => (x.textContent || '').trim()),
        hasPenBtn: [...document.querySelectorAll('.as-side-btn')].some(b => /标注笔/.test(b.textContent || '')),
        penReady: hosts.length ? hosts[0].classList.contains('ann-pen') : false,
      }
    })()`)
    log('可标注格', probe)
    if (!probe.count) { log('结论', 'SKIP 纸面上没有 .ann-host'); return }

    // ① 划选 → mouseup：不应弹盘；armed 由 Vue 异步渲染，必须等一帧再读
    //   （实测：同步读 classList 拿到的是 false，nextTick 之后才是 true —— 不是功能坏了）
    const step1 = await s.evaluate(`(() => {
      const host = [...document.querySelectorAll('.ann-host')].find(h => (h.textContent || '').trim().length >= 4)
      const seg = host.querySelector('.ann-seg') || host
      const tn = seg.firstChild
      if (!tn || tn.nodeType !== 3) return Promise.resolve({ err: 'no text node' })
      const r = document.createRange()
      r.setStart(tn, 0); r.setEnd(tn, Math.min(2, tn.length))
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r)
      host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true, view: window, clientX: 300, clientY: 300 }))
      const paletteNow = !!document.querySelector('.ann-palette')
      return new Promise((res) => setTimeout(() => res({
        paletteAfterUp: paletteNow,
        armedClass: host.classList.contains('ann-armed'),
        selectedText: (sel.toString() || ''),
      }), 300))
    })()`)
    log('① 划选并 mouseup', step1)
    log('① 断言 = 抬手不弹盘', step1.paletteAfterUp === false ? 'PASS' : 'FAIL')
    log('① 断言 = 已记住范围(ann-armed)', step1.armedClass === true ? 'PASS' : 'FAIL')

    // ② 立刻补发的 click（同一次拖拽）→ 仍不应弹盘；同样等一帧读
    const step2 = await s.evaluate(`(() => {
      const host = document.querySelector('.ann-host.ann-armed')
      if (!host) return Promise.resolve({ err: 'not armed' })
      host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window, clientX: 300, clientY: 300 }))
      const p = !!document.querySelector('.ann-palette')
      return new Promise((res) => setTimeout(() => res({ paletteAfterInstantClick: p }), 300))
    })()`)
    log('② 拖拽补发的 click', step2)
    log('② 断言 = 补发的 click 不算"再点一下"', step2.paletteAfterInstantClick === false ? 'PASS' : 'FAIL')

    // ③ 用户"再点一下"。
    // ⚠ 合成 click **不会**让浏览器自动清选区（真实鼠标点击才会）⇒ 判据看不到变化。
    //   这里按真实点击的效果先清选区（点击 = 取消选择），再派发 click —— 等价于用户手点。
    await sleep(300)
    const step3 = await s.evaluate(`(() => {
      const host = document.querySelector('.ann-host.ann-armed')
      if (!host) return Promise.resolve({ err: 'not armed anymore' })
      // 模拟真实点击的行为:点击会取消当前选区
      window.getSelection().removeAllRanges()
      host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window, clientX: 320, clientY: 320 }))
      return new Promise((res) => setTimeout(() => {
        const pal = document.querySelector('.ann-palette')
        res({ paletteAfterRealClick: !!pal, swatches: pal ? pal.querySelectorAll('i').length : 0 })
      }, 400))
    })()`)
    log('③ 稍后再点一下', step3)
    log('③ 断言 = 这次才弹盘', step3.paletteAfterRealClick ? 'PASS' : 'FAIL')
    log('③ 断言 = 盘里 8 个色块', step3.swatches === 8 ? 'PASS' : `FAIL(${step3.swatches})`)
  } finally {
    const fs = await import('node:fs/promises')
    await fs.writeFile(new URL('./out-ann-pen.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
    console.log('\n[written] out-ann-pen.json')
    await s.close?.()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e.message); process.exit(1) })
