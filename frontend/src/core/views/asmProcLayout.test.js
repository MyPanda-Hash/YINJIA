/**
 * 组装工艺管控清单（RD_ASM_PROC）版式与签核（2026-11-17 用户口径，1117问题 #6）。
 *
 * 用户原话：「6.组装工艺管控清单 | 修订记录放最右边 | 表单管理人：柴善银 /
 *   增加一个审核人：产品负责人审核后自动填充」。
 *
 * 三件事：
 *   ① 页签顺序 修订记录 → 最后；② 表单管理人默认 柴善银；
 *   ③ 新增「审核人」格（只读，审批通过时由服务端回填）。
 * ⚠ 页序一动，sections/dataTables 的 `page:` 必须同步重编（漏改=整页空白/区块跑页）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = recordSheetConfigs.RD_ASM_PROC
const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const defaults = readFileSync(new URL('../panel/docDefaults.js', import.meta.url), 'utf8')
const mig = readFileSync(
  new URL('../../../../tools/migrate-asm-proc-auditor-20261117.sql', import.meta.url), 'utf8')

test('① 修订记录在最后一个页签', () => {
  const titles = cfg.pages.map((p) => p.title)
  assert.deepEqual(titles, ['组装BOM表', '组装工艺清单', '修订记录'], '页签顺序')
  assert.equal(titles[titles.length - 1], '修订记录', '修订记录必须最右')
})

test('① 页序重排后 page 引用必须全部对齐（漏改=整页空白）', () => {
  const n = cfg.pages.length
  for (const s of cfg.sections || []) {
    assert.ok(Number.isInteger(s.page) && s.page >= 0 && s.page < n, `section.page 越界：${s.page}`)
  }
  for (const d of cfg.dataTables || []) {
    assert.ok(Number.isInteger(d.page) && d.page >= 0 && d.page < n, `dataTable.page 越界：${d.page}（${d.bar || d.pageTitle}）`)
  }
  // 三张表各归其页：修订记录=2 / BOM=0 / 关键控制清单=1
  const rev = cfg.dataTables.find((d) => d.pageTitle === '修订记录')
  assert.equal(rev.page, 2, '修订记录页 = 2')
  const bom = cfg.dataTables.find((d) => d.bar === 'BOM表')
  assert.equal(bom.page, 0, 'BOM 页 = 0')
  const ctrl = cfg.dataTables.find((d) => d.bar === '关键控制清单')
  assert.equal(ctrl.page, 1, '工艺清单页 = 1')
})

test('② 表单管理人默认柴善银', () => {
  const at = defaults.indexOf('RD_ASM_PROC: [')
  assert.ok(at > 0, '缺 RD_ASM_PROC 默认值')
  const seg = defaults.slice(at, defaults.indexOf('\n  ],', at)) // 整个默认值数组（不能用 '],'，会切在第一条的右括号上）
  assert.match(seg, /\['表单管理人', '柴善银'\]/, '表单管理人应为固定「柴善银」')
  assert.doesNotMatch(seg, /ctx\.userName/, '不再用当前登录人动态带入')
})

test('③ 审核人：纸面有这一格（只读）、库里有列、审批通过时回填', () => {
  const info = cfg.info.map((f) => f.label)
  assert.ok(info.includes('审核人'), '纸面信息栏缺「审核人」')
  const f = cfg.info.find((x) => x.label === '审核人')
  assert.equal(f.readonly, true, '审核人必须只读（审核后自动填充，不能手填）')
  // 迁移：登记 审核人 → 备用3，editable=0，并补 en 译名
  assert.match(mig, /N'备用3', N'审核人'/, '落库列应为 备用3')
  assert.match(mig, /N'header', 93, 110, 0, 0, 0, 1/, 'seq 93 / editable=0')
  assert.match(mig, /yj_translation[\s\S]*N'审核人'[\s\S]*N'Reviewer'/, '缺 en 译名（AGENTS 强制）')
  // 后端回填：必须走 byLabel 取物理列（不能拼 label）
  assert.match(btn, /private void writeFieldByLabel\(/, '缺 writeFieldByLabel')
  assert.match(btn, /if \("RD_ASM_PROC"\.equals\(def\.code\(\)\)\) writeFieldByLabel\(def, no, "审核人"/, '审批通过未回填审核人')
})

test('④ 表单管理人固定柴善银：前端默认 + 后端强制 + 历史回填，三处都要有', () => {
  // 用户 2026-11-17 追加口径：「这个表单管理员应该是柴善银，是**固定的**」
  //   —— 覆盖 2026-10-28「=当前编辑人」那条。
  // 只改一处不够：老单显示的是库里的历史值（生产实测 陈秀丽2 / 系统管理员2），
  // 必须三处齐：新建默认、保存强制、历史回填。
  assert.match(defaults, /\['表单管理人', '柴善银'\]/, '① 新建默认')
  assert.match(btn, /if \("RD_ASM_PROC"\.equals\(def\.code\(\)\)\) body\.put\("表单管理人", "柴善银"\);/,
    '② 保存时服务端强制（前端缓存/旧默认值都盖不掉）')
  const mgrMig = readFileSync(
    new URL('../../../../tools/migrate-asm-proc-fixed-manager-20261117.sql', import.meta.url), 'utf8')
  assert.match(mgrMig, /SET \[表单管理人\] = N'柴善银'/, '③ 历史单回填')
  assert.match(mgrMig, /WHERE ISNULL\(\[表单管理人\], N''\) <> N'柴善银'/, '幂等')
})

test('⑤ 审核人 = 审批通过人：代码回填 + 历史单按 shr 补（账号→姓名）', () => {
  assert.match(btn, /if \("RD_ASM_PROC"\.equals\(def\.code\(\)\)\) writeFieldByLabel\(def, no, "审核人"/,
    '审批通过时回填')
  const mgrMig = readFileSync(
    new URL('../../../../tools/migrate-asm-proc-fixed-manager-20261117.sql', import.meta.url), 'utf8')
  // shr 存账号，纸面要人名 ⇒ 走 yj_user.real_name，取不到退回账号（宁可显示账号也不留空）
  assert.match(mgrMig, /JOIN yj_doc_status s[\s\S]*LEFT JOIN yj_user u[\s\S]*u\.username = s\.shr/,
    '历史单按 shr 补审核人')
  assert.match(mgrMig, /ISNULL\(NULLIF\(LTRIM\(RTRIM\(u\.real_name\)\), N''\), s\.shr\)/, '账号→姓名兜底')
  assert.match(mgrMig, /ISNULL\(h\.\[备用3\], N''\) = N''/, '只补空值，不覆盖既有')
})

test('⑥ 表单管理人不得再被「当前编辑人」覆盖（三处写入点全固定）', () => {
  // 生产实测踩到的坑：库里已经是柴善银，界面却显示「系统管理员」——
  //   PanelxList 的 EDITOR_STAMP_FIELDS 每次打开草稿都把当前登录人写进纸面；
  //   后端 putEditorCols / 保存末尾 UPDATE 也按 realNameOf(user) 回写。
  // 三处必须同时固定，漏一处就会被覆盖回去。
  const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(list, /RD_ASM_PROC: '表单管理人'/, '前端监视器不得再盖表单管理人')
  assert.match(list, /EDITOR_STAMP_FIELDS = \{ RD_PROD_INFO: '编辑人' \}/, '产品信息表的编辑人保留')

  assert.match(btn, /ASM_PROC_FORM_MANAGER = "柴善银"/, '后端要有固定值常量')
  // ① 空白草稿分支
  assert.match(btn, /tableCols\(table\)\.contains\("表单管理人"\)\) \{\s*\n\s*cols\.put\("表单管理人", ASM_PROC_FORM_MANAGER\)/,
    'putEditorCols 要写固定值')
  // ② 保存末尾
  assert.match(btn, /UPDATE rd_asm_proc_head SET 表单管理人 = \?[\s\S]{0,120}ASM_PROC_FORM_MANAGER, no\)/,
    '保存末尾 UPDATE 要写固定值')
  assert.doesNotMatch(btn, /UPDATE rd_asm_proc_head SET 表单管理人 = \?[\s\S]{0,120}realNameOf\(user\), no\)/,
    '不得再按当前保存人回写')
})
