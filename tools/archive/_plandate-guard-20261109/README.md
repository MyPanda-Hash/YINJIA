# 计划开工日期不得晚于计划完工日期(2026-11-09)

用户报障(批量排产弹窗截图):**计划开工日期 2026-11-09 / 计划完工日期 2026-11-03** —— 开工晚于完工,
弹窗仍照常显示。要求「增加校验实现,让当前的开工日期不得大于完工日期」。

## 1. 根因

日期链纯逻辑在 `frontend/src/business/planChain.js`(单行「工序路线排线」`ProcessRoutePlanDialog`
与「批量排产」`ScheduleBatchDialog` 共用一份):

- `cascadeStart`(改**开工**日)原来就有「开工晚于本道完工 ⇒ 完工拉到开工」;
- `cascadeDue`(改**完工**日)**只处理下一道**(下一道开工 = 本道完工),**没有回看被改的那一道自己**。

于是「把第 1 道的完工日改到早于它自己的开工日」会留下倒挂:

| 操作 | 结果 |
|---|---|
| 打开弹窗(默认) | 三道都是 2026-11-09(首道=今天,后续=上一道完工) |
| 把第 1 道完工改 2026-11-03 | 第 1 道 = **开工 11-09 / 完工 11-03**(没管自己);第 2、3 道开工被链带成 11-03 |

这正是用户截图里的形态(首道 11-09~11-03,后两道 11-03~11-03)。
`normalizePlanChain` 只在**打开时**收口,改日期时没有再过一遍,所以提交前一直是倒挂的。

## 2. 修复(三层,全部落地)

1. **改日期即调平**(`planChain.js`,两个弹窗共用):
   - `cascadeDue`:改完工日若早于**本道**开工日 ⇒ 本道开工一起降到完工日,再沿链下传;
     返回被调平的开工日,弹窗据此弹提示「计划开工日期不能晚于计划完工日期，已自动把开工日期调为 …」。
   - `cascadeStart`:开工晚于本道完工 ⇒ 完工拉到开工日(原行为),同样把自动调整提示出来。
   - 新增 `isPlanDateInverted(row)` / `invertedPlanRows(rows)`:倒挂判定(空值不算错;兼容
     `2026-11-03T00:00:00` 这类 datetime 串,按日期部分比)。
2. **提交前硬校验**(`ScheduleBatchDialog` / `ProcessRoutePlanDialog`):提交时若有倒挂行,
   点名单(工序 + 开工 → 完工)并**拦下**,不发请求(兜住粘贴/程序改值等任何绕过路径)。
   `ScheduleQuickEditDialog`(排产快速调整,改计划开工日/预定完成日期)也加了同一句前置校验
   —— 只在**本次改了日期**时才判,历史脏数据不会连带把「只改数量」也拦住。
3. **后端守卫**(`ProcessTaskService.preplanManual`,服务端真源):
   - 客户端**明确给了**「计划开工日期 + 计划完工日期」却倒挂 ⇒ `400`
     `工序「成型」计划开工日期不能晚于计划完工日期(2026-11-09 → 2026-11-03)`;
   - 只判「两个都给且倒挂」这一种:客户端没给日期时完工日会回落到**交期**(可能早于计划链开工,
     逾期工单就是这种),那是派生出来的不一致,仍按原口径顺延,不能拒(否则逾期单排不进去)。
   - `/rowDates`(双击日期格改开工/交期)原有 `预定完成日期不能早于计划开工日期` 守卫不变。

## 3. 验证证据(全部为本机新 jar:8090 + ego 浏览器)

- 单测:`node frontend/src/business/planChain.test.js` → **6/6 pass**
  (新增「改完工日早于本道开工 ⇒ 开工降到完工日」= 用户截图场景、倒挂判定边界)。
- 前端全量:`npm run build` 通过;`mvn clean package` 通过(fat jar `BOOT-INF/lib = 129`)。
- 界面(ego,截图见 `ego-shots/`):
  - `round-11-final-zh.png`(**最终中文证据**):批量排产里把第 1 道完工改 2026-11-03 →
    提示「计划开工日期不能晚于计划完工日期，已把开工日期调为 2026-11-03」,
    三道全部 11-03~11-03,**无倒挂**;
  - `round-08-start-later-than-due.png`:把第 1 道开工改 2026-12-01 → 完工被推到 2026-12-01 并沿链下传;
  - `round-09-single-route-dialog.png`:单行「工序路线排线」同一套日期链同样调平 + 提示;
  - `round-10-en-toast.png`(**最终英文证据**):切 **en** 走同一操作,提示为英文整句
    `Planned start cannot be later than planned finish; planned start adjusted to 2026-11-03`
    (多语言规范:新增 UI 文案必须带译名);
  - `round-03-due-earlier-than-start.png`:同一场景的早期版本(拼接话术时期),留作对照。
  - 以上各轮都**没有点提交**,不产生业务数据(只打开弹窗、改日期、截图、关弹窗)。
  - 三轮都**没有点提交**,不产生业务数据(只打开弹窗、改日期、截图)。
- 后端守卫(测试账套 `YJ_TEST`,只读探针 `round-06.mjs`):首道用合法产线 + 故意倒挂
  `2026-11-09 / 2026-11-03` ⇒
  `400 {"message":"工序「成型」计划开工日期不能晚于计划完工日期(2026-11-09 → 2026-11-03)"}`。
  该守卫在写 `plang`/`wo_process_line` 之前触发,请求不落库。

## 4. 复跑方式

```powershell
# 单测
node frontend\src\business\planChain.test.js
# 界面(需 8090 在跑:tools\scripts\start-prod.ps1)
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-scripts/round-03.mjs')"
# 后端守卫探针
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-scripts/round-06.mjs')"
```

## 5. 文件清单

| 文件 | 改动 |
|---|---|
| `frontend/src/business/planChain.js` | `cascadeDue` 回拉本道开工;两个 cascade 返回「被调平的那个日期」;新增 `isPlanDateInverted` / `invertedPlanRows`;`ymd` 统一日期部分 |
| `frontend/src/business/planChain.test.js` | 增补 3 组用例(截图场景 / 倒挂判定 / cascade 返回值) |
| `frontend/src/views/modules/plan/ScheduleBatchDialog.vue` | 改日期提示 + 提交前倒挂硬校验 |
| `frontend/src/views/modules/plan/ProcessRoutePlanDialog.vue` | 同上(单行排线) |
| `frontend/src/views/modules/plan/ScheduleQuickEditDialog.vue` | 保存前「计划开工 ≤ 预定完成」前置校验 |
| `backend/.../service/ProcessTaskService.java` | `preplanManual` 增加倒挂守卫 + 日期格式提示 |
| `frontend/src/i18n/locales/*.js`(10 个静态包) | 3 条新词条:`计划开工日期不能晚于计划完工日期`(校验话术)/ 两条「已自动调平」**整句**(`…已把开工日期调为 {d}`、`…已把完工日期调为 {d}`;整句一条而不是拼接,免得英文里串出全角逗号) |
| `tools/archive/_plandate-guard-20261109/_add-i18n-keys.mjs` | 一次性补词条脚本(幂等,锚点 = `'计划开工日期':`) |
