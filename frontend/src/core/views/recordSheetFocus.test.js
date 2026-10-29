/**
 * 校验定位查表规则的回归闸(RecordSheetPanels.focusField 的翻页判据)。
 *
 * 用户报障(2026-10-13):「规格书第 4 个页签点保存 → 提示『名称不能为空』,而字段在第 1 个页签,
 * 用户不知道该回哪一页填」。要求:校验失败时自动翻到缺失字段所在页 + 高亮。
 * 本测试钉住「翻页判据」这一半(高亮那半是模板/CSS,node 里测不了)。
 *
 * 两条必须成立的判据:
 *  1. 按**数据键**找页 —— 纸面文案与键不同时(版  本 vs 版本 / 物料名称 vs 物料名 /
 *     封面右上角编号格 = coverDocNoKey「产品编号」,纸面没有这四个字)也能命中;
 *  2. 真实面板配置下,规格书那个「名称」**找不到任何一页** —— 这不是 bug 而是事实:
 *     yj_field 里「名称」required=1/place=header/visible=1,但 recordSheetConfigs.RD_SPEC_DOC
 *     的封面/章节/数据表**一处都没渲染它** ⇒ 前端再会跳也跳不过去(需纸面或元数据决策,
 *     见本文件末断言)。把这条事实钉住,免得后人以为"跳转没生效"又去改定位代码。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { pageOfKeyIn, pageOfLabelIn, pageOfBlock, missingKeyFromMessage } from './recordSheetFocus.js'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = {
  coverDocNoKey: '产品编号',
  cover: {
    fields: [{ label: '版  本', key: '版本' }, { label: '客户料号', key: '客户料号' }],
    sign: [{ label: '制订/日期', key: '制订日期' }],
  },
  sections: [
    { page: 0, bar: '1.适用范围', doc: true, rows: [{ label: '适用范围', key: '适用范围' }] },
    { page: 2, rows: [{ pairs: [
      { label: '产品类别', key: '产品类别' },
      { label: '产品形态', cells: [{ key: '产品形态' }, { key: '生产车间' }] },
    ] }]},
    { page: 3, bar: '2.炭棒处理要求', doc: true, rows: [{ label: '炭棒处理要求', key: '炭棒处理要求' }] },
  ],
  dataTables: [
    { page: 1, cols: [{ key: '更改内容', label: '更改内容' }] },
  ],
  tailSections: [{ page: 2, rows: [{ label: '配料要求', key: '配料要求' }] }],
  tailTables: [{ page: 0, cols: [{ key: '国家标准指标', label: '国家标准指标' }] }],
}

test('pageOfBlock: 未声明 page 即第 0 页', () => {
  assert.equal(pageOfBlock({}), 0)
  assert.equal(pageOfBlock(undefined), 0)
  assert.equal(pageOfBlock({ page: 3 }), 3)
})

test('pageOfKeyIn: 封面字段/签字栏/右上角编号格 = 第 0 页', () => {
  assert.equal(pageOfKeyIn(cfg, '版本'), 0, '键「版本」与纸面「版  本」不同,必须按键命中')
  assert.equal(pageOfKeyIn(cfg, '客户料号'), 0)
  assert.equal(pageOfKeyIn(cfg, '制订日期'), 0)
  assert.equal(pageOfKeyIn(cfg, '产品编号'), 0, 'coverDocNoKey 渲染在报告头,纸面无此文案')
})

test('pageOfKeyIn: 章节行 / pairs.cells / grid / 数据表列 / 表尾区 都按 page 归属', () => {
  assert.equal(pageOfKeyIn(cfg, '适用范围'), 0)
  assert.equal(pageOfKeyIn(cfg, '炭棒处理要求'), 3)
  assert.equal(pageOfKeyIn(cfg, '产品形态'), 2)
  assert.equal(pageOfKeyIn(cfg, '生产车间'), 2)
  assert.equal(pageOfKeyIn(cfg, '更改内容'), 1)
  assert.equal(pageOfKeyIn(cfg, '配料要求'), 2, 'tailSections')
  assert.equal(pageOfKeyIn(cfg, '国家标准指标'), 0, 'tailTables')
})

test('pageOfKeyIn: 找不到返回 -1(空键/空配置/未知键)', () => {
  assert.equal(pageOfKeyIn(cfg, '名称'), -1)
  assert.equal(pageOfKeyIn(cfg, ''), -1)
  assert.equal(pageOfKeyIn(cfg, '版  本'), -1, '纸面文案不是数据键,键判据必须落空')
  assert.equal(pageOfKeyIn(null, '版本'), -1)
})

test('pageOfLabelIn: 旧调用按纸面文案找页(返回 null 口径不变)', () => {
  assert.equal(pageOfLabelIn(cfg, '版  本'), 0)
  assert.equal(pageOfLabelIn(cfg, '炭棒处理要求'), 3)
  assert.equal(pageOfLabelIn(cfg, '更改内容'), 1)
  assert.equal(pageOfLabelIn(cfg, '不存在'), null)
})

test('规格书 RD_SPEC_DOC:必填的「名称」已上封面,能被定位到第 0 页(旧定位极限已解除)', () => {
  // 【历史】2026-10-13 ~ 2026-10-28:yj_field 里「名称」required=1,但纸面一处都没渲染它
  //   ⇒ 校验提示「名称不能为空」时前端翻不过去(本测试原先是把这个"找不到"当事实钉住的)。
  // 【2026-10-29】产品规格书新版设计把「产品名称」放上封面第 2 行(key = 名称)
  //   ⇒ 该字段现在**真的在纸面上**,定位必须命中第 0 页。反过来钉住:谁再把它从封面删掉,这里就红。
  const spec = recordSheetConfigs.RD_SPEC_DOC
  assert.equal(pageOfKeyIn(spec, '名称'), 0, '封面「产品名称」= 数据键 名称,应在第 0 页')
  assert.equal(pageOfLabelIn(spec, '产品名称'), 0, '纸面文案「产品名称」也要能找到页')
  // 同一面板里其它会被渲染的必填/常用字段也必须找得到页
  assert.equal(pageOfKeyIn(spec, '产品编号'), 0, '封面字段表第一行')
  assert.equal(pageOfKeyIn(spec, '客户料号'), 0)
  assert.equal(pageOfKeyIn(spec, '应用场景'), 0)
  assert.equal(pageOfKeyIn(spec, '更改内容'), 1)
  assert.equal(pageOfKeyIn(spec, '炭棒处理要求'), 3)
})

test('missingKeyFromMessage: 只认「<字段名>不能为空」,别的错误文案不许当字段名', () => {
  // 前端校验消息
  assert.equal(missingKeyFromMessage('名称不能为空'), '名称')
  assert.equal(missingKeyFromMessage('请至少添加一行明细'), '')
  // 后端 ButtonService:多字段用「、」分隔 ⇒ 取第一个
  assert.equal(missingKeyFromMessage('名称、版本不能为空'), '名称')
  // 后端明细行消息:剥掉「明细第 N 行」前缀后取字段名
  assert.equal(missingKeyFromMessage('明细第 2 行工序控制不能为空'), '工序控制')
  // 反面:字段名里含标点/空白/超长的不是字段名
  assert.equal(missingKeyFromMessage('模板内容(.jrxml)不能为空'), '')
  assert.equal(missingKeyFromMessage('用户名和密码不能为空'.replace('和', '、')), '用户名')
  assert.equal(missingKeyFromMessage(''), '')
  assert.equal(missingKeyFromMessage(undefined), '')
  // 前缀匹配(后端有「...不能为空(该仓库已启用仓位管理)」这种尾巴)
  assert.equal(missingKeyFromMessage('明细第 3 行仓位不能为空(该仓库已启用仓位管理)'), '仓位')
})

/**
 * 用户报障(2026-10-19):「出货检验计划表出现标题不能为空,但是未提示哪一个数据未填」。
 *
 * 真因不是提示文案,是**「标题」在纸面上根本没渲染**:RD_INSP_PLAN 的 recordSheetConfigs
 * 里 `titleKey` 没配(整份配置里「标题」二字出现 0 次),而 yj_field 里「标题」required=1。
 * 于是:①大标题格走静态分支,用户没有输入口;②保存校验必填永远失败;
 *      ③pageOfKeyIn 找不到页 ⇒ focusField 返回 false ⇒ 连高亮定位也没有。
 * 正确口径照 RD_CHANGE(立项申请):大标题格做成字段输入框,`titleKey = '标题'`。
 * 这条测试钉住「必填的大标题必须在纸面上可填、可定位」这一事实。
 */
test('RD_INSP_PLAN: 标题是必填字段,纸面必须给输入口且能定位(否则永远报「标题不能为空」)', () => {
  const cfg = recordSheetConfigs.RD_INSP_PLAN
  assert.equal(cfg.titleKey, '标题', '大标题格要绑「标题」字段(同 RD_CHANGE 口径)')
  assert.ok(cfg.titleKeyPh, '要有背景提示词,否则空标题时用户看不出这里是填标题的地方')
  assert.equal(pageOfKeyIn(cfg, '标题'), 0, '「标题」必须能定位到第 0 页(校验失败时要高亮它)')
})
