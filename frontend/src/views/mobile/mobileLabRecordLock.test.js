/**
 * mobileLabRecordLock.test.js — 手机端两道状态闸门(2026-11-09 第六轮)
 *
 * 用户口径:「还有手机点击保存草稿的单据,就不能修改设备名称。还有审批通过后的单据连新增修改都不可以。」
 *
 * 源码契约(不起浏览器):
 *   ① 整单只读 = canEditDoc(单据状态) 取反(审批通过后只读);
 *   ② 表头"标识字段"(设备名称/仪器名称/测试项目)在**单据已保存**后只读, 由 lockedHeaderKeys 决定;
 *   ③ 所有"写"的入口(保存/加行/传附件/删附件)在逻辑层也要挡 readOnly —— 光靠按钮 disabled 不够
 *      (手机上长按/脚本/回车都能绕过 UI)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const page = fs.readFileSync(path.join(here, 'MobileLabRecord.vue'), 'utf8').replace(/\r\n/g, '\n')

function bodyOf(fnName) {
  const start = page.search(new RegExp(`(async function|function) ${fnName}\\(`))
  assert.ok(start > 0, `页面里找不到 ${fnName}(`)
  const end = page.indexOf('\n}\n', start)
  assert.ok(end > start, `找不到 ${fnName} 的函数结尾`)
  return page.slice(start, end + 2)
}

test('整单只读:readOnly 由 canEditDoc(单据状态) 取反,并给一句提示', () => {
  assert.match(page, /const readOnly = computed\(\(\) => !canEditDoc\(docStatus\.value\)\)/,
    '只读判定必须走 canEditDoc(单一真源,别在这里另写状态表)')
  assert.match(page, /readOnlyHint = computed\(/, '要有一句"只能查看"的提示')
  assert.match(page, /class="labm-lock"/, '页面上要能看见只读提示条')
})

test('标识字段:已保存的单据锁住设备名称/仪器/测试项目(lockedHeaderKeys + titleField)', () => {
  assert.match(page, /const lockedHeaders = computed\(\(\) => lockedHeaderKeys\(headerFields\.value, \{/,
    '锁哪些字段交给 lockedHeaderKeys 纯函数')
  assert.match(page, /titleField: panel\?\.titleField \|\| ''/, '要带上面板的 titleField(设备名称/仪器名称-型号/测试项目)')
  assert.match(page, /const headerEditable = \(f\) => !readOnly\.value && !lockedHeaders\.value\.includes\(/,
    '字段可编辑 = 整单不是只读 且 不在锁定名单里')
})

test('写入口在逻辑层也挡 readOnly(保存/加行/传附件/删附件)', () => {
  for (const fn of ['save', 'addRow', 'addRowFiles', 'removeRowPhoto']) {
    const body = bodyOf(fn)
    assert.match(body, /if \(readOnly\.value\)/, `${fn} 里必须先判断 readOnly 并直接返回`)
    assert.match(body, /这张单已审批通过,只能查看/, `${fn} 被挡时给一句人话提示`)
  }
})

test('按钮态:加一行/拍照/删附件/保存都跟着 readOnly 走', () => {
  const addBtn = page.slice(page.indexOf('@click="addRow"') - 200, page.indexOf('@click="addRow"'))
  assert.match(addBtn, /:disabled="readOnly"/, '「加一行」审批通过后要禁用')
  const saveBtn = page.slice(page.indexOf('@click="save()"') - 260, page.indexOf('@click="save()"'))
  assert.match(saveBtn, /:disabled="!panel \|\| readOnly"/, '「保存草稿」审批通过后要禁用')
  const photoBtn = page.slice(page.indexOf('@click.stop="pickRowPhoto'), page.indexOf('@click.stop="pickRowPhoto') + 40)
  assert.ok(photoBtn.length > 0)
  assert.match(page, /pickRowPhoto\(idx\)[\s\S]{0,40}>/, '拍照按钮要保持可点到逻辑层的守卫')
  assert.match(page, /'is-off': readOnly/, '附件删除在只读时给个置灰态')
})
