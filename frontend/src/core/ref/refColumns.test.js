/**
 * refColumns.test.js —— 参照弹窗的列必须与它拿到的**行数据**同源(2026-10-30)
 *
 * 【需求来源·用户原文】
 *   「产品文件里面的面板点击选择框的弹窗都没有显示信息」
 *
 * 【根因】`engine.refColumns` 取的是 `panelPageDto.tablePages[0].gridTabs[0].columns` ——
 *   后端 PanelConfigService 那一行注释写得很清楚:**gridTabs = 明细列**(`fieldsAt("detail")`)。
 *   而参照弹窗的数据来自 `queryFormDataList`,返回的是**单据头行**(产品编号/产品名称/单据日期…)。
 *   ⇒ 列是「序号/物料编号/物料名称/尺寸规格/数量」(产品信息表 2026-10-29 新增的 BOM 明细列),
 *     数据却是表头行 ⇒ 每一格都取不到值,弹窗只剩一片空白(实测:只有前端造的「开发状态」有值)。
 *
 * 【正确来源】表头字段 = `dataSchema.fields`(buildMeta 里 `out.put("dataSchema", Map.of("fields", headerFields))`)。
 *   档案/平表类面板没有表头字段(全部字段直接作为网格列)⇒ 那时才退回 gridTabs。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { pickRefColumns } from './refColumns.js'

/** 造一份 buildMeta 形状的配置 */
const cfg = ({ head = null, grid = null } = {}) => ({
  dataSchema: head ? { fields: head.map((dataName) => ({ dataName, dataType: '文本' })) } : undefined,
  metadata: {
    panelPageDto: {
      tablePages: [{ gridTabs: grid ? [{ columns: grid }] : [] }],
    },
  },
})

test('① 有表头字段时用表头列，不用明细列（本次报障的根因）', () => {
  const c = cfg({
    head: ['产品编号', '产品名称', '单据日期'],
    grid: ['序号', '物料编号', '物料名称', '尺寸规格', '数量'],
  })
  assert.deepEqual(
    pickRefColumns(c, { refField: '产品编号', displayField: '产品名称' }),
    ['产品编号', '产品名称', '单据日期'],
    '参照弹窗拿到的是单据头行 ⇒ 列必须来自 dataSchema.fields；用明细列会整片空白',
  )
})

test('② 档案/平表面板没有表头字段 ⇒ 退回网格列（不能把列清空）', () => {
  const c = cfg({ head: [], grid: ['存货编码', '存货名称', '规格型号'] })
  assert.deepEqual(
    pickRefColumns(c, { refField: '存货编码', displayField: '存货名称' }),
    ['存货编码', '存货名称', '规格型号'],
  )
})

test('③ 字段自带 refColumns 时优先它（调用方显式指定列）', () => {
  const c = cfg({ head: ['产品编号'], grid: ['序号'] })
  assert.deepEqual(
    pickRefColumns(c, { refColumns: ['自定义A', '自定义B'], refField: '产品编号' }),
    ['自定义A', '自定义B'],
  )
})

test('④ 配置全空时退回 refField/displayField，至少能看见值', () => {
  assert.deepEqual(
    pickRefColumns({}, { refField: '产品编号', displayField: '产品名称' }),
    ['产品编号', '产品名称'],
  )
})

test('⑤ 表头字段里的空值/重复要滤掉（否则弹窗出现空列名）', () => {
  const c = cfg({ head: ['产品编号', '', '产品编号', '   ', '产品名称'] })
  assert.deepEqual(pickRefColumns(c, {}), ['产品编号', '产品名称'])
})

test('⑥ hidden 字段不进弹窗（字段管理里藏起来的列，别在参照里冒出来）', () => {
  const c = {
    dataSchema: {
      fields: [
        { dataName: '单据编号' },
        { dataName: '产品类型', hidden: true },
        { dataName: '产品编号' },
      ],
    },
    metadata: { panelPageDto: { tablePages: [{ gridTabs: [] }] } },
  }
  assert.deepEqual(pickRefColumns(c, { refField: '产品编号' }), ['产品编号', '单据编号'])
})

test('⑦ refField / displayField 提到最前（弹窗 880px，关键列不能压在横向滚动深处）', () => {
  const c = cfg({ head: ['单据编号', '单据日期', '产品编号', '项目编号', '产品名称'] })
  assert.deepEqual(
    pickRefColumns(c, { refField: '产品编号', displayField: '产品名称' }),
    ['产品编号', '产品名称', '单据编号', '单据日期', '项目编号'],
    '选一行时最需要的是「编号 + 名称」，必须第一屏可见',
  )
})
