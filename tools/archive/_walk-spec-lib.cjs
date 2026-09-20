/**
 * _walk-spec-lib.cjs — 真浏览器里打开「检验项目及标准」标准库弹窗,读**实际渲染**的 18 个检验项目
 *
 * 为什么必须真浏览器:库内容来自 DB、次序由弹窗按 cfg.testLib 重排,两处都对才等于用户看到对。
 * 前面已分别验证了两处逻辑,这里做端到端确认(打开弹窗 → 读 DOM 文本)。
 *
 * 用法:node tools/archive/_walk-spec-lib.cjs
 */
'use strict'
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = 'RD_SPEC_DOC'

;(async () => {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data ? login.data.token : login.token
  const user = JSON.stringify(login.data ? login.data.user : {})

  const s = await launch({ port: 9430 })
  let bad = 0
  try {
    await s.navigate(BASE + '/#/login', 2500)
    await s.evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});'ok'`)
    await s.navigate('about:blank', 400)
    await s.navigate(`${BASE}/#/panelx/list/${PANEL}`, 1500)
    for (let i = 0; i < 40; i++) {
      const n = await s.evaluate(`document.querySelectorAll('.rsp-page-tab').length`)
      if (typeof n === 'number' && n > 0) break
      await sleep(600)
    }

    // 切到第 3 页(检验项目及标准)
    const tab = await s.evaluate(`(() => {
      const t = [...document.querySelectorAll('.rsp-page-tab')].find((e) => (e.textContent || '').includes('检验项目及标准'))
      if (!t) return 'NO_TAB'
      t.click(); return 'OK'
    })()`)
    console.log('切页签 =', tab)
    await sleep(1800)

    // 点开「检验项目标准库」按钮。
    // ⚠ 页面上有多个标准库入口:① 章节区每行右侧的「⌄ 标准库」= 章节库 spec.section;
    //    ② 检验项目数据表表头右侧的「⧉ 从标准库勾选」= 检验项目库 spec.test(本任务要看的)。
    //    先点错了①(弹窗标题显示"章节标准库 · 1.适用范围")⇒ 这里按标题关键字精确挑②。
    const opened = await s.evaluate(`(() => {
      const all = [...document.querySelectorAll('.rs-lib-btn, .rsp-lib-pick, [class*="lib-btn"]')]
      const txt = all.map((e) => (e.textContent || '').replace(/\\s+/g, '').trim())
      const el = all.find((e) => (e.textContent || '').includes('从标准库勾选'))
        || all.find((e) => (e.textContent || '').includes('勾选'))
      if (!el) return 'NO_BTN:' + JSON.stringify(txt.slice(0, 12))
      el.click(); return 'CLICKED:' + (el.textContent || '').replace(/\\s+/g, '').trim().slice(0, 20)
    })()`)
    console.log('打开检验项目标准库 =', opened)
    await sleep(2800)

    // 等表格真正出数据(接口 + 分组渲染需要时间;不等会读到 0 行 —— 踩过)
    let rowCount = 0
    for (let i = 0; i < 25; i++) {
      rowCount = await s.evaluate(`document.querySelectorAll('.el-dialog .el-table__row').length`)
      if (typeof rowCount === 'number' && rowCount > 0) break
      await sleep(500)
    }

    const info = await s.evaluate(`(() => {
      const dlgs = [...document.querySelectorAll('.el-dialog')]
      const dlg = dlgs.find((d) => (d.textContent || '').includes('检验项目标准库')) || dlgs[dlgs.length - 1]
      if (!dlg) return { error: 'NO_DIALOG' }
      // ⚠ 检验项目库不是 el-table,而是 checkbox 分组(ul.el-checkbox-group + li);
      //    用 el-table__row 取会得到 0 行(踩过)。这里按分组标签与条目文本取。
      const groups = [...dlg.querySelectorAll('.lib-group, [class*="lib-group"]')].map((g) => ({
        name: (g.querySelector('.lib-group-name, [class*="group-name"], b, strong') || {}).textContent || '',
        items: [...g.querySelectorAll('li, .el-checkbox')].map((li) => (li.textContent || '').replace(/\\s+/g, ' ').trim()),
      }))
      const labels = [...dlg.querySelectorAll('.el-checkbox__label')].map((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim())
      return {
        title: (dlg.querySelector('.el-dialog__title') || {}).textContent || '',
        groups,
        labels,
        text: (dlg.textContent || '').replace(/\\s+/g, ' ').trim(),
      }
    })()`)

    if (info.error) { console.log('✗', info.error); bad++ } else {
      console.log('弹窗标题 =', info.title)
      console.log('勾选项(checkbox label)数 =', (info.labels || []).length)
      console.log('')
      // 从弹窗文本里逐个核对设计序的 18 个检验项目
      const DESIGN = ['*外观', '*炭棒尺寸', '重量', '强度', '#*压降', '*黑水及颗粒物测试', '*一级颗粒物去除率',
        '隔夜浸泡口感/气味', 'VOC性能测试', '*除铅性能测试（PH8.5&6.5)', '*除汞性能测试（PH8.5&6.5)', '*Cyst去除测试',
        '*PFOA&PFOS去除性能测试', '*NSF401（三组）去除性能测试', '*毒杀芬去除性能', '*MTBE去除性能', '*余氯去除性能', '*卫生安全']
      const text = info.text || ''
      const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }
      console.log('=== 设计的 18 个检验项目是否都出现在弹窗里 ===')
      let missing = []
      DESIGN.forEach((g) => { if (!text.includes(g)) missing.push(g) })
      chk('18 个检验项目全部出现', missing.length === 0, '缺: ' + missing.join(', '))
      chk('已无旧库组名', !/黄水测试|COD性能测试|阻垢性能测试|过流杀菌性能测试|碱性性能测试/.test(text))
      chk('含设计里的炭棒尺寸三行(外径/内径/长度)',
        text.includes('外径：34.5±0.5mm') && text.includes('内径：12.5±0.5mm') && text.includes('长度：99±0.5mm'))
      // 次序:按出现位置递增
      const pos = DESIGN.map((g) => text.indexOf(g))
      const ordered = pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1]))
      chk('出现次序与设计序号一致', ordered, JSON.stringify(pos))
      console.log('')
      console.log('=== 弹窗文本(前 600 字)===')
      console.log('  ' + text.slice(0, 600))
    }
  } finally {
    s.close()
  }
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
