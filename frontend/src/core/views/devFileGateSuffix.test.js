/**
 * devFileGateSuffix.test.js —— 烧结工艺清单「产品编号 -tb 后缀」与四文件门禁的钉子
 *
 * 【2026-11-02 用户报障】
 *   「我在服务器使用刘磊这个账号登录,测试过程中出现这个问题,但是使用admin账号却是可以保存草稿」
 *   截图 = 烧结工艺清单(RD_MOLD_PROC)一张草稿,红条写着
 *   「该产品(A-54-12-tb)尚未分发责任人,请先在产品信息表点「分发责任人」」。
 *
 * 【实测根因】服务器 HSDZ_MES 数据说明一切:
 *   rd_dev_task 里 A-54-12 的 RD_MOLD_PROC 负责人 = **liulei**(就是刘磊);
 *   而单据上的产品编号是 **A-54-12-tb**(前端 productCodeWithSuffix 拼上去的)。
 *   后端四文件门禁用 `assignsOf("A-54-12-tb")` 去查 rd_dev_task(存的是 A-54-12)⇒ 查不到
 *   ⇒ 判成「尚未分发责任人」⇒ 真正的责任人被挡在保存之外;admin 走管理员兜底所以没事。
 *
 * 【为什么这条钉子必须存在】这类错**不报错、只查不到**,表现是"功能看起来没坏,就是不给你用":
 *   · 四文件编辑门禁 → 责任人存不了单(本次报障);
 *   · 规格书漂移 / 产品信息表漂移黄条 → 永远不出现;
 *   · 产品开发进度矩阵 → 该节点永远显示「未开发/未开始」。
 * 所以前端纯函数用行为断言,后端用源码不变量断言(仓库既有做法,见 rdChangeConfig.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rawProductCode, productCodeWithSuffix } from '../panel/productCodeSuffix.js'

const devTask = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/DevTaskService.java', import.meta.url), 'utf8')
const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const rdDev = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/RdDevProductService.java', import.meta.url), 'utf8')

/** 取某方法签名之后的一段源码(方法体足够长的近似),用不到精确边界 */
function region(src, marker, len = 1600) {
  const i = src.indexOf(marker)
  assert.ok(i >= 0, `源码里找不到 ${marker}`)
  return src.slice(i, i + len)
}

// ── 一、前端规则本身(行为断言) ──
test('rawProductCode 只剥结尾一层 -tb,大小写不敏感、空值不产出脏值', () => {
  assert.equal(rawProductCode('A-54-12-tb'), 'A-54-12')
  assert.equal(rawProductCode('A-54-12-TB'), 'A-54-12')
  assert.equal(rawProductCode('  A-54-12-tb  '), 'A-54-12')
  assert.equal(rawProductCode('A-54-12'), 'A-54-12')
  assert.equal(rawProductCode(''), '')
  assert.equal(rawProductCode(null), '')
  assert.equal(rawProductCode('-tb'), '', '只有后缀 ⇒ 空串,绝不能产出空产品编号')
  // 中间出现的 -tb 属业务编码本身,不动
  assert.equal(rawProductCode('tb-A-01'), 'tb-A-01')
})

test('productCodeWithSuffix 幂等:重复点参照不会叠成 -tb-tb', () => {
  assert.equal(productCodeWithSuffix('A-54-12', 'RD_MOLD_PROC'), 'A-54-12-tb')
  assert.equal(productCodeWithSuffix('A-54-12-tb', 'RD_MOLD_PROC'), 'A-54-12-tb')
  // 只有烧结工艺清单加后缀
  assert.equal(productCodeWithSuffix('A-54-12', 'RD_ASM_PROC'), 'A-54-12')
})

// ── 二、后端必须「两种形态都认」——这是本次报障的修复点 ──
test('DevTaskService 提供 baseProductCode / productCodeForms,规则与前端同口径', () => {
  assert.match(devTask, /public static String baseProductCode\(String code\)/,
    '缺 baseProductCode:后端无从还原 -tb')
  assert.match(devTask, /replaceFirst\("\(\?i\)-tb\$"/,
    '剥离规则必须是结尾一层、大小写不敏感(与前端 rawProductCode 一致)')
  assert.match(devTask, /public static List<String> productCodeForms\(String code\)/,
    '缺 productCodeForms:查 head 表需要 原值 / 原值-tb 两种形态')
})

test('assignsOf 先还原再查 rd_dev_task(否则责任人被误判「尚未分发」)', () => {
  const body = region(devTask, 'public Map<String, String> assignsOf(String productCode)')
  assert.match(body, /String code = baseProductCode\(productCode\)/,
    'assignsOf 必须先把 A-54-12-tb 还原成 A-54-12')
  assert.match(body, /FROM rd_dev_task WHERE 产品编号 = \?/, '查 rd_dev_task 用的是还原后的 code')
  assert.match(body, /\}, code\);/, '查询参数必须是还原后的 code,不能是入参原值')
})

test('supervisorOf / dispatched / specAssignState 同样还原后再查', () => {
  assert.match(region(devTask, 'public String supervisorOf(String productCode)'),
    /final String code = baseProductCode\(productCode\)/, 'supervisorOf 必须还原')
  assert.match(region(devTask, 'public boolean dispatched(String productCode)'),
    /String code = baseProductCode\(productCode\)/, 'dispatched 必须还原')
  assert.match(region(devTask, 'public Map<String, Object> specAssignState(String productCode)'),
    /final String code = baseProductCode\(productCode\)/, 'specAssignState 必须还原')
})

test('specByProduct 还原后才查 rd_spec_assign / rd_spec_doc_head(否则「带入规格书」静默空)', () => {
  const body = region(devTask, 'public Map<String, Object> specByProduct(String productCode, String sheetArea)')
  assert.match(body, /String code = baseProductCode\(productCode\)/, 'specByProduct 必须还原')
})

test('查 head 表的地方用 IN (?, ?) 兜两种形态(老单据存原值、新单据存带后缀)', () => {
  const status = region(devTask, 'private Map<String, String> statusAndDocNo(String productCode, String panelCode)')
  assert.match(status, /productCodeForms\(productCode\)/, 'statusAndDocNo 必须取两种形态')
  assert.match(status, /IN \(\?, \?\) AND ISNULL\(h\.asp_cancel,'N'\) <> 'Y'/, 'statusAndDocNo 的 SQL 必须是 IN (?, ?)')

  const node = region(rdDev, 'private Map<String, Object> nodeOf(String panelCode, String label, String productCode)')
  assert.match(node, /DevTaskService\.productCodeForms\(productCode\)/, 'nodeOf 必须取两种形态')
  assert.match(node, /AND h\.\[产品编号\] IN \(\?, \?\)/, 'nodeOf 的 SQL 必须是 IN (?, ?)')
})

test('产品信息表漂移提示:prodInfoNoOf 先还原再查(否则黄条永不出现)', () => {
  const body = region(btn, 'private String prodInfoNoOf(String productCode)')
  assert.match(body, /DevTaskService\.baseProductCode\(productCode\)/, 'prodInfoNoOf 必须还原')
})

test('四文件门禁仍是「未分发 ⇒ 只有管理员能编」的原口径(不能因为本修复放宽)', () => {
  const gate = region(btn, 'private DevFileEdit devFileEditVerdict(PanelRegistry.PanelDef def, String no, Map<String, Object> head, String user)', 3200)
  assert.match(gate, /if \(isAdminUser\(user\)\) return new DevFileEdit\(true, true/, '管理员兜底必须保留')
  assert.match(gate, /尚未分发责任人/, '未分发时的业务提示必须保留')
  assert.match(gate, /user\.equals\(owner\)/, '责任人判定不得改成前缀/模糊匹配')
})
