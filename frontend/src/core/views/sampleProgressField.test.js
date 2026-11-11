/**
 * sampleProgressField.test.js — 样品单「进度描述」字段(用户口径 2026-11-11)
 *
 * 【用户原话】
 *   · 外部单：「需要添加一项样品状态描述（负责人进行文字描述进度）… 列标题加一项进度描述，
 *     样品负责人可修改实时状态描述」；
 *   · 内部单第 5 条：「那个只是像图片的一样加一个进度描述的字段列，由提交人实时去更新状态，
 *     **这个字段不受归档约束**，但是也是**只能谁提交的谁来修改**」。
 *   · 追问「归档后连 edit_others 也不能改？」→ 答「**只锁申请人**」。
 *
 * 【落点选择】
 *   · 外部单 = 头表 `rd_sample_ext_head.进度描述`（一张外部单 = 一个样品，与它"一单一样品"的模型一致）；
 *   · 内部单 = 明细 `rd_sample_int_detail.进度描述`（内部单"一单多行、行各归其主"，进度是**行**的属性）。
 *
 * 【"不受归档约束"的准确含义】归档锁的是**业务字段**；进度描述是过程跟踪信息，
 *   归档后申请人仍可更新它。故它在后端要走一条**独立于 saveDoc 的窄接口**，
 *   不经过 draftEditable / archived 的常规闸门，只校验「是不是这一行的申请人」。
 *
 * 单测跑不了运行时，按仓库既有做法读源码 + 迁移脚本双钉住。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')

const mig = read('../tools/migrate-sample-progress-desc-20261111.sql')
const manifest = read('../tools/db-migrations.txt')
const btn = read('../backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
const px = read('../backend/src/main/java/com/yinjia/mes/controller/PxController.java')

test('① 迁移脚本给两张样品表都加「进度描述」列(外部头表 / 内部明细)', () => {
  assert.match(mig, /rd_sample_ext_head/, '外部单头表没在迁移里')
  assert.match(mig, /rd_sample_int_detail/, '内部单明细表没在迁移里')
  // 两处都要真加列:ALTER TABLE ... ADD [进度描述]
  const adds = [...mig.matchAll(/ALTER TABLE\s+(\w+)\s+ADD\s+\[?进度描述\]?/g)].map((m) => m[1])
  assert.ok(adds.includes('rd_sample_ext_head'), '外部单头表没有 ADD [进度描述]')
  assert.ok(adds.includes('rd_sample_int_detail'), '内部单明细表没有 ADD [进度描述]')
})

test('② 迁移是幂等的(先判列存在,重复跑不报错)', () => {
  assert.match(mig, /IF\s+COLUMNS\.|IF\s+NOT\s+EXISTS|COL_LENGTH|sys\.columns/i,
    '迁移缺少列存在性判定 ⇒ 第二次跑会报"列名重复"')
  // 项目规范:新增列必须带中文注明
  assert.match(mig, /MS_Description/, '新增列没有写 MS_Description 中文注明(项目硬规范)')
})

test('③ 迁移已登记进 db-migrations.txt(否则部署不会执行)', () => {
  assert.ok(manifest.includes('migrate-sample-progress-desc-20261111.sql'),
    'tools/db-migrations.txt 未登记进度描述迁移')
})

test('④ 进度描述走独立窄接口,不受归档锁(不许塞进 saveDoc 常规保存)', () => {
  // 必须有一个专门的端点
  assert.match(px, /sampleProgress|进度描述/,
    'PxController 没有进度描述的专用端点')
  // 后端要有一条只更新这一列、且不判 archived 的写路径
  const at = btn.search(/updateSampleProgress|saveSampleProgress/)
  assert.ok(at > 0, 'ButtonService 没有进度描述的专用写方法')
  const body = btn.slice(at, at + 2500)
  assert.match(body, /进度描述/, '专用方法里没写 进度描述 列')
  // ⚠ 关键:这条路径不能拿 archived/modify_state 当闸门(用户要"不受归档约束")
  assert.ok(!/archived\s*=\s*'Y'.*不能|!.*archived.*throw/i.test(body),
    '进度描述写路径不该被归档状态拦住（用户口径"不受归档约束"）')
})

test('⑤ 只有"这一行的申请人"能改进度(归档后也一样,且 edit_others 不例外)', () => {
  const at = btn.search(/updateSampleProgress|saveSampleProgress/)
  assert.ok(at > 0, '找不到专用写方法')
  const body = btn.slice(at, at + 2500)
  // 归属判定:内部单看行上的申请人,外部单看头表 asp_user1
  assert.match(body, /申请人|asp_user1/, '没有做归属判定（谁能改这张/这行的进度）')
  assert.match(body, /realNameOf|currentUserName/, '没有取当前登录人比对')
})
