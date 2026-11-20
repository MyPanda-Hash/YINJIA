/**
 * workOrderBoardUnfinished.test.js —— 工单排产「未完成数量框 + 日期格点击编辑」护栏(2026-11-19)
 *
 * 【用户口径】
 *   ④ 「工单排产中点击修改排单各个日期数量的修改点击触发需要修改,当前只能点击到 / 才能修改」
 *   ⑤ 「增加一个未完成数量的查看实现。勾选车间查看当前勾选车间的未完成数量在右下方蓝色边框内;
 *       不勾选时右下方显示当前车间未完成量……当前存在的应该是在图中存在一个历史未完成量,
 *       需要修改为右下方的蓝色框内,当前只实现了单个车间当前查看的情况」
 *
 * 【钉住的不可回退点】
 *   A. 未完成数量框 = 右下角 .wb-unf(蓝框),车间复选框 + 合计;口径 = linesSummary.未交量 逐车间相加
 *      (与顶部「总未完成量」同一把尺,已在 ego 实测 30 条线合计 = /stats 29449)。
 *   B. 历史未完成的通栏红条(wb-short-bar)已并入蓝框;不能再长回页面顶部一条。
 *   C. 日期格:整个格可点(@click.stop)+ 点开自动聚焦(没有 autofocus prop 的坑),两页同改。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const board = read('frontend/src/views/modules/plan/WorkOrderBoard.vue')
const list = read('frontend/src/views/modules/plan/WorkOrderList.vue')

test('未完成数量框在右下角:勾左侧每条车间=合计,不勾=当前车间', () => {
  assert.match(board, /<div class="wb-unf"/, '必须有蓝框容器 .wb-unf')
  // 2026-11-20 用户口径:勾的是「对应车间」(左侧每条生产线),不是成型/切炭/组装这种类型
  const lineRow = board.slice(board.indexOf('v-for="l in g.lines"'), board.indexOf('v-for="l in g.lines"') + 900)
  assert.match(lineRow, /:model-value="pickedLines.includes\(l\.生产线\)"/, '左侧每条车间行上要有勾选框(绑定生产线)')
  assert.match(lineRow, /@change="\(v\) => toggleLine\(l\.生产线, v\)"/, '勾选要驱动 toggleLine(按生产线)')
  assert.doesNotMatch(board, /shopOptions/, '不能再按「车间类型」(成型/切炭/组装)出勾选框')
  assert.doesNotMatch(board, /toggleShop/, '旧的按类型勾选函数必须移除')
  assert.match(board, /const pickedLines = ref\(\[\]\)/, '勾选车间(生产线)状态必须独立保存')
  assert.match(board, /const currentLine = computed\(/, '不勾选时要取当前选中车间')
  assert.match(board, /sel\.line/, '当前车间 = 当前选中的生产线')
  assert.match(board, /const unfQty = computed\(/, '未完成数量必须由 computed 汇总')
  assert.match(board, /Number\(l\['未交量'\] \|\| 0\)/, '口径必须是 linesSummary.未交量(与顶部总未完成量同源)')
  assert.match(board, /unfLines\.value\.length/, '不勾选时退回当前车间(不能永远按全部合计)')
  assert.match(board, /unfLines\.value\.includes\(String\(l\['生产线'\]/, '合计必须按生产线(车间)逐条区分')
})

test('历史未完成量已并入右下角蓝框,顶部通栏红条不再存在', () => {
  assert.doesNotMatch(board, /wb-short-bar/, '旧通栏红条(wb-short-bar)必须移除')
  assert.match(board, /wb-unf-short/, '历史未完成算式要显示在蓝框里')
  assert.match(board, /shortInfo\.count/, '历史未完成仍按 shortInfo 口径显示(空则不出)')
})

test('日期数量格:整格可点 + 点开自动聚焦(两页同改)', () => {
  for (const [name, src] of [['工单排产', board], ['生产工单', list]]) {
    assert.match(src, /@click="startQtyEdit\(row, [\w.]+\)"/, `${name}:计划格整格可点`)
    assert.match(src, /class="dp-out dp-out-fill"[\s\S]{0,120}@click="startQtyEdit/, `${name}:斜杠格整格可点`)
    assert.match(src, /function focusQtyInput\(\)/, `${name}:必须手动聚焦编辑框`)
    assert.match(src, /document\.querySelector\('\.dp-input input'\)/, `${name}:聚焦兜底要以 DOM 里的编辑框为准`)
    assert.match(src, /async function startQtyEdit\(/, `${name}:startQtyEdit 要先渲染再聚焦(异步)`)
    assert.doesNotMatch(src, /class="dp-input" autofocus/, `${name}:el-input-number 没有 autofocus prop,不能靠它`)
    assert.match(src, /\.dp-plan \{ display: block; width: 100%/, `${name}:日期格撑满单元格(整格是点击热区)`)
  }
})

test('新 UI 文案有多语言(en)', () => {
  const en = read('frontend/src/i18n/locales/en.js')
  for (const phrase of ['未完成数量', '勾选左侧车间查看所选车间合计；不勾选显示当前车间',
    '勾选该车间（左侧生产线），右下角按勾选车间合计未完成数量',
    '导出 Excel（勾选行）', '导出 Excel（全部当前结果）', '请先勾选要导出的行']) {
    assert.ok(en.includes(`'${phrase}'`), `en.js 缺译名:${phrase}`)
  }
})

test('工序控制非必填迁移:脚本 + 迁移链 + 两账套自检', () => {
  const sql = read('tools/migrate-route-process-control-optional-20261119.sql')
  assert.match(sql, /SET required = 0/, '必须把 yj_field.required 置 0')
  assert.match(sql, /col_name = N'加工方式'/, '必须按物理列名收窄(不是按 label 拼 SET)')
  assert.match(sql, /label = N'工序控制'/, '必须同时限定显示名')
  assert.ok(read('tools/db-migrations.txt').includes('migrate-route-process-control-optional-20261119.sql'),
    '新脚本必须登记进迁移链 tools/db-migrations.txt')
})
