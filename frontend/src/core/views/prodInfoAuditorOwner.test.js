/**
 * prodInfoAuditorOwner.test.js —— 产品信息表「两级审核人」默认值 + 「产品负责人」自动回填
 *
 * 【用户口径 2026-10-29】
 *   ① 「产品信息表的这个两个审核人默认填写为冯总和陈秀丽,也可以修改的,保存之后也显示出来,
 *      现在没有显示出来」
 *      ⇒ 审核人(一级)= 冯敏(fengmin) / 审核人(二级)= 陈秀丽(cp) 作**默认值**;
 *        可改;保存后纸面要读得到(不是只在新建时前端填一下就丢)。
 *   ② 「产品负责人是对接人签核分发的规格书的负责人,在对接人签核分发规格书的负责人之后
 *      自动回填到这个产品信息表里面,但是不修改产品信息表的状态,就是可以在产品信息表处于
 *      归档状态的情况下回填产品负责人」
 *      ⇒ 规格书「分发责任人」把 RD_SPEC_DOC 的负责人定下来后,
 *         **反写**产品信息表 RD_PROD_INFO.责任人,且**不改该单据状态**(已归档也照写)。
 *
 * 【为什么之前不显示(两个叠加的真因)】
 *   a) 后端 `putHeadDefaults` 只挂在**空白草稿分支**(directAdd),主保存路径没调它 ⇒
 *      「新增 → 填数据 → 保存」这条最常见的路根本没写默认值;
 *   b) 前端 `applyDocDefaults` 只在 `draftEditable`(草稿态)时跑,单据一归档就不再补 ⇒
 *      历史单永远是空的。
 *   两条合起来 = 用户看到的「没显示出来」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const DOC = readFileSync(new URL('../panel/docDefaults.js', import.meta.url), 'utf8')
const BTN = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')

test('① 两级审核人的默认值是 冯总 / 陈秀丽', () => {
  const at = DOC.indexOf('RD_PROD_INFO: [')
  assert.ok(at >= 0, '找不到 RD_PROD_INFO 默认值段')
  // 取到该段的收尾 `  ],`(两个空格的缩进)—— 不能用 indexOf('],') ,那会截到注释里的逗号
  const end = DOC.indexOf('\n  ],', at)
  assert.ok(end > at, '找不到 RD_PROD_INFO 段的结尾')
  const seg = DOC.slice(at, end)
  // 用户 2026-10-29 补充口径:「不是冯敏,就是冯总,因为冯总使用的是管理员的账号」
  //   冯总用 admin 账号,这两列是纯展示文字,不参与账号反查 ⇒ 就写「冯总」。
  assert.match(seg, /'审核人（一级审批人）',\s*'冯总'/, '一级审核人默认应为「冯总」')
  assert.match(seg, /'审核人（二级审批人）',\s*'陈秀丽'/, '二级审核人默认应为「陈秀丽」(账号 cp 的真实姓名)')
  // 反例:不能是冯敏(那是 fengmin 账号的姓名,不是冯总)
  assert.ok(!/'审核人（一级审批人）',\s*'冯敏'/.test(seg), '一级不该是「冯敏」——冯敏是另一个账号')
  assert.ok(!/['"]秀丽['"]\s*\]/.test(seg), '段内不该再残留旧值「秀丽」(缺姓)')
})

test('② 后端主保存路径也要补默认值(不能只在空白草稿分支)', () => {
  // putHeadDefaults 的调用点应 >= 2 处(草稿分支 + 主保存路径)
  const calls = [...BTN.matchAll(/putHeadDefaults\s*\(/g)].length
  assert.ok(calls >= 2,
    `putHeadDefaults 只被调用 ${calls} 次(1 次=定义):主保存路径漏了,「新增→填→保存」不会写默认值`)
})

test('③ 规格书分发责任人后要反写产品信息表的「产品责任人」且不改状态', () => {
  // 分发在 specAssign(规格书分发按钮)—— 产品信息表侧
  const at = BTN.indexOf('private Map<String, Object> specAssign(')
  assert.ok(at >= 0, '找不到 specAssign(规格书分发)')
  let i = BTN.indexOf('{', at)
  let depth = 0
  let body = ''
  for (let j = i; j < BTN.length; j++) {
    if (BTN[j] === '{') depth++
    else if (BTN[j] === '}') { depth--; if (depth === 0) { body = BTN.slice(at, j + 1); break } }
  }
  assert.match(body, /backfillProdOwner\s*\(/, 'specAssign 末尾要调 backfillProdOwner 回填产品负责人')
})

test('④ 回填方法:只 UPDATE 责任人列,绝不能碰状态列', () => {
  const at = BTN.indexOf('private void backfillProdOwner(') >= 0
    ? BTN.indexOf('private void backfillProdOwner(')
    : BTN.indexOf('private void backfillProdInfoOwner(')
  assert.ok(at >= 0, '缺少回填产品负责人的方法')
  let i = BTN.indexOf('{', at)
  let depth = 0
  let body = ''
  for (let j = i; j < BTN.length; j++) {
    if (BTN[j] === '{') depth++
    else if (BTN[j] === '}') { depth--; if (depth === 0) { body = BTN.slice(at, j + 1); break } }
  }
  assert.match(body, /UPDATE\s+\[?rd_prod_info_head\]?/i, '要更新产品信息表头表')
  assert.match(body, /责任人/, '要写 责任人 列')
  // 绝不能动状态:不写 yj_doc_status、不改 archived/pending
  assert.ok(!/yj_doc_status/i.test(body), '回填不能碰 yj_doc_status(否则会改单据状态)')
  assert.ok(!/archived|pending|canceled/i.test(body), '回填不能改 archived/pending/canceled')
})
