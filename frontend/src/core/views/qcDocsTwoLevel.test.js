/**
 * qcDocsTwoLevel.test.js —— 质量单据一族 2026-11-18 改造的**回归钉子**
 *
 * 用户口径(三条):
 *   ①「质量单据列的其余表单都是一样的模式进行改动,二级审批实现即可,不需要指定某个审批人」
 *     + 追问确认「责任部门改成责任人所属部门(动态)」、只做「基础同款」
 *   ②「紧急放行单的日期没有显示出来,会被遮挡」
 *   ③「当前的单据中存在提及可附图片的单据需要为当前这个地方增加上传附件的组件」
 *   ④「来料检验要求和来料检验系列中点击修改后,当前的表格会缩小成单行,显示的字数内容无法查看完全」
 *
 * 本文件钉住:6 张质量单据的信息表/日期自动/编码手输/附件位、DocSheet 的附件渲染、
 *            签名日期宽度、来料检验要求编辑态自适应高度。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { qcSheetCfgs } from './docSheetConfigs.js'

const VUE = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const REQ_SHEET = readFileSync(new URL('./QcInspReqSheet.vue', import.meta.url), 'utf8')
const JAVA = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const SQL = readFileSync(
  new URL('../../../../tools/migrate-qc-docs-twolevel-20261118.sql', import.meta.url), 'utf8')

/** 2026-11-18 改造的 6 张(紧急放行单 11-17 已改;QC_BHG 只做日期/编码口径,责任部门不动) */
const SIX = ['QC_BHG', 'QC_BHC', 'QC_BHZ', 'QC_SCP', 'QC_LYB', 'QC_SCY']
/** 责任部门 = 责任人所属部门 的 5 张(BHG 的「责任部门」是表头录入业务值,刻意不动) */
// 2026-11-24 新增《不合格品处理单(成品)》QC_BHCP:与制程单同形,责任部门同口径
const FIVE_DEPT = ['QC_BHC', 'QC_BHCP', 'QC_BHZ', 'QC_SCP', 'QC_LYB', 'QC_SCY']
/** 纸面写了「可附图片」的 4 张 */
const FOUR_ATTACH = ['QC_BHC', 'QC_BHZ', 'QC_SCP', 'QC_LYB']

test('① 责任部门 = 责任人所属部门(动态):5 张单右上信息表走同一份动态配置', () => {
  for (const code of FIVE_DEPT) {
    const info = qcSheetCfgs[code].info
    assert.deepEqual(info.map((i) => i.label), ['使用范围', '责任部门', '时间'], code)
    assert.equal(info[0].kind, 'static', `${code} 使用范围应为印刷值`)
    assert.equal(info[0].text, '公司内部', code)
    assert.equal(info[1].key, '责任部门', `${code} 责任部门必须是动态列`)
    assert.equal(info[1].kind, undefined, `${code} 责任部门不能写死成 static`)
    // 2026-11-23 用户口径「时间取填写提交日期」:QC_BHC 右上「时间」改绑后端派生只读「提交时间」
    // (= 提交审批时间戳，含时分)，别的单仍是单据日期。
    if (code === 'QC_BHC' || code === 'QC_BHCP') {
      assert.equal(info[2].key, '提交时间', code + ' 时间格必须绑提交时间')
      assert.equal(info[2].kind, 'head-static', 'QC_BHC 时间格是只读派生值')
    } else {
      assert.equal(info[2].key, '单据日期', code)
    }
  }
  // QC_BHG 保持「填写部门/填写人/填写日期」(它的责任部门是表头业务值)
  assert.deepEqual(qcSheetCfgs.QC_BHG.info.map((i) => i.label), ['填写部门', '填写人', '填写日期'])
  // 后端名单必须与前端一致,且只有这 6 张(含紧急放行单)
  const m = JAVA.match(/RESP_DEPT_PANELS\s*=\s*java\.util\.Set\.of\(([\s\S]*?)\);/)
  assert.ok(m, '缺少 RESP_DEPT_PANELS 登记')
  const list = [...m[1].matchAll(/"(QC_[A-Z_]+)"/g)].map((x) => x[1])
  assert.deepEqual(list.sort(), ['QC_BHC', 'QC_BHCP', 'QC_BHZ', 'QC_JJF', 'QC_LYB', 'QC_SCP', 'QC_SCY'])
  assert.ok(!list.includes('QC_BHG'), 'QC_BHG 的责任部门是业务值,不得进自动写入名单')
})

test('① 各章节「责任人/日期」:日期段绑单据日期(自动生成,纸面只读)', () => {
  for (const code of SIX) {
    const sections = qcSheetCfgs[code].rows.filter((r) => r.kind === 'section' && r.sign)
    assert.ok(sections.length > 0, `${code} 应至少有一个带签名的章节`)
    for (const row of sections) {
      assert.equal(row.dateKey, '单据日期', `${code}「${row.label}」的日期段必须绑单据日期`)
    }
  }
  // 「责任人」签名必须绑到责任人列(2026-11-18 实测:sign 写了「责任人」但缺 signKey 时
  // DocSheet 回落「填写人」⇒ 纸面签名行是空的,而表头明明有责任人姓名)
  // 2026-11-23 用户口径「这每个责任人都是不同的责任人，而不是作为同一个责任人」:
  //   QC_BHC 五处落款各绑独立列(迁移 migrate-qc-bhc-resp-per-section-20261123.sql)；
  //   QC_BHZ/QC_SCP 维持原口径(共用表头「责任人」)。
  const BHC_SIGN_KEYS = [
    '问题描述责任人', '原因分析责任人', '性能验证责任人', '处理意见责任人', '改善效果验证责任人',
  ]
  const bhcSigns = qcSheetCfgs.QC_BHC.rows
    .filter((r) => r.kind === 'section' && r.signKey)
    .map((r) => r.signKey)
  assert.deepEqual(bhcSigns, BHC_SIGN_KEYS, 'QC_BHC 五段责任人必须各绑独立列')
  assert.equal(new Set(bhcSigns).size, bhcSigns.length, 'QC_BHC 责任人列不得重复')
  for (const code of ['QC_BHZ', 'QC_SCP']) {
    for (const row of qcSheetCfgs[code].rows.filter((r) => r.kind === 'section' && r.sign === '责任人')) {
      assert.equal(row.signKey, '责任人', `${code}「${row.label}」的签名键必须显式写责任人`)
    }
  }
  // 元数据侧:这 6 张的单据日期必须只读(否则「日期自动生成」变回可手填)
  assert.match(SQL, /UPDATE yj_field\s+SET editable = 0\s+WHERE panel_code IN \(N'QC_BHG', N'QC_BHC', N'QC_BHZ', N'QC_SCP', N'QC_LYB', N'QC_SCY'\)\s+AND label = N'单据日期'/)
})

test('① 编码列改「手动录入」:参照源全清(5 个字段)', () => {
  const expect = [
    ['QC_BHC', '产品编码'], ['QC_BHZ', '物料编码'], ['QC_SCP', '物料编码'],
    ['QC_LYB', '物料编码'], ['QC_SCY', '产品/物料编码'],
  ]
  for (const [panel, label] of expect) {
    assert.ok(SQL.includes(`(N'${panel}', N'${label}')`), `迁移未登记 ${panel}.${label}`)
  }
  assert.match(SQL, /SET data_type = N'文本', ref_panel = NULL, ref_field = NULL, display_field = NULL/)
})

test('③ 「可附图片」章节挂附件:前端 attach 配置 + DocSheet 渲染 + 迁移补列', () => {
  for (const code of FOUR_ATTACH) {
    const sec = qcSheetCfgs[code].rows.find((r) => r.kind === 'section' && String(r.label).includes('可附图片'))
    assert.ok(sec, `${code} 缺少「可附图片」章节`)
    assert.equal(sec.attach, '附件', `${code}「可附图片」章节必须挂附件位(field key=附件)`)
  }
  // DocSheet:章节行内渲染 FileAttachCell(锚点=面板+单据编号+字段键),只读态也渲染(可点开查看)
  assert.match(VUE, /<FileAttachCell\s+v-if="row\.attach"/)
  assert.match(VUE, /:field-key="row\.attach"/)
  assert.match(VUE, /:can-edit="!!editable && !!head\['单据编号'\]"/)
  // 迁移:4 张单补 [附件] 列 + 登记 data_type=附件(服务端 syncHeadField 要求登记过才同步文件名)
  assert.match(SQL, /\(N'qc_bhc', N'QC_BHC'\), \(N'qc_bhz', N'QC_BHZ'\)/)
  assert.match(SQL, /VALUES \(@ap, N'附件', N'附件', N'附件', N'header', 990/)
})

test('② 签名日期不再被遮挡:年/月/日三格够宽 + 日期段禁止收缩换行', () => {
  const dy = VUE.match(/\.q-date-in\.q-dy\s*\{\s*width:\s*(\d+)px;\s*\}/)
  assert.ok(dy, '缺少 .q-date-in.q-dy 规则')
  assert.equal(dy[1], '66', '年份格必须能放下 4 位数字')
  const dm = VUE.match(/\.q-date-in\.q-dm,\s*\n\s*\.q-date-in\.q-dy\s*\{([\s\S]*?)\}/)
  assert.ok(dm, '缺少 月/日 宽度规则')
  assert.match(dm[1], /width:\s*42px/)
  const sd = VUE.match(/\.q-sign-date\s*\{([\s\S]*?)\}/)
  assert.match(sd[1], /flex:\s*none/, '日期段不许被压缩')
  assert.match(sd[1], /white-space:\s*nowrap/, '日期段不许折行吃字')
})

test('④ 来料检验要求/系列:编辑态用自适应文本域,不再塌成单行', () => {
  assert.match(REQ_SHEET, /v-if="editable && isEditing\(row\)"[\s\S]{0,220}type="textarea"/,
    '编辑态输入必须是 textarea(单行 input 会把整行压成一行高)')
  assert.match(REQ_SHEET, /:autosize="\{ minRows: 1, maxRows: 30 \}"/, '文本域必须按内容自适应高度')
  assert.match(REQ_SHEET, /\.rs-c-area :deep\(\.el-textarea__inner\)/, '缺少编辑态文本域样式(行距/边距对齐只读态)')
})
