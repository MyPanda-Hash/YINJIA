/**
 * 样品编号规则(Sample Number Rule)—— 确定性拼接
 *
 * 【口径来源】2026-09-18 grill 会话,用户定"走 a"。设计《二三级四级项目控制表2026.xlsx》
 * sheet《产品开发样品编号》表尾写 `XX-XXX-01`(XX=客户项目代号 / XXX=项目编号 / 01=编号序号)。
 *
 * 【关键发现】把口径 a 推到底 —— 那三段就是:
 *     XX  = 客户项目代号
 *     XXX = 项目编号的【基号】(如 201)
 *     01  = 项目编号的【末段】(如 201-1 的 1)
 *   ⇒ `XXX` + `01` 合起来就是项目编号本身,`01` **不是样品计数器**,
 *     而是项目编号自带的分支序号(设计表 F 列本来就写着 201-1 / 201-2)。
 *
 * 【因此】样品编号 = 客户项目代号 + 项目编号(直接拼接):
 *     FL  + 201-1  =>  FL201-1
 *     FL  + 201-2  =>  FL201-2
 *     FLN + 407-1  =>  FLN407-1
 *
 *   已验证:设计自身 38 个样例 **38/38 逐字复现**(tools/verify 口径见会话记录),
 *   且项目编号 38 个全唯一 ⇒ **不需要序号计数器、不需要查库、不需要新端点、无并发竞态**。
 *
 * 【三条前置约定】(违反会拼出歧义编号,见 assertParts)
 *   ① 客户项目代号必须纯字母 —— 含连字符会与项目编号的连字符混淆,编号无法反解
 *      (`A-B` + `201-1` ⇒ `A-B201-1`,与 `A` + `B201-1` 无法区分)
 *   ② 项目编号必须以 `-<数字>` 结尾 —— 否则拼出的编号缺第三段(`201` ⇒ `FL201`)
 *   ③ 同一项目编号只出一张样品 —— 拼接是确定性的,同编号必撞唯一性;
 *      要两支时用 201-1 / 201-2 两条项目编号(与设计数据形态一致)
 */

/** 客户项目代号:纯字母(允许大小写,统一转大写输出) */
const CUSTOMER_CODE_RE = /^[A-Za-z]+$/
/** 项目编号必须以 `-<数字>` 结尾。校验用(只要通过/不通过,不取组) */
const PROJECT_NO_RE = /^.+-(\d+)$/
/** 拆解用:**两个捕获组** —— group1=基号、group2=末段。
 *  ⚠ 原实现用 `^.+-(\d+)$` 只有一个组就去取 m[1]/m[2] —— m[1] 是**末段**(`201-1` → `1`)、
 *  m[2] 是 **undefined**,于是 baseOfProjectNo 返回 `1`、tailOfProjectNo 返回 undefined(踩过)。
 *  改为显式两个组,语义自明。 */
const SPLIT_RE = /^(.+)-(\d+)$/

/**
 * 校验三段前置约定。不合法即抛错(录入时就拦住不规范的值,不要等到拼出怪编号)。
 * @param {string} customerCode 客户项目代号(XX)
 * @param {string} projectNo    项目编号(XXX-01)
 */
export function assertSampleNoParts(customerCode, projectNo) {
  const xx = String(customerCode ?? '').trim()
  const pno = String(projectNo ?? '').trim()
  if (!xx) throw new Error('客户项目代号不能为空')
  if (!CUSTOMER_CODE_RE.test(xx)) throw new Error(`客户项目代号必须是纯字母(不含连字符/数字/空格)：${xx}`)
  if (!pno) throw new Error('项目编号不能为空')
  if (!PROJECT_NO_RE.test(pno)) throw new Error(`项目编号必须以 -<数字> 结尾(如 201-1)：${pno}`)
  return { customerCode: xx.toUpperCase(), projectNo: pno }
}

/**
 * 生成样品编号 = 客户项目代号 + 项目编号(直接拼接)。
 * 任一段为空返回空串(空草稿不报错);两段都不空但不合法则抛错。
 * @returns {string} 样品编号,如 `FL201-1`
 */
export function makeSampleNo(customerCode, projectNo) {
  const xx = String(customerCode ?? '').trim()
  const pno = String(projectNo ?? '').trim()
  if (!xx || !pno) return ''            // 空:留给用户继续填,不抛
  const v = assertSampleNoParts(xx, pno)
  return v.customerCode + v.projectNo
}

/** 取项目编号的基号(`201-1` → `201`) */
export function baseOfProjectNo(projectNo) {
  const m = SPLIT_RE.exec(String(projectNo ?? '').trim())
  return m ? m[1] : ''
}

/** 取项目编号的末段序号(`201-1` → `1`) */
export function tailOfProjectNo(projectNo) {
  const m = SPLIT_RE.exec(String(projectNo ?? '').trim())
  return m ? m[2] : ''
}

/**
 * 反解样品编号(用于校验/排查):`FL201-1` + 已知客户代号 `FL` → 项目编号 `201-1`。
 * 代号未知时返回 null(无法反解 —— 这正是约定 ① 存在的原因)。
 */
export function parseSampleNo(sampleNo, customerCode) {
  const s = String(sampleNo ?? '').trim()
  const xx = String(customerCode ?? '').trim().toUpperCase()
  if (!s || !xx) return null
  if (!s.toUpperCase().startsWith(xx)) return null
  return s.slice(xx.length)
}
