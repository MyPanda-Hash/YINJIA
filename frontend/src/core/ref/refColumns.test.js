/**
 * refColumns.test.js —— 参照弹窗的列必须与它拿到的**行数据**同源
 *
 * 【需求来源·用户原文·2026-10-30】
 *   「产品文件里面的面板点击选择框的弹窗都没有显示信息」
 * 【根因】`engine.refColumns` 取的是 `panelPageDto.tablePages[0].gridTabs[0].columns` ——
 *   后端 PanelConfigService 那一行注释写得很清楚:**gridTabs = 明细列**(`fieldsAt("detail")`)。
 *   而参照弹窗的数据来自 `queryFormDataList`,返回的是**单据头行**(产品编号/产品名称/单据日期…)。
 *   ⇒ 列是「序号/物料编号/物料名称/尺寸规格/数量」,数据却是表头行 ⇒ 每格都取不到值。
 * 【正确来源】表头字段 = `dataSchema.fields`(buildDocConfig 的 headerFields)。
 *
 * 【需求来源·用户原文·2026-11-01】
 *   「当前工序报工单的选择为什么会这样，只有备注列」
 * 【根因·上一版修复的漏网】判据「优先 dataSchema.fields」当时是**无条件**的,但**基础档案(archive)**
 *   面板的 dataSchema 按规范 §八 恒为占位 `[{dataName:'备注',dataType:'文本'}]`
 *   (PanelConfigService.buildArchiveConfig),业务字段全在 detail 网格列;而参照行是
 *   `engine.queryRefRows` 的 singleDoc 分支**展平后的明细行** ⇒ 只剩一列「备注」且全空
 *   (实测 OP 面板:dataSchema=[备注]、gridTabs=15 列、展平行 10 行且不含「备注」键)。
 * 【正确口径】`metadata.singleDoc === true` 的面板(档案 + 项目进度这类单单据面板)行是明细行
 *   ⇒ 取网格列;普通单据面板才取 dataSchema 表头字段。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { pickRefColumns } from './refColumns.js'

/** 造一份 buildMeta 形状的配置(singleDoc=true 的形态与后端 archive/singleDoc 面板一致) */
const cfg = ({ head = null, grid = null, singleDoc = false } = {}) => ({
  dataSchema: head ? { fields: head.map((dataName) => ({ dataName, dataType: '文本' })) } : undefined,
  metadata: {
    singleDoc,
    panelPageDto: {
      tablePages: [{ gridTabs: grid ? [{ columns: grid }] : [] }],
    },
  },
})

test('① 普通单据面板:有表头字段时用表头列，不用明细列（2026-10-30 报障的根因）', () => {
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

test('② 档案(archive)面板真实形态:dataSchema 是占位「备注」+ singleDoc ⇒ 取网格列', () => {
  // 2026-11-01 实测 getPanelConfig(OP) 原样:dataSchema=[{dataName:'备注'}]、singleDoc=true、
  // gridTabs[0].columns = 15 个业务字段,而参照行是展平后的 bs_op 明细行(10 行,不含「备注」键)。
  const grid = [
    '工序编码', '工序名称', '默认车间', '关键工序', '加工方式', '标准合格率%', '按辅单位计价',
    '辅单位', '换算率', '默认工资类型', '计件依据', '是否停用', '标准工时(分钟)', '工序类型', '检验要求',
  ]
  assert.deepEqual(
    pickRefColumns(cfg({ head: ['备注'], singleDoc: true, grid }), { refField: '工序编码', displayField: '工序名称' }),
    grid,
    '档案面板的 dataSchema 恒为占位「备注」⇒ 用它当列会把参照弹窗压成只剩一列「备注」全空',
  )
})

test('③ 单单据单据面板(项目进度/检验目录):行是展平明细行 ⇒ 也取网格列，不取表头', () => {
  const c = cfg({
    head: ['单据编号', '项目名称', '备注'],
    singleDoc: true,
    grid: ['序号', '项目编号', '产品编码', '工序', '计划量'],
  })
  assert.deepEqual(
    pickRefColumns(c, { refField: '项目编号', displayField: '产品编码' }),
    ['项目编号', '产品编码', '序号', '工序', '计划量'],
  )
})

test('④ 档案/平表面板没有表头字段 ⇒ 退回网格列（不能把列清空）', () => {
  const c = cfg({ head: [], grid: ['存货编码', '存货名称', '规格型号'] })
  assert.deepEqual(
    pickRefColumns(c, { refField: '存货编码', displayField: '存货名称' }),
    ['存货编码', '存货名称', '规格型号'],
  )
})

test('⑤ 字段自带 refColumns 时优先它（调用方显式指定列）', () => {
  const c = cfg({ head: ['产品编号'], grid: ['序号'] })
  assert.deepEqual(
    pickRefColumns(c, { refColumns: ['自定义A', '自定义B'], refField: '产品编号' }),
    ['自定义A', '自定义B'],
  )
})

test('⑥ 配置全空时退回 refField/displayField，至少能看见值', () => {
  assert.deepEqual(
    pickRefColumns({}, { refField: '产品编号', displayField: '产品名称' }),
    ['产品编号', '产品名称'],
  )
})

test('⑦ 表头字段里的空值/重复要滤掉（否则弹窗出现空列名）', () => {
  const c = cfg({ head: ['产品编号', '', '产品编号', '   ', '产品名称'] })
  assert.deepEqual(pickRefColumns(c, {}), ['产品编号', '产品名称'])
})

test('⑧ hidden 字段不进弹窗（字段管理里藏起来的列，别在参照里冒出来）', () => {
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

test('⑨ refField / displayField 提到最前（弹窗 880px，关键列不能压在横向滚动深处）', () => {
  const c = cfg({ head: ['单据编号', '单据日期', '产品编号', '项目编号', '产品名称'] })
  assert.deepEqual(
    pickRefColumns(c, { refField: '产品编号', displayField: '产品名称' }),
    ['产品编号', '产品名称', '单据编号', '单据日期', '项目编号'],
    '选一行时最需要的是「编号 + 名称」，必须第一屏可见',
  )
})
