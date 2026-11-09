/**
 * mobileLabRecordDeleteRow.test.js — 手机端「删除行」必须先弹确认(2026-11-09)
 *
 * 用户口径:「还有点击删除行的时候要有弹窗,防止误触」。
 *
 * 这是**源码契约**测试(node --test,不起浏览器):删行的实现只有一处 removeRow,
 * 它必须 ① 仍是 async,② 在 splice 之前 await 了 ElMessageBox.confirm,
 * ③ 取消(抛异常)时直接 return 不动数据,④ 弹窗文案带行摘要(现场能看出点错行没有)。
 * 谁把确认框删了/挪到 splice 之后,这条会立刻红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// ⚠ 页面用 CRLF(Windows),先归一成 LF 再按换行切函数体,否则找不到函数结尾
const page = fs.readFileSync(path.join(here, 'MobileLabRecord.vue'), 'utf8').replace(/\r\n/g, '\n')

/** 取出 removeRow 整个函数体(从 `async function removeRow` 到下一个顶层 `}` 之后的空行前) */
function bodyOf(fnName) {
  const start = page.indexOf(`async function ${fnName}(`)
  assert.ok(start > 0, `页面里找不到 async function ${fnName}(`)
  const end = page.indexOf('\n}\n', start)
  assert.ok(end > start, `找不到 ${fnName} 的函数结尾`)
  return page.slice(start, end + 2)
}

test('删除行:removeRow 是 async 且在 splice 之前 await 了确认框', () => {
  const body = bodyOf('removeRow')
  const confirmAt = body.indexOf('ElMessageBox.confirm')
  const spliceAt = body.indexOf('detailRows.value.splice(')
  assert.ok(confirmAt > 0, 'removeRow 里必须有 ElMessageBox.confirm(防误触)')
  assert.ok(body.includes('await ElMessageBox.confirm'), '确认框必须 await,否则弹窗形同虚设')
  assert.ok(spliceAt > confirmAt, '必须先确认再删行(splice 在 confirm 之后)')
})

test('删除行:取消(confirm 抛异常)时直接 return,不删任何东西', () => {
  const body = bodyOf('removeRow')
  const cancelAt = body.indexOf('catch (e) {')
  assert.ok(cancelAt > 0, '必须有 try/catch 接住"取消"')
  const afterCatch = body.slice(cancelAt, body.indexOf('detailRows.value.splice('))
  assert.match(afterCatch, /return/, '取消分支必须 return(不能往下走删行)')
})

test('删除行:弹窗文案带行号/行摘要,并把"保存后才从电脑端消失"讲清楚', () => {
  const body = bodyOf('removeRow')
  assert.ok(body.includes('rowSummary('), '文案要带这一行填了什么,现场才看得出是不是点错行')
  assert.ok(body.includes("tt('第')"), '要带行号')
  assert.ok(body.includes('删掉的行保存后才会从电脑端消失'), '要说清是草稿里的删除、保存后才同步到电脑端')
})

test('删除行:仍然只有草稿能删(非草稿先给出提示并 return)', () => {
  const body = bodyOf('removeRow')
  const gateAt = body.indexOf('只有草稿才能删除行')
  assert.ok(gateAt > 0, '必须保留草稿守卫')
  assert.ok(gateAt < body.indexOf('ElMessageBox.confirm'), '草稿守卫在确认框之前(不该对非草稿弹确认)')
})
