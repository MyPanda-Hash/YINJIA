/**
 * prodBomSyncHook.test.js —— 产品信息表归档 ⇒ BOM 明细同步写入物料清单(mate)
 *
 * 【需求来源】用户 2026-10-29 口径:
 *   「产品信息表的BOM明细在产品信息表归档之后,同时保存到物料清单里面去,
 *     B. 覆盖更新,这个是因为产品编号是唯一的,如果BOM更新了,就根据这个产品编号
 *     重新覆盖原来的BOM就行了」
 *
 * 【业务口径(定下来的三条)】
 *   ① 触发时机 = 产品信息表**归档**(markArchived 是唯一归档入口,三类路径都汇到这里:
 *      保存即归档 / 审批通过 / 二级审批通过)⇒ 挂在那里才不会漏;
 *   ② 一张产品信息表 ⇒ 物料清单里**一张单**(按产品编号唯一);
 *      同一产品编号重新归档 ⇒ **覆盖更新**(先删旧子件再写新),不新建第二张;
 *      产品编号改了 ⇒ 旧单作废/删除,按新编号重建,不能留孤儿;
 *   ③ 字段映射:
 *        物料清单 m_no     ← 产品编号
 *        物料清单 m_date   ← 单据日期
 *        物料清单 wzdm1    ← 产品编号(物料清单表头的"物料代码",原实现里 ≡ m_no)
 *        物料清单 wzmc1    ← 产品名称
 *        mate.wzdm2 子件代码 ← 产品信息表明细 物料编号
 *        mate.wzmc2 子件名称 ← 明细 物料名称
 *        mate.gg2   规格型号 ← 明细 尺寸规格
 *        mate.bzl   标准用量 ← 明细 数量
 *   ④ **不能影响归档主流程**:同步失败只记 warning,归档本身照常成功
 *      (否则 BOM 写失败会让单据卡在"未归档",比不同步更糟)。
 *
 * 【为什么用源码断言】这是后端 Java 的钩子点 + 映射常量,行为由 SQL 决定;
 *   真跑一遍要起 Spring + 造单据,成本极高。断言钉住的是「钩子还挂在 markArchived」
 *   「覆盖语义还是先删后插」「异常不冒泡」这三件最容易被人顺手改回去的事。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')

/** 取方法体(按大括号配对,避免切片截断) */
function methodBody(src, signature) {
  const at = src.indexOf(signature)
  assert.ok(at >= 0, `找不到 ${signature}`)
  let i = src.indexOf('{', at)
  assert.ok(i > 0, `${signature} 没有方法体`)
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') {
      depth--
      if (depth === 0) return src.slice(at, j + 1)
    }
  }
  return src.slice(at, at + 8000)
}

test('① 同步挂在 markArchived 里(唯一归档入口,三类归档路径都经过它)', () => {
  const body = methodBody(btn, 'private void markArchived(')
  assert.match(body, /syncProdBomToMaterialList\s*\(/, 'markArchived 要调用同步方法')
})

test('② 只在产品信息表触发,别的面板归档不能碰物料清单', () => {
  const body = methodBody(btn, 'private void markArchived(')
  // 同步调用必须在 RD_PROD_INFO 的判断之内
  const at = body.indexOf('syncProdBomToMaterialList')
  const guard = body.lastIndexOf('RD_PROD_INFO', at)
  assert.ok(guard > 0, 'syncProdBomToMaterialList 必须在 RD_PROD_INFO 的分支里')
})

test('③ 覆盖更新:同一产品编号先删旧子件再写新(不新建第二张单)', () => {
  const body = methodBody(btn, 'private void syncProdBomToMaterialList(')
  assert.match(body, /DELETE\s+FROM\s+\[?mate\]?/i, '要先删旧子件(覆盖语义)')
  assert.match(body, /INSERT\s+INTO\s+\[?mate\]?/i, '再写入新子件')
  // 覆盖的定位键必须是产品编号(m_no)
  assert.match(body, /m_no/i, '按 m_no(产品编号)定位要覆盖哪张物料清单')
})

test('④ 字段映射:m_no←产品编号 / bzl←数量 / wzdm2←物料编号 / wzmc2←物料名称 / gg2←尺寸规格', () => {
  const body = methodBody(btn, 'private void syncProdBomToMaterialList(')
  for (const col of ['m_no', 'm_date', 'wzdm1', 'wzmc1', 'wzdm2', 'wzmc2', 'gg2', 'bzl']) {
    assert.match(body, new RegExp(col, 'i'), `映射缺少 ${col}`)
  }
  // 源字段来自产品信息表
  for (const cn of ['产品编号', '物料编号', '物料名称', '尺寸规格', '数量']) {
    assert.match(body, new RegExp(cn), `映射缺少源字段 ${cn}`)
  }
})

test('⑤ 同步失败不能拖垮归档(try/catch 兜住,只记日志)', () => {
  const body = methodBody(btn, 'private void syncProdBomToMaterialList(')
  assert.match(body, /catch\s*\(/, '必须有 catch —— BOM 写失败不能让归档失败')
  assert.match(body, /warn|log\./i, '失败要留日志')
  // 不能有 throw 冒泡
  assert.ok(!/\bthrow\s+new\b/.test(body.replace(/\/\*[\s\S]*?\*\//g, '')), '不能向调用方抛异常')
})

test('⑥ 空产品编号 / 无 BOM 明细时安静跳过(不造空单)', () => {
  const body = methodBody(btn, 'private void syncProdBomToMaterialList(')
  assert.match(body, /isBlank|isEmpty/, '要判空')
  assert.match(body, /return/, '空值直接返回')
})

test('⑦ 只在归档时同步(用户 2026-10-29 选 A):保存路径不得调用同步', () => {
  // 全类里 syncProdBomToMaterialList 只允许出现两处:定义 1 次 + markArchived 里调用 1 次。
  // 一旦有人在 saveDoc / approve / audit 里再加一处,这里立刻红 ——
  // 用户口径是「BOM 未定稿不进物料清单」,草稿态同步会把半成品 BOM 灌进去。
  const hits = [...btn.matchAll(/syncProdBomToMaterialList\s*\(/g)]
  assert.equal(hits.length, 2,
    `syncProdBomToMaterialList 应只出现 2 次(定义 + markArchived 调用),实际 ${hits.length} 次 —— 有人在保存/审批路径里加了同步`)

  // 并且那唯一一处调用必须在 markArchived 方法体内
  const arch = methodBody(btn, 'private void markArchived(')
  assert.match(arch, /syncProdBomToMaterialList\s*\(/, '调用点必须在 markArchived(唯一归档入口)')

  // 反向确认:保存类方法里不能出现它
  for (const fn of ['saveDoc', 'approve', 'audit']) {
    try {
      const b = methodBody(btn, fn + '(')
      assert.ok(!/syncProdBomToMaterialList/.test(b), `${fn} 里不该有同步调用`)
    } catch { /* 该重载/签名不存在就跳过 */ }
  }
})
