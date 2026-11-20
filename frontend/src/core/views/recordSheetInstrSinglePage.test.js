/**
 * 仪器使用记录表(RD_INSTR_USE)回到**单页登记表** —— 2026-11-20 用户口径「不要这个页签」。
 *
 * 背景:2026-11-19 曾在本面板加过第 2 页签「使用记录汇总」(只读台账,走 /px/instrUseSummary);
 * 2026-11-20 用户口径改成「为当前的试验仪器记录表创建一个汇总表……汇总表实现可以参考样品检验汇总表」
 * + 追问落点后明确「不要这个页签」⇒ 页签、台账块、旧端点一并撤除,汇总改为独立页面
 * (views/modules/rd/InstrSummary.vue,页面级面板 INSTR_SUMMARY)。
 *
 * 本测试钉两件事:① 面板回到单页登记表(没有 pages/ledger,原有表格列一字不变);
 * ② 旧端点真的撤干净了(前端不再调用、后端不再有方法) —— 否则"删了页签但接口还在"
 * 会让下次搜索 /instrUseSummary 的人以为汇总还在面板里。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = recordSheetConfigs.RD_INSTR_USE
const page = readFileSync(new URL('../../views/modules/rd/InstrSummary.vue', import.meta.url), 'utf8')
const pxController = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java', import.meta.url), 'utf8')
const queryService = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')

test('RD_INSTR_USE 是单页登记表:没有 pages、没有 ledger 台账块', () => {
  assert.ok(cfg, 'RD_INSTR_USE 配置缺失')
  assert.equal(cfg.pages, undefined, '页签已撤除,不应再声明 pages')
  assert.equal(cfg.dataTables.length, 1, '只应保留登记表本身')
  const dt = cfg.dataTables[0]
  assert.equal(dt.page, undefined, '单页面板不需要 page 归属')
  assert.equal(dt.ledger, undefined, '台账块已撤除')
  assert.equal(cfg.headMode, 'plain', '版式不变:标题条 + 仪器名称/型号副标题')
  assert.equal(cfg.plainTitle, '实验室仪器使用记录表')
  assert.deepEqual(cfg.groupBy, { headKey: '仪器名称/型号', detailKey: '仪器归属' })
})

test('登记表的列与页脚须知一字不变(撤页签不碰纸面)', () => {
  const cols = cfg.dataTables[0].cols
  assert.deepEqual(cols.map((c) => c.label), [
    '使用日期', '起止时间', '仪器状态\n√/×', '是否内校\n√/-',
    '项目名称/内容', '用途', '样品数量', '使用人', '备注',
  ])
  // key 必须是 yj_field.label(库里是字面 `\n` 两字符,不是真换行),写 col_name 会取不到值
  assert.equal(cols[2].key, String.raw`仪器状态\n√/×`)
  assert.equal(cols[3].key, String.raw`是否内校\n√/-`)
  assert.match(cfg.dataTables[0].footerNote, /不进行使用登记人员/)
})

test('旧汇总端点已从前后端撤除,汇总只剩独立页面', () => {
  assert.doesNotMatch(pxController, /instrUseSummary/, 'PxController 不应再有旧汇总端点')
  assert.doesNotMatch(queryService, /instrUseSummary/, 'QueryService 不应再有旧汇总取数方法')
  assert.doesNotMatch(page, /instrUseSummary/, '新页面必须打专属接口 /px/instrSummary/*')
})
