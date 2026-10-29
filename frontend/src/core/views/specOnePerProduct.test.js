/**
 * specOnePerProduct.test.js —— 「一个产品信息表只能对应一张规格书」必须由**后端**兜住
 *
 * 【需求来源】用户 2026-10-21 口径:
 *   「一个产品信息表对应一个产品规格书,不能多次引用」
 *
 * 【2026-10-29 全流程验收抓到的缺口】
 *   这条规则当时**只做在前端弹窗**(RecordSheetPanels 的 prodPick:已引用的行标 __used、
 *   点它只提示不选中)。但后端保存路径完全没校验 ⇒ 直连 /px/callButton 或换台机器,
 *   同一个产品编号能存出**第二张规格书**,两套数据并存,而且都会各自走审批归档。
 *   实测:SD-2026-10-0017 与 SD-2026-10-0018 两张都绑 YJ-CB-2026-001,后一张保存时返回 200。
 *
 * 【修法】照 RD_PROD_INFO 的既有做法(ensureProductCodeUnique)给 RD_SPEC_DOC 加同款校验:
 *   同产品编号的**未作废**规格书已存在 ⇒ 拒绝;自己那张(no 相同)不算冲突;
 *   已作废(canceled='Y')不算占用 —— 与 ensureDocNoUnique 的口径一致,否则作废后无法重录。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')

function methodBody(src, signature, max = 4000) {
  const at = src.indexOf(signature)
  if (at < 0) return null
  let i = src.indexOf('{', at)
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(at, j + 1) }
  }
  return src.slice(at, at + max)
}

test('① RD_SPEC_DOC 保存时要校验「一产品一规格书」', () => {
  // saveDoc 的签名跨多行,用 methodBody 按第一个 '{' 找会截错方法体。
  // 改为直接在源码里定位调用点,并回看附近是否在 RD_SPEC_DOC 的分支上。
  const at = btn.indexOf('ensureSpecOnePerProduct(')
  assert.ok(at > 0, '保存路径要调用 ensureSpecOnePerProduct')
  // 取**整行**(从行首到行尾):lastIndexOf('\n') 拿到的是上一行的换行,要 +1
  const lineStart = btn.lastIndexOf('\n', at) + 1
  const callLine = btn.slice(lineStart, btn.indexOf('\n', at))
  assert.match(callLine, /"RD_SPEC_DOC"\.equals\(def\.code\(\)\)/,
    '调用必须挂在 RD_SPEC_DOC 的判断上,不能对所有面板都跑')

  // 判定「在 saveDoc 方法体内」改为看调用行的**缩进**:方法体内的语句缩进 8 空格,
  // 顶层方法定义缩进 4 空格 —— 比数方法个数可靠(文件里方法很多,配对容易数错)。
  assert.match(callLine, /^ {8}\S/, '调用行应缩进 8 空格(位于方法体内,而不是类级)')
  const saveAt = btn.indexOf('private Map<String, Object> saveDoc(')
  assert.ok(saveAt > 0, '找不到 saveDoc')
  assert.ok(at > saveAt, '调用应在 saveDoc 定义之后')
})

test('② 校验方法本身:同产品编号未作废的规格书已存在 ⇒ 抛错', () => {
  const m = methodBody(btn, 'private void ensureSpecOnePerProduct(')
  assert.ok(m, '缺少 ensureSpecOnePerProduct 方法')
  assert.match(m, /rd_spec_doc_head/, '要查规格书头表')
  assert.match(m, /产品编号/, '按产品编号判重')
  assert.match(m, /throw\s+new/, '冲突时要抛错拒绝保存')
  // 自己那一张不算冲突
  assert.match(m, /单据编号/, '要排除自己那张(改自己时不能判成冲突)')
  // 已作废不算占用
  assert.match(m, /asp_cancel|canceled/, '已作废的单不算占用,否则作废后无法重录')
})
