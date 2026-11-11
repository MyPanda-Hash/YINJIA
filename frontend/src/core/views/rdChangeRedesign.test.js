/**
 * rdChangeRedesign.test.js —— 产品变更申请表改版（用户口径 2026-11-11）
 *
 * 【用户原话】
 *   「现在对产品变更申请表进行一个重新设计，这个产品变更申请表的表的表头标题固定为产品变更申请表，
 *    会签人字段改为下拉勾选对应的账号，就是人员姓名，四五内容区去掉」
 *
 * 三条要求逐条钉住：
 *   ① 表头标题**固定**「产品变更申请表」→ 不能再走 titleKey（可编辑输入框）；
 *   ② 会签人 → **下拉勾选账号**，界面上显示**人员姓名**；
 *      但落库仍必须是**账号**：后端 submitSignoff/signersOf 按账号校验启用状态、发通知、
 *      写 yj_form_approval.operator（见 ButtonService.signersOf 按 [,，、;；\s] 切分）。
 *      ⇒ 显示名与存储值分离，本测试同时钉住两头。
 *   ③ 「四、库存产品处理方式」「五、其它」两段**整段删除**。
 *
 * 单测跑不了模板分支，按仓库既有做法读源码钉住（同 rdChangeConfig.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')
const sheet = read('src/core/views/RecordSheetPanels.vue')
const px = read('../backend/src/main/java/com/yinjia/mes/controller/PxController.java')

const cfg = recordSheetConfigs.RD_CHANGE

test('① 表头标题固定为「产品变更申请表」，不再可编辑', () => {
  assert.equal(cfg.staticTitle, '产品变更申请表')
  // 有 titleKey 就会在编辑态渲染成输入框（用户 2026-10-16 曾要求可编辑；2026-11-11 改为固定）
  assert.equal(cfg.titleKey, undefined, 'titleKey 必须去掉，否则标题又变成可编辑输入框')
  // 留一个防回退：没有 titleKey 时，占位词不该再参与渲染
  assert.equal(cfg.titleKeyPh, undefined, 'titleKey 已去掉，titleKeyPh 一并清理')
})

test('② 会签人是「选人」控件，且支持下拉勾选（多选）', () => {
  const rows = (cfg.sections || []).flatMap((s) => s.rows || [])
  const cell = rows.flatMap((r) => r.grid || []).find((c) => c.key === '会签人')
  assert.ok(cell, '找不到会签人那一格')
  assert.equal(cell.userPick, true, '会签人必须用选人控件（下拉勾选账号），不能再是纯文本输入')
  assert.equal(cell.multiple, true, '会签人可以多选（后端 signersOf 支持多账号）')
  // 旧文案是"多人用逗号分隔（账号）"—— 改成选人后不该再让用户手打账号
  assert.ok(!String(cell.ph || '').includes('逗号'), '占位词不该再教用户手打逗号分隔的账号')
})

test('③ 组件里显示的是**人员姓名**，而落库保持**账号**', () => {
  // 选人控件：label 取 realName、value 取 username
  assert.match(sheet, /realName/, '选人下拉的显示名必须取 realName（用户口径"就是人员姓名"）')
  assert.match(sheet, /:value="u\.username"/, '选人下拉的值必须是账号（后端按账号校验/发通知/写留痕）')
  // 多选值 ↔ 存库文本 的转换必须存在（存库是顿号分隔的账号串，与 signersOf 的切分口径一致）
  assert.match(sheet, /pickListOf/, '缺少 账号串 → 数组 的解析函数')
  assert.match(sheet, /setPickList/, '缺少 数组 → 账号串 的写回函数')
})

test('④ 只读态也要显示姓名，不能把账号直接印在纸上', () => {
  // 只读分支必须走"账号→姓名"的映射，而不是原样显示 head[key]
  assert.match(sheet, /signNamesOf/, '只读态缺少账号→姓名映射（否则纸面印出一串英文账号）')
})

test('④b 顶层函数里必须用 props.head —— 模板能裸写 head，<script setup> 里不行', () => {
  // 实测事故（2026-11-11）：会签人辅助函数写成裸 `head[key]`，渲染期抛
  //   ReferenceError: head is not defined —— Vue 捕获后**整张纸面停止更新**，
  //   DOM 停在旧状态（分页 0/0、单据编号显示「—」、格子全空），而且波及**所有**
  //   RecordSheetPanels 面板（RD_PROD_INFO 一起报错）。单测抓不到，只有活体看得到，
  //   所以钉住这条：顶层 function 里出现裸 head 就是引用了不存在的绑定。
  const raw = sheet.slice(sheet.indexOf('<script setup'), sheet.indexOf('</script>'))
  // 先去注释，否则文档里"head[]"这类示例会被误判
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const fnRe = /^function\s+(\w+)\s*\(([^)]*)\)\s*\{/gm
  const problems = []
  let m
  while ((m = fnRe.exec(code)) !== null) {
    const name = m[1]
    const params = m[2]
    // 取函数体：从 { 起按花括号配平
    let i = code.indexOf('{', m.index)
    let depth = 0
    let body = ''
    for (; i < code.length; i++) {
      const ch = code[i]
      body += ch
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) break }
    }
    if (params.includes('head')) continue           // head 是形参
    if (/\bconst\s+head\b/.test(body)) continue     // 函数内自己取了本地别名
    // 裸 head（前面不是点，排除 props.head）
    const bare = [...body.matchAll(/(^|[^.\w$])head\s*\??\.?\[/gm)]
    if (bare.length) problems.push(`${name}(): ${bare.length} 处裸 head`)
  }
  assert.deepEqual(problems, [], '这些函数在脚本作用域引用了不存在的 head，必须写 props.head：\n' + problems.join('\n'))
})

test('⑨ 侧栏「字段管理」要有可见的框（按 antd 默认按钮 token，2026-11-11）', () => {
  // 用户口径：「设计库设计这个的显示框」——原来走 .sub（透明无边框纯文本），看着不像能点。
  const px = read('src/core/views/PanelxList.vue')
  assert.match(px, /class="as-side-btn sub boxed"[^>]*onSideAction\('字段管理'\)/, '字段管理要挂 boxed')
  const css = px.match(/\.as-side-btn\.sub\.boxed \{[\s\S]*?\n\}/)
  assert.ok(css, '缺少 .boxed 样式')
  const b = css[0]
  // 取值必须来自 antd token（改主题时这里的注释与数值要一起核对）
  assert.match(b, /border: 1px solid #d9d9d9/, '边框应为 colorBorder #d9d9d9')
  assert.match(b, /border-radius: 6px/, '圆角应为 borderRadius 6')
  assert.match(b, /height: 32px/, '高度应为 controlHeight 32')
  assert.match(b, /background: #fff/, '背景应为 colorBgContainer #fff')
  assert.match(b, /rgba\(0, 0, 0, 0\.88\)/, '文字应为 colorText rgba(0,0,0,.88)')
  assert.match(px, /\.as-side-btn\.sub\.boxed:hover \{[\s\S]*?#1677ff/, 'hover 应转 colorPrimary #1677ff')
  // 只影响这一个，别把另外几个 .sub（审批情况/撤回会签）也带成方框
  assert.match(px, /\.as-side-btn\.sub \{[\s\S]*?background: transparent/, '.sub 基础样式应保持不变')
})

test('⑧ 归档后「会签人填本部门行」是**窄口子**：非管理员 + 有部门 + 只写明细', () => {
  // 用户口径（2026-11-11）：「后续归档之后，会签人可以根据自己的所属部门在对应的部门的行框里面进行填写」
  //   且确认会签流程**保留**（B）。所以这不是"把归档打开"：
  //   · 服务端 allowChangeDeptFill 四条判据（面板/非管理员/有部门/状态）
  //   · 放行后**只写明细不写表头**，避免会签人顺手改掉已生效单的实质内容
  const btn = read('../backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
  assert.match(btn, /allowChangeDeptFill/, '缺少 allowChangeDeptFill 判定')
  const m = btn.match(/private boolean allowChangeDeptFill\([\s\S]*?\n    \}/)
  assert.ok(m, '找不到 allowChangeDeptFill 实现')
  const body = m[0]
  assert.match(body, /isAdminUser\(user\)\) return false/, '管理员不得走这个口子（要改请走「修改申请」）')
  assert.match(body, /changeDeptsOf\(user\)\.isEmpty\(\)/, '必须有匹配的部门行')
  assert.match(body, /已生效|已归档/, '只在已生效/已归档状态下生效')
  // 只写明细：upsertHeadRow 必须被 deptFillOnly 挡掉
  assert.match(btn, /if \(!deptFillOnly\) upsertHeadRow\(/, '部门填写模式必须跳过表头写入')
  // 前端：放行只在"按部门锁行的表"上，其余格子仍锁
  assert.match(sheet, /props\.deptFillOpen && !!dt\.lockKey/, 'deptFillOpen 只能放开按部门锁行的表')
})

test('⑤ 后端提供会签人选人清单，权限挂 RD_CHANGE（不复用别的面板端点）', () => {
  assert.match(px, /@GetMapping\("\/rdChange\/users"\)/, '缺少 /px/rdChange/users 端点')
  const m = px.match(/@GetMapping\("\/rdChange\/users"\)[\s\S]{0,400}?\n    \}/)
  assert.ok(m, '端点声明格式异常')
  assert.match(m[0], /requirePanelView\("RD_CHANGE"\)/, '端点必须挂 RD_CHANGE 查看权（挂别的面板会 403）')
  assert.match(m[0], /enabledUsers\(\)/, '端点应返回启用账号清单（与其它选人下拉同源）')
})

test('⑦ 文件编码挪到右上角（替换单据编号）且是固定值', () => {
  // 用户口径（2026-11-11）:「文件编码挪到右上角，替换单据编号，而且是固定的」。
  // 机制用既有的两件套（产品信息表/规格书同款）:
  //   · cfg.docNoStatic → 该格印**常量**，编辑态与只读态都不出输入框/参照控件；
  //   · head.docnoPrefix（字符串）→ 标识文案，这里由「单据编号」改为「文件编码」。
  assert.equal(cfg.docNoStatic, 'YJ-QR-130', '右上角那格要印固定的表单编号 YJ-QR-130')
  assert.equal(cfg.head?.docnoPrefix, '文件编码', '右上角标识文案要改成「文件编码」')
  // 挪走之后，表格里不能再重复出现「文件编码」这一格（否则一张纸印两处）
  const bodyCells = (cfg.sections || []).flatMap((s) => s.rows || []).flatMap((r) => r.grid || [])
  const dup = bodyCells.filter((c) => c.label === '文件编码' || c.fixed === 'YJ-QR-130')
  assert.deepEqual(dup, [], '表格里不该再保留「文件编码」这一格(已挪到右上角)')
  // 单据编号仍要在表格里（用户只要求换掉右上角那格，没让把单号删掉）
  assert.ok(bodyCells.some((c) => c.key === '单据编号'), '表格里的「单据编号」行要保留')
})

test('⑥ 「四、库存产品处理方式」「五、其它」两段整段删除', () => {
  const bars = (cfg.tailSections || []).map((s) => s.bar)
  assert.ok(!bars.some((b) => String(b).includes('库存产品处理方式')), '四、库存产品处理方式 必须删掉')
  assert.ok(!bars.some((b) => String(b).includes('其它')), '五、其它 必须删掉')
  // 这两段独有的字段不该再出现在纸面上
  const seen = new Set((cfg.tailSections || []).flatMap((s) => (s.rows || []))
    .flatMap((r) => r.grid || []).flatMap((c) => [c.key, c.label]).filter(Boolean))
  for (const k of ['原料数量', '成品处理方式', '文件管理人', '文件使用范围']) {
    assert.ok(!seen.has(k), `${k} 属于已删除的四/五段，不该还留着`)
  }
  // 三.相关变更 与 批准 仍要保留（删的是四、五，不是把尾巴全砍）
  assert.ok(bars.some((b) => String(b).includes('相关变更')), '三.相关变更 应保留')
  assert.ok(bars.some((b) => String(b).includes('批准')), '批准 段应保留')
})
