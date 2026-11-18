// round-06:测试库上「新增」一张出货检验计划表草稿,看 6 列 + 底层合并格 + 频率下拉
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(5000)
// 先看这一页有哪些操作入口
console.log(JSON.stringify(await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('div,span,button,a,li')) {
    const t = (el.textContent || '').trim()
    if (!t || t.length > 8) continue
    if (['新增', '查询单据', '模糊搜索', '单据预览', '修改记录', '删除', '保存'].includes(t)) {
      out.push({ text: t, cls: el.className && el.className.toString().slice(0, 60), tag: el.tagName })
    }
  }
  return out.slice(0, 20)
}), null, 2))
// 点「新增」
const added = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span,button,a,li')].filter((e) => (e.textContent || '').trim() === '新增')
  const el = els[els.length - 1]
  if (!el) return false
  el.click()
  return true
})
console.log('clicked 新增:', added)
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(() => {
  const dt = document.querySelector('table.rs-dt')
  const ff = document.querySelector('.rsp-footer-field')
  const th = dt ? [...dt.querySelectorAll('th')].map((e) => (e.textContent || '').trim()) : null
  const freqCell = [...document.querySelectorAll('.rs-td')].find((td) => td.querySelector('.el-select'))
  return {
    hash: location.hash,
    docNo: (document.body.innerText.match(/单据编号[：:]\s*(\S+)/) || [])[1] || null,
    headers: th,
    hasFooterField: !!ff,
    footerEditable: !!(ff && ff.querySelector('textarea')),
    footerText: ff ? (ff.textContent || '').replace(/\s+/g, ' ').slice(0, 200) : null,
    freqSelectExists: !!freqCell,
    rows: dt ? dt.querySelectorAll('tbody tr').length : 0,
    saveBtn: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter((t) => ['保存', '新增', '审核', '提交'].includes(t)),
  }
}), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-06.png' })
