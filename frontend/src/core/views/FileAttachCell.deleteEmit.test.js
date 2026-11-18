/**
 * FileAttachCell.deleteEmit.test.js —— 附件删除后纸面还留着旧文件名的回归钉子(2026-11-18)
 *
 * 用户报障(截图红框圈住「伟星MES业务流程V1.2.pdf」):
 *   「上传附件删除后会显示这些文字,刷新后才会消失」
 *
 * 根因:文件删掉后 `files` 空了,但父级 `modelValue`(头列 `附件` 的文本)还留着旧文件名串,
 *   模板的 `!files.length && legacyText` 分支把它当"历史附件名"继续渲染 ⇒ 刷新重读单据才消失。
 *
 * 修法:删除后**显式**把新的文件名串回抛父级(删空就回空串);`load()` 仍保持"有文件才回抛"
 *   —— 否则"只有历史文本、没有 yj_attachment 行"的老单会在打开时被清空。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const VUE = readFileSync(new URL('./FileAttachCell.vue', import.meta.url), 'utf8')

test('删除附件后必须回抛头列文本(删空回空串),否则旧文件名会一直挂在纸面上', () => {
  const fn = VUE.match(/async function removeFile\([\s\S]*?\n\}/)
  assert.ok(fn, '缺少 removeFile 实现')
  assert.match(fn[0], /await request\.post\('\/attachment\/delete', \{ id: a\.id \}\)/, '删除必须先打服务端')
  assert.match(fn[0], /emit\('update:modelValue', files\.value\.map\(\(f\) => f\.fileName\)\.join\('、'\)\)/,
    '删除后必须把新文件名串(空则空串)回抛父级,不能只在 load 里有文件时才回抛')
  // 不能"重新 load 一次带 emit 就行":load 的 emit 有 files.length 守卫,删最后一个文件时不成立
  assert.doesNotMatch(fn[0], /else await load\(true\)/, '删除路径不能只靠 load(true)(空列表不会回抛)')
})

test('load() 保持「有文件才回抛」:历史纯文本附件不能被打开即清空', () => {
  const load = VUE.match(/async function load\(emitNames\)[\s\S]*?\n\}/)
  assert.ok(load, '缺少 load 实现')
  assert.match(load[0], /if \(emitNames && files\.value\.length\)/, 'load 的回抛必须仍带 files.length 守卫')
})
