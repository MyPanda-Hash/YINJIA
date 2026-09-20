/**
 * _walk-sidebar-save.cjs — 真浏览器核对:侧边栏「保存」组是否出现「保存为草稿」子项
 *
 * 用法:node tools/archive/_walk-sidebar-save.cjs [面板码...]
 */
'use strict'
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANELS = process.argv.slice(2).length ? process.argv.slice(2) : ['RD_SPEC_DOC', 'RD_SOAK', 'RD_MINOR']

;(async () => {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data ? login.data.token : login.token
  const user = JSON.stringify(login.data ? login.data.user : {})

  const s = await launch({ port: 9440 })
  let bad = 0
  try {
    for (const p of PANELS) {
      await s.navigate(BASE + '/#/login', 2200)
      await s.evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});'ok'`)
      await s.navigate('about:blank', 400)
      await s.navigate(`${BASE}/#/panelx/list/${p}`, 1500)
      // 等侧边栏出现
      let ready = false
      for (let i = 0; i < 30; i++) {
        const n = await s.evaluate(`document.querySelectorAll('.as-side-btn').length`)
        if (typeof n === 'number' && n > 0) { ready = true; break }
        await sleep(600)
      }
      const info = await s.evaluate(`(() => {
        const btns = [...document.querySelectorAll('.as-side-btn')]
        return {
          all: btns.map((b) => (b.textContent || '').replace(/\\s+/g, '').trim()),
          draft: btns.filter((b) => (b.textContent || '').includes('保存为草稿')).length,
          hasCaretOrSub: btns.filter((b) => b.classList.contains('sub')).length,
        }
      })()`)
      const okDraft = info.draft > 0
      if (!okDraft) bad++
      console.log(`${ready ? '' : '⚠未就绪 '}${okDraft ? '✓' : '✗'} ${p.padEnd(16)} 侧边栏按钮=${info.all.length} sub项=${info.hasCaretOrSub} 草稿按钮=${info.draft}`)
      console.log('      按钮: ' + info.all.join(' / '))
    }
  } finally {
    s.close()
  }
  console.log('')
  console.log(bad ? `✗ ${bad} 个面板未见「保存为草稿」` : '✓ 侧边栏已出现「保存为草稿」')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
