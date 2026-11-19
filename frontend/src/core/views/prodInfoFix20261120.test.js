/**
 * prodInfoFix20261120.test.js — 产品信息表（RD_PROD_INFO）三处已上线问题的回归钉
 *
 * 【用户截图确认的三处】
 *   ① 纸面上仍有红色必填星号（产品编号*、客户名称*、客户料号*、产品管控等级*……）；
 *   ② 「审核人（一级审核）」格仍显示陈秀丽（老单据/草稿也显示），
 *      用户口径「审批之后才有对应审批人的名字」（2026-11-19 原话）；
 *   ③ 版式：「客户料号」单独占一行、「应用场景」与「产品形态」同一行；
 *      用户要求「应用场景单独一行」、客户料号不要独占一行。
 *
 * 【本测试守的四条】
 *   1. 必填红星：只对 RD_PROD_INFO 关掉（面板级 hideRequiredMark），其它面板照旧；
 *      保存/提交的必填校验（PanelxList.validateInlineDraft + 后端 ensureRequiredFilled）不动。
 *   2. 版式：应用场景独占一行（vspan:3）、客户料号与产品管控等级配对、每行占满 4 列。
 *   3. 审批人显示门禁：未审批（草稿/审批中）**不显示**，一级通过后显示一级、二级通过后显示二级。
 *   4. 值来源：docDefaults 空 + 迁移清 yj_panel.config.headDefaults + 清未审批存量签名；
 *      审批动作写回（writeBackL1Approver / writeBackL2Approver），保存剥离入参防回写。
 *
 * 运行：cd frontend && ~/.local/node/bin/node --test src/core/views/prodInfoFix20261120.test.js
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'
import { signoffVisible, signoffPaperText } from '../panel/paperSignoff.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const cfg = recordSheetConfigs.RD_PROD_INFO
const basic = (cfg.sections || []).find((s) => s.bar === '一、产品基本信息')

test('① 纸面不画必填红星：面板级 hideRequiredMark，只影响 RD_PROD_INFO', () => {
  assert.equal(cfg.hideRequiredMark, true, 'RD_PROD_INFO 必须声明 hideRequiredMark:true')
  const leaked = Object.entries(recordSheetConfigs)
    .filter(([code, c]) => code !== 'RD_PROD_INFO' && c?.hideRequiredMark === true)
    .map(([code]) => code)
  assert.deepEqual(leaked, [], '不得把 hideRequiredMark 扩散到其它面板')

  const sheet = read('./RecordSheetPanels.vue')
  assert.match(sheet, /if \(cfg\.value\?\.hideRequiredMark === true\) return false/,
    'isReq 必须读面板开关后才去查 isRequired（否则配置声明了也不生效）')
  // 全局星号样式保留：2026-11-17 用户要求过「必填要标红」，本次只是产品信息表例外。
  assert.match(sheet, /\.rs-req::after \{[\s\S]{0,80}content: '\*'/, '其它面板的 .rs-req 红星样式必须保留')
  // 必填校验不能跟着删（用户口径：只是不画星，保存时仍拦）
  const list = read('./PanelxList.vue')
  assert.match(list, /field\.isRequired && emptyFieldValue/, '表头必填校验必须保留')
  assert.match(list, /promptMissingRequired\(pre, validation\)/, '必填缺失弹窗必须保留')
})

test('③ 版式：应用场景独占一行，客户料号与产品管控等级配对，每行占满 4 列', () => {
  assert.ok(basic, '缺「一、产品基本信息」')
  const rows = basic.rows.map((r) => (r.pairs || []).map((p) => p.key))
  assert.deepEqual(rows, [
    ['立项编号', '立项名称'],
    ['产品编号', '客户名称'],
    ['客户料号', '产品管控等级'],
    ['产品功能类别', '产品形态'],
    ['应用场景'],
  ], '行序/配对必须符合 2026-11-20 版式')

  const sceneRow = basic.rows.find((r) => (r.pairs || []).some((p) => p.key === '应用场景'))
  assert.equal((sceneRow.pairs || []).length, 1, '应用场景必须独占一行')
  assert.equal(sceneRow.pairs[0].vspan, 3, '应用场景整行：标签 1 + 值 3 = 4 列')

  const partRow = basic.rows.find((r) => (r.pairs || []).some((p) => p.key === '客户料号'))
  assert.equal((partRow.pairs || []).length, 2, '客户料号不得单独占一行')
  assert.deepEqual(partRow.pairs.map((p) => p.key), ['客户料号', '产品管控等级'])

  // 网格合计宽度 + 每行列数：130+260+130+260 = 780；列占位 1+1+1+1（整行则 1+3）
  assert.equal((cfg.grid || []).reduce((s, w) => s + w, 0), 780, '纸面网格宽度必须 = 780px')
  const nCols = cfg.grid.length
  const spans = basic.rows.map((row) => (row.pairs || []).reduce((sum, p) => {
    const label = p.lspan || 1
    const value = p.cells ? (p.cells.length - 1) + (p.vspan || 1) : (p.vspan || 1)
    return sum + label + value
  }, 0))
  assert.deepEqual(spans, [nCols, nCols, nCols, nCols, nCols], `每行列占位必须 = ${nCols}（实测 ${spans.join('/')}）`)
})

test('② 审批人纸面门禁：未审批不显示，一级/二级分别到点才显示', () => {
  const gate = cfg.signoffVisibility || {}
  assert.deepEqual(Object.keys(gate).sort(), ['审核人（一级审批人）', '审核人（二级审批人）'],
    '两级审批人必须都有显示门禁')
  assert.equal(signoffVisible(cfg, '审核人（一级审批人）', '草稿'), false)
  assert.equal(signoffVisible(cfg, '审核人（一级审批人）', '审批中'), false)
  assert.equal(signoffVisible(cfg, '审核人（一级审批人）', ''), false)
  assert.equal(signoffVisible(cfg, '审核人（一级审批人）', '待二级审批'), true, '一级通过后显示一级审批人')
  assert.equal(signoffVisible(cfg, '审核人（一级审批人）', '已审核'), true)
  assert.equal(signoffVisible(cfg, '审核人（一级审批人）', '已归档'), true)
  assert.equal(signoffVisible(cfg, '审核人（一级审批人）', '修改中'), true, '归档后申请修改，审批已完成，照常显示')

  assert.equal(signoffVisible(cfg, '审核人（二级审批人）', '待二级审批'), false, '二级还没签核，不提前显示')
  assert.equal(signoffVisible(cfg, '审核人（二级审批人）', '已审核'), true)
  assert.equal(signoffVisible(cfg, '审核人（二级审批人）', '已归档'), true)

  // 老单据里即使还带着历史值，未审批时纸面文本必须为空（不能靠"库里已经清了"单点保证）
  assert.equal(signoffPaperText(cfg, '审核人（一级审批人）', '陈秀丽', '草稿'), '')
  assert.equal(signoffPaperText(cfg, '审核人（一级审批人）', '陈秀丽', '审批中'), '')
  assert.equal(signoffPaperText(cfg, '审核人（一级审批人）', '陈秀丽', '已审核'), '陈秀丽')
  assert.equal(signoffPaperText(cfg, '审核人（二级审批人）', '陈秀丽', '待二级审批'), '')

  // 其它面板没有门禁 ⇒ 行为逐字不变
  assert.equal(signoffVisible(recordSheetConfigs.RD_ASM_PROC, '审核人', '草稿'), true)
  assert.equal(signoffVisible(null, '审核人（一级审批人）', '草稿'), true)

  const sheet = read('./RecordSheetPanels.vue')
  assert.match(sheet, /paperCellText\(pair\.key, head\[pair\.key\]\)/, '审批人值格必须走纸面门禁')
  assert.match(sheet, /String\(props\.head\?\.\['单据状态'\] \|\| ''\)/, '门禁状态取本单当前单据状态')
})

test('② 值来源：默认值清空 + headDefaults/存量清理迁移 + 审批动作写回 + 保存剥离', () => {
  const defaults = read('../panel/docDefaults.js')
  const at = defaults.indexOf('RD_PROD_INFO: [')
  const seg = defaults.slice(at, defaults.indexOf('\n  ],', at))
  assert.match(seg, /'审核人（一级审批人）',\s*''/, 'docDefaults 一级必须为空')
  assert.match(seg, /'审核人（二级审批人）',\s*''/, 'docDefaults 二级必须为空')

  const mig = read('../../../../tools/migrate-prodinfo-approver-no-default-20261120.sql')
  assert.match(mig, /JSON_MODIFY\(config, '\$\.headDefaults\."审核人（一级审批人）"', NULL\)/,
    '迁移必须删 headDefaults 的一级默认值键（只改 docDefaults 不够，后端 buildMeta 会下发它）')
  assert.match(mig, /JSON_MODIFY\(config, '\$\.headDefaults\."审核人（二级审批人）"', NULL\)/,
    '迁移必须删 headDefaults 的二级默认值键')
  assert.match(mig, /SET h\.审核人一级 = NULL[\s\S]{0,80}h\.审核人二级 = NULL/,
    '迁移必须清未审批单据的两级签名')
  assert.match(mig, /ISNULL\(s\.shr, N''\) = N''/, '已审批判据 = shr 非空（不能误清已审核/已归档）')
  assert.match(mig, /RAISERROR/, '迁移必须有自检')

  const migrations = read('../../../../tools/db-migrations.txt')
  assert.match(migrations, /migrate-prodinfo-approver-no-default-20261120\.sql/, '迁移必须登记进权威清单')

  const btn = read('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
  assert.match(btn, /private void writeBackL1Approver\(/, '一级审批通过要写真实审批人')
  assert.match(btn, /writeBackL1Approver\(def\.code\(\), no, operator\)/, '一级通过路径必须调用回填')
  assert.match(btn, /body\.remove\("审核人（一级审批人）"\)/, '保存入参必须剥离一级审批人（防旧页面回写）')
  assert.match(btn, /body\.remove\("审核人（二级审批人）"\)/, '保存入参必须剥离二级审批人（防旧页面回写）')
  assert.match(btn, /private void clearProdInfoApprovers\(/, '驳回/弃审要清审批人签名')
  assert.match(btn, /clearProdInfoApprovers\(def\.code\(\), no\)/, '驳回/弃审路径必须调用清理')
  // 部署时停在「待二级审批」的单被迁移清过 L1 ⇒ 二级通过时按 APPROVE_L1 留痕补写，不能永久空白
  assert.match(btn, /l1ApproverOf\(def\.code\(\), no\)[\s\S]{0,80}writeBackL1Approver\(def\.code\(\), no, l1\)/,
    '二级签核通过要按一级审批留痕补写一级审批人')
})
