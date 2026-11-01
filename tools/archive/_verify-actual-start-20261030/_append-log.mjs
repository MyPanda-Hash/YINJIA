// 追加维护记录行(v3.74)到 docs/development/数据库表清单.md —— 用 node 写,避免 PowerShell 按行折行破坏表格
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'docs/development/数据库表清单.md'
const row = [
  '| v3.74 | 2026-10-30 |',
  '**修「未排产就有实际开工日期」+ 删除「按日期均摊」+ 日期列收口**',
  '(用户报障「未进行排产就已经有实际开工日期,当前的实际排产日期是怎么出现的?当前工单创建日期为10-30却出现了当前的这个10-20号,把当前这个按日期均摊的功能删除,没啥用」;无表结构变更)。',
  '① **根因(正式库实测取证)**:订单结转 `QuickScheduleService.scheduleOne → ProcessTaskService.ensureLedgerForWorkOrder` 建工序台账时把首道写成「已落实」,并**顺手把 落实时间 写成 `new java.util.Date()`(JVM 本地时间)**;',
  '排产 `preplanManual` 同样写当时时刻 ⇒ 工单刚建、一条报工都没有,弹窗「实际开工」却已有值(实测 GD-2026-10-0229:pl_date 03:22:20 / 落实时间 11:22:20,两者还差 8 小时 —— 库 GETDATE() 是 UTC)。',
  '② **修法**:两处一律写 NULL 落实时间;「实际开工」改为**按报工事实取该道已审核报工的最早时间**(`MIN(COALESCE(scjl.kssj,wgsj,sc_date))`,锚定口径同 `WoInspGate`/`reportedDoneTime`)',
  '⇒ 没报工就显示「-」,存量脏时间也被自动盖掉(不需要改库);「实际完工」仍是该道报工最大完工时间。',
  '③ **删除「按日期均摊」**(用户口径「没啥用」):前端删 `DayPlanSplitDialog.vue` + 两页的按钮与 `openDpSplit`/`applySplit` + `business/dayPlan.js` 的 `buildSplit` 及对应单测;',
  '后端删 `ProcessTaskService.autoFillDayPlan`(排线保存时按计划区间自动铺 `wo_day_plan`)⇒ 日计划**只由用户在日期列手工填 + 「保存日排产」**产生。',
  '④ **日期列收口**:`WorkOrderDayPlanService.buildDates` 原是整表所有行日期的并集 ⇒ 别的工单一条 10-20 历史日计划就给 10-30 新建的工单长出 10-20 空列;',
  '现改为**今天以前且当天无已审报工的日期不出列**(有报工的历史日期仍显示,可对照完成量)。',
  '⑤ **验证**:`mvn -o compile`、`npm run build` 通过;`node --test src/business/dayPlan.test.js` 3/3;',
  '8090 重打包重启后只读接口复核(`tools/archive/_verify-actual-start-20261030/verify.mjs`):',
  'GD-2026-10-0229 四道「实际开工/实际完工」全 `-`;行id 2177 日期列 `[]`(不再有 10-20);行id 1168(有 10-20 报工)日期列 `[2026-10-20]` 保留;行id 2172 日期列 `[2026-10-30,2026-10-31]`;',
  '下发的前端 chunk `WorkOrderList-*.js`/`WorkOrderBoard-*.js` 已无 `按完工日期均摊`/`DayPlanSplitDialog`。',
  '⚠ 本行手写(生成器会覆盖维护记录,理由同 v3.31) |',
].join('')

const raw = readFileSync(p, 'utf8')
const out = raw.replace(/\r\n/g, '\n').replace(/\n*$/, '\n') + row + '\n'
writeFileSync(p, out, 'utf8')
console.log('appended, lines now =', out.split('\n').length)
