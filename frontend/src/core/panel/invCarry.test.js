import test from 'node:test'
import assert from 'node:assert/strict'
import { invRowsOf, pickInvCarry, pickInvKind, invCarryPair, invSearchRequest, INV_CARRY } from './invCarry.js'
import { invSearchOptions } from '../mold/recipeRows.js'

// 背景(2026-10-14 用户报障):
//   成型工艺清单「成型配方」页的 物料编号 / 物料名称 是普通文本、没配参照,
//   手输编码不带出名称、手输名称不带出编码。
//   数据源 = 商品档案 INV(表 bs_inv,列 存货编码 / 存货名称)。
//   口径(用户原话「输入物料编号无法自动录入对应物料名称…」):
//     · 双向;
//     · **只有唯一命中才带出**;查不到 / 查到多条 ⇒ 不带出(调用方保持用户输入不动、不弹错);
//     · 对照时按 trim 后的**全等**比 —— 后端 condition 对普通文本走 LIKE,前端必须自己收紧。

const archiveRes = (rows) => ({ totalSize: rows.length, list: [{ 编号: '商品', detail: { items: rows } }] })
/** 服务器的真实形状:档案面板明细键 = LOWER(panel_code) —— INV 挂在 detail.inv 下(2026-10-16 实测) */
const serverArchiveRes = (rows) => ({ totalSize: rows.length, list: [{ 编号: '商品', 状态: '启用', 单据状态: '已审核', detail: { inv: rows } }] })

test('档案响应(archive 单单据契约)拍平成行', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.deepEqual(rows, [{ 存货编码: 'M-001', 存货名称: '炭棒' }])
})

/**
 * 2026-10-16 服务器报障「成型工艺清单 → 配方计算 → 物料编号筛选没有出数据」的钉子。
 * 根因:`invRowsOf` 写死 `detail.items`,而**档案面板的明细键 = LOWER(panel_code)**
 *   —— 服务器 INV 的键是 `inv`(本地库 tab_key 为空才退化成 items,所以本地一切正常、上线恒空)。
 * 生产证据:服务器 `/px/queryFormDataList {panelCode:'INV', keyword:''}` → totalSize 3898、
 *   detail 下的键是 `inv`、`detail.items` 不存在 ⇒ 旧实现把**包装体**当行,存货编码取不到 ⇒ 零候选。
 */
test('服务器形状:明细键是 detail.inv(不是 items)也必须拍平成行', () => {
  const rows = invRowsOf(serverArchiveRes([
    { 存货编码: 'YJ-KBL-021', 存货名称: '折叠棉', 所属类别: '炭粉' },
    { 存货编码: 'YJ-XH-002', 存货名称: '鑫恒酸洗', 所属类别: '功能料-粉末' },
  ]))
  assert.equal(rows.length, 2, 'detail.inv 下的行必须被拍平(旧实现返回 1 个包装体 ⇒ 零候选)')
  assert.equal(rows[0]['存货编码'], 'YJ-KBL-021')
  // 带出与「按种类收窄」两条链都要能用(它们吃 invRowsOf 的产物)
  assert.equal(pickInvCarry(rows, '物料编号', 'YJ-KBL-021'), '折叠棉')
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-KBL-021', ''), '炭粉')
})

test('任何 detail 键(键名不认识时)也认得出来:取第一个数组值', () => {
  const rows = invRowsOf({ list: [{ detail: { 随便什么键: [{ 存货编码: 'A-1' }] } }] })
  assert.deepEqual(rows, [{ 存货编码: 'A-1' }])
})

test('档案响应形状不认识时返回空数组(不炸)', () => {
  assert.deepEqual(invRowsOf(null), [])
  assert.deepEqual(invRowsOf({}), [])
  assert.deepEqual(invRowsOf({ list: [] }), [])
})

// ⚠ 上面那支夹具是"合成形状"(detail.items),而**真实接口**对档案面板发的是
//   detail.<detail_key>(`QueryService.queryArchive` 写 `detail.<PanelDef.tabKey()>`,
//   档案面板 tabKey = LOWER(panel_code) ⇒ INV→detail.inv、EMP→detail.emp)。
//   本次事故正是被夹具形状骗过去的:实测本机 8090 /px/queryFormDataList(panelCode=INV)
//   返回 detail.inv[3898 行],旧逻辑(写死 detail.items)拍出来只有 1 行 = 那张虚拟单自己。
const archiveResReal = (rows, key = 'inv') => ({ totalSize: rows.length, list: [{ 编号: '商品档案', detail: { [key]: rows } }] })

test('真实形状:明细挂在 detail.<panel_code>(INV→detail.inv)也必须拍平', () => {
  const rows = invRowsOf(archiveResReal([
    { 存货编码: 'YJ-YKRS-001', 存货名称: '英克瑞斯椰壳炭', 所属类别: '炭粉' },
    { 存货编码: 'M-001', 存货名称: '炭棒', 所属类别: '折算物料' },
  ]))
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((r) => r['存货编码']), ['YJ-YKRS-001', 'M-001'])
})

test('键名不挑:detail 里第一个数组值的键都认得(EMP→emp、WHLOC→locations)', () => {
  assert.equal(invRowsOf({ list: [{ detail: { emp: [{ 存货编码: 'E1' }] } }] }).length, 1)
  assert.equal(invRowsOf({ list: [{ detail: { locations: [{ 存货编码: 'L1' }] } }] }).length, 1)
})

test('detail 里那个键在、但是空数组 ⇒ 一行都没有(虚拟单本身不算行)', () => {
  assert.deepEqual(invRowsOf({ list: [{ 编号: '商品档案', detail: { inv: [] } }] }), [])
})

test('没有 detail 的平表/裸行数组照旧当行(修复不丢兜底)', () => {
  assert.equal(invRowsOf({ list: [{ 存货编码: 'X1' }] }).length, 1)
  assert.equal(invRowsOf([{ 存货编码: 'Y1' }]).length, 1)
})

test('真实形状下「按种类收窄」能出候选(本次报障的端到端判据)', () => {
  const rows = invRowsOf(archiveResReal([
    { 存货编码: 'YJ-YKRS-001', 所属类别: '炭粉' },
    { 存货编码: 'YJ-GF-001', 所属类别: '胶粉' },
  ]))
  const hits = rows.filter((r) => String(r['所属类别'] ?? '').trim() === '炭粉')
  assert.equal(hits.length, 1)
  assert.equal(hits[0]['存货编码'], 'YJ-YKRS-001')
})

test('物料编号 → 物料名称:唯一命中才带出', () => {
  const rows = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-003', 存货名称: '炭纤维' },
  ]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-001'), '炭棒')
  assert.equal(pickInvCarry(rows, '物料编号', 'M-003'), '炭纤维')
})

test('物料名称 → 物料编号:反方向同样唯一命中才带出', () => {
  const rows = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-003', 存货名称: '炭纤维' },
  ]))
  assert.equal(pickInvCarry(rows, '物料名称', '炭纤维'), 'M-003')
})

test('查不到(编码还没建档)⇒ 返回空串,调用方保持用户输入不动', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-999'), '')
})

test('命中多条(同名/重复编码)⇒ 返回空串,不猜', () => {
  const dup = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-001', 存货名称: '炭棒(旧)' },
  ]))
  assert.equal(pickInvCarry(dup, '物料编号', 'M-001'), '')
  const dupName = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-002', 存货名称: '炭棒' },
  ]))
  assert.equal(pickInvCarry(dupName, '物料名称', '炭棒'), '')
})

test('用户输入为空/纯空格 ⇒ 不带出(也不发查询)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.equal(pickInvCarry(rows, '物料编号', ''), '')
  assert.equal(pickInvCarry(rows, '物料编号', '   '), '')
  assert.equal(pickInvCarry(rows, '物料编号', null), '')
})

test('前后空格与档案列的尾随空格都按 trim 后全等比(bs_inv 是 nchar/手工导入)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001 ', 存货名称: ' 炭棒' }]))
  assert.equal(pickInvCarry(rows, '物料编号', ' M-001'), '炭棒')
})

test('子串不算命中(LIKE 会串码,前端必须收紧成全等)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'XM-001', 存货名称: '别的' }]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-001'), '')
})

test('档案里对侧列为空 ⇒ 不带出(不写空值把用户已有内容抹掉)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '' }]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-001'), '')
})

test('非这两个列(别的明细列)一律不参与', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.equal(pickInvCarry(rows, '实际添加比例', 'M-001'), '')
  assert.equal(pickInvCarry(rows, '物料种类', '炭棒'), '')
})

test('列映射口径钉死:明细列 ↔ 商品档案列(含种类带出源 所属类别)', () => {
  assert.deepEqual(INV_CARRY, {
    物料编号: { match: '存货编码', out: '存货名称', kind: '所属类别' },
    物料名称: { match: '存货名称', out: '存货编码', kind: '所属类别' },
  })
})

/* ── 物料编号「边填边模糊筛」(2026-10-16 用户口径)─────────────────────────────
   原话:「物料编号可以在填写的时候模糊筛选下拉显示提供选择,比如 YJ-LL-003,
          可以在输入 Y 或者 003 时模糊搜索到含这些数字字母的」。
   服务端:`keyword` 是「本面板所有字段 LIKE %kw%」的 OR(QueryService.appendDirectFilters
   第 771 行),所以 003 / Y 都能命中 YJ-LL-003;空 keyword 等于不过滤 = 把整个档案
   (生产上几千行 × 113 列)拉回来 ⇒ 请求体干脆不给发。 */
test('档案模糊搜索请求:打字才发;空关键字/纯空格结构上就不给发', () => {
  assert.deepEqual(invSearchRequest('003'), { panelCode: 'INV', keyword: '003', condition: {}, pageNo: 1, pageSize: 50 })
  assert.deepEqual(invSearchRequest(' Y '), { panelCode: 'INV', keyword: 'Y', condition: {}, pageNo: 1, pageSize: 50 }, '去前后空格')
  assert.equal(invSearchRequest(''), null)
  assert.equal(invSearchRequest('   '), null)
  assert.equal(invSearchRequest(null), null)
  assert.equal(invSearchRequest(undefined), null)
})

test('用户的例子:输入 003 / Y 都能筛出 YJ-LL-003(子串,大小写无关)', () => {
  const rows = invRowsOf(archiveRes([
    { 存货编码: 'YJ-LL-003', 存货名称: '胶粉', 所属类别: '胶粉' },
    { 存货编码: 'YJ-SLD-012', 存货名称: '超高分子量聚乙烯', 所属类别: '胶粉' },
  ]))
  const q = (kw) => invSearchOptions(rows, '物料编号', kw).options.map((o) => o.value)
  assert.deepEqual(q('003'), ['YJ-LL-003'])
  assert.deepEqual(q('Y'), ['YJ-LL-003', 'YJ-SLD-012'])
  assert.deepEqual(q('yj-ll'), ['YJ-LL-003'], '小写照样命中')
  assert.deepEqual(q('12'), ['YJ-SLD-012'], '只记得数字也能找')
})

/* ── 物料种类也按档案带出(2026-10-16 用户口径)────────────────────────────────
   原话:「在成型工艺清单填写配方表的物料信息的时候,手动填写物料编码应该带出对应的物料类别
          以及物料名称,把填写框的物料种类的下拉框改为普通文本框」。
   实测(HSDZ_MES.bs_inv):YJ-LL-003 → 存货名称 胶粉、所属类别 胶粉;
                            YJ-SLD-012 → 超高分子量聚乙烯、所属类别 胶粉。
   页 2 配方表原先只带对侧那一格 ⇒ 物料名称 有值、物料种类 一直空着(用户截图即此),本次补上。 */
test('物料编号 → 物料种类:档案「所属类别」带出(两个方向都带)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'YJ-LL-003', 存货名称: '胶粉', 所属类别: '胶粉' }]))
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-LL-003', ''), '胶粉')
  assert.equal(pickInvKind(rows, '物料名称', '胶粉', ''), '胶粉', '按名称填的那一头同样带出')
})

test('档案类别引擎认不出来 ⇒ 不带出(带进去会让料位静默算错,见 materialKinds.js 注释)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'B-001', 存货名称: '纸箱', 所属类别: '包装材料' }]))
  assert.equal(pickInvKind(rows, '物料编号', 'B-001', ''), '')
})

test('种类这格人手填过就不动它;查不到/重码/空输入同样不动', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'YJ-LL-003', 存货名称: '胶粉', 所属类别: '胶粉' }]))
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-LL-003', '炭粉'), '', '人手填的种类优先,不许被档案覆盖')
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-LL-003', '  '), '胶粉', '空白(含纯空格)算没填')
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-999', ''), '')
  assert.equal(pickInvKind(rows, '物料编号', '', ''), '')
  const dup = invRowsOf(archiveRes([
    { 存货编码: 'YJ-LL-003', 存货名称: '胶粉', 所属类别: '胶粉' },
    { 存货编码: 'YJ-LL-003', 存货名称: '胶粉(旧)', 所属类别: '炭粉' },
  ]))
  assert.equal(pickInvKind(dup, '物料编号', 'YJ-LL-003', ''), '')
  assert.equal(pickInvKind(rows, '实际添加比例', 'YJ-LL-003', ''), '')
})

// 生效范围:只有**同一张明细表里这两列都在**才启用(库里实测只有成型工艺清单的配方表两列齐全),
// 别的明细表(组装 BOM 只有 物料编号、来料检验单只有 物料名称…)不受影响。
test('同一张表两列齐全 ⇒ 启用;缺一列 ⇒ 不启用', () => {
  assert.deepEqual(invCarryPair([{ key: '序号' }, { key: '物料编号' }, { key: '物料名称' }]),
    ['物料编号', '物料名称'])
  assert.equal(invCarryPair([{ key: '物料编号' }, { key: '物料规格' }]), null)
  assert.equal(invCarryPair([{ key: '物料名称' }]), null)
  assert.equal(invCarryPair([]), null)
  assert.equal(invCarryPair(null), null)
})
