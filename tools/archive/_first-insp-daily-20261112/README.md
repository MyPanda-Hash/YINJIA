# 首件检验单「按天出单」+ 制程/表观口径核对(2026-11-12)

> 用户 2026-11-12 逐条拍板(原话):
> 1.「制程的先不处理,组装的需要在进入组装工序时实现生成」
> 2.「按每天一个生产批次吧,就是每天的第一个工序报工一次后就产生。」
> 3.「按推荐实现」
> 4.「按推荐实现」
> 5.「不卡下道」

## 一、改了什么

### 1) 首件检验单 `QC_FIRST_INSP`:改为「成型当天首笔报工即出,一天一张」

| | 改造前(2026-10-18 起) | 改造后(2026-11-12) |
|---|---|---|
| 触发时机 | 成型**累计已审报工 ≥ 该道计划量**(做满才出) | 成型(第一个工序)**当天首笔报工**即出,**与数量无关** |
| 幂等键 | 工单号 + 工单行号 | **工单号 + 工单行号 + 单据日期**(一天一张;次日再报再出一张) |
| 单据日期/检验日期 | 服务器当天 | **该报工的报工日期**(`sc_date → wgsj → asp_time1` 回落,与 `WorkOrderDayPlanService.actualByDate` 同口径) |
| 报工数量 | 成型累计报工 | **触发本次出单的那笔报工数量**(当天首笔成型报工) |
| 生产日期/批次号 | 先做后回填 | **不变**(用户第 4 条「按推荐实现」= 仍是先出单留空、工单行首批完工时 `FirstInspBackfill` 回填) |
| 触发面 | 报工单审核 / 手机端吸收 | **不变**(两处共用 `QcInspAutoService.build`) |

代码落点:`QcInspAutoService.build` 分支 ①(`FIRST_OP`/`FIRST_PANEL`/`existsLiveOnDay`/`loadReportRow.报工日期`)、
`firstInspHead(... day ...)`;`ButtonService.saveDrafts` 日志与注释。

### 2) 制程检验单 `QC_PROC_INSP`:**不动**

用户第 1 条「制程的先不处理」⇒ 仍按「成型累计已审报工 ≥ 该道计划量」出草稿
(`QcInspAutoService.build` 分支 ②;`OP_PANELS` 现在只剩 `成型 → QC_PROC_INSP`)。

### 3) 出货检验表观 `QC_ASM_INSP`:已由上一提交 `b3e79197d` 改成「进入组装/装箱即出」

本次**未改实现**,只做回归验证:夹具「切炭」报工把量流入组装后,自动出表观单(工序=组装,数量=1001,占用链 `ASM_ENTRY`)。

### 4) 连带(用户第 3 条「按推荐实现」)

- **人工「选生产工单」按天**:`QcFirstInspController.woLines` 只排除「**今天**已有存活首件单」的行
  (昨天出过单不影响今天);`fromWoLine` 幂等键同步改为「工单号 + 工单行号 + 单据日期=今天」。
  前端 `QcProcInspWoPicker.vue`(mode=first)提示语与门槛语、
  `PanelxList.vue` 回执「该工单行**今天**已有首件检验单」同步;`en.js` 补译。
- **占用链 / 弃审级联**:首件单仍按「生成它的那张报工」记 `form_flow_link`(MES=`WO_REPORT`、
  手机端=`SCJL`),MES 报工弃审时 `woInspUnauditCascade` 逻辑不变;
  弃审当天首笔报工 → 作废当天那张首件单;之后同一天再有报工审核时按「当天无存活单」重新出单。
- **追溯/看板**:`WorkOrderInspectionService` 本来就按「工单行 → 检验单列表」下发(含 `单据日期`),
  多张按天首件单照常列出,未改代码。
- **生产日期/批次号**:先做后回填不变;同一工单行多张按天单据在完工回填时会一起补上同一批号
  (批号只有完工才生成 —— 用户第 4 条拍板口径)。

### 5) 不卡下道(用户第 5 条)

本次**没有**新增任何「检验未完成/不合格不许报工」的判定;报工链路(含转序)与改造前一致。

## 二、验证证据(正式库 HSDZ_MES,真实吸收链路,夹具已清理)

夹具 `GD-TEST-FIRST-261112` #1(路线 `GY-CB-STD`:成型→切炭→组装,排产 1000;
⚠ 工单号列 `scjl.gldh` 是 `nvarchar(20)`,夹具名不得超过 20 字符)。

| 步骤 | 动作 | 结果(见 `verify-doc.txt`) |
|---|---|---|
| A | 昨天一笔成型报工 10(`sc_date=昨天`)→ `absorbMobile` | 出首件 `SJ-2026-11-0003`,**单据日期=昨天**、报工数量=10、批次/生产日期留空;制程/表观 0 张 |
| B | `GET /qc/firstInsp/woLines?keyword=…` | 夹具行**在列表里**(今天还没有单)⇒ 按天准入生效 |
| C | 今天第一笔成型报工 1 → absorb | 出首件 `SJ-2026-11-0004`,**单据日期=今天**、报工数量=1 |
| D | `GET /qc/firstInsp/woLines` 再查 | 夹具行**不再列出**(今天已有单) |
| E | 今天第二笔成型报工 1 → absorb(含重跑) | 首件仍 2 张、今天 1 张(**同日不重复出单**) |
| F | `POST /qc/firstInsp/fromWoLine` | `已存在=true`、返回今天那张 `SJ-2026-11-0004`(按天幂等) |
| G | 今天补报成型 989(累计 1001 ≥ 计划 1000)→ absorb | 出制程 `ZC-2026-11-0004`(**口径未变**:达标才出) |
| H | 今天切炭报工 1001(量流入组装)→ absorb | 出表观 `ZJ-2026-11-0006`(工序=组装,数量=1001,source=`ASM_ENTRY`)—— 组装「进入即出」回归通过 |
| I | 清理(`_cleanup.sql`) | 残留自检 **9 项全 0**(plang/scjl/首件/制程/表观/占用链/台账/工序任务/转序日志) |

- 2026-11-11 23:xx 拆包重建前后各一次 `absorbMobile` 均为 `status=200`、`失败=0`。
- 界面(ego 浏览器,见 `round-01.mjs` 与截图):
  - `round-01-picker-5173.png`:5173 首件面板 →「选生产工单」弹窗,提示语/门槛语已是按天口径;
  - `round-02-en-5173.png`:切 en 后同弹窗全英文(`one per day; …for today are no longer shown`);
  - `round-03-picker-8090.png`:8090(jar 内 static)同款文案。
- 构建:`tools/scripts/rebuild-prod.ps1` 全流程通过(前端 build → static 同步 → `mvn clean package` →
  fat jar 自检 129 条 → 8090 换包重启);零 DDL / 零迁移。
  (构建日志 `_build.log` 按 `.gitignore *.log` 未入库,留在本目录供本机复核。)

## 三、可复跑

```powershell
# 0) 重建前后端(会停→打包→起 8090)
powershell -ExecutionPolicy Bypass -File tools\scripts\rebuild-prod.ps1

# 1) 夹具 + 逐条报工(正式库;顺序执行)
cd tools
$J='C:\Users\<you>\.jdks\ms-25.0.4\bin\java.exe'; $CP='lib\mssql-jdbc.jar;archive\_first-insp-daily-20261112\_classes'
# (先 javac -cp lib\mssql-jdbc.jar -d archive\_first-insp-daily-20261112\_classes SqlRunner.java)
& $J -cp $CP SqlRunner "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia "Yinjia@2026" archive\_first-insp-daily-20261112\_f1-fixture.sql
& $J -cp $CP SqlRunner ... archive\_first-insp-daily-20261112\_f2-report-yesterday-mold.sql
node archive\_first-insp-daily-20261112\_verify-api.mjs http://127.0.0.1:8090 absorb
# …依次 _f3/_f4/_f5/_f6 + _verify.sql/verify-api(见执行记录)
& $J -cp $CP SqlRunner ... archive\_first-insp-daily-20261112\_cleanup.sql
```

界面证据复跑:`ego-browser nodejs -e "await import('file:///C:/Users/<you>/ego/first-insp-daily-20261112/round-01.mjs')"`
(脚本见本目录 `round-01.mjs`,截图同名)。

## 四、已知边界

- **只在成型报工日生成**:某天成型没有报工(例如整批从前一天延续、当天只做后道),那天就没有首件单 ——
  这是「每天的第一个工序报工一次后就产生」的直接读法;若现场要求"每天必出一张"，需要另定触发(例如按日计划)。
- **报工日期取 `sc_date → wgsj → asp_time1` 回落**:补录/跨零点审核时纸面日期跟业务日期走,不跟服务器整天。
- **生产日期**仍是完工回填(不是当天):每天的单据在批次号生成那一刻一起回填;若要求"按天的生产日期",
  需再改 `FirstInspBackfill` 口径(用户本次选「先做后回填」,未改)。
- **手机端吸收生成的单没有弃审级联**(吸收本身无弃审动作;MES 报工单那条才有),与改造前一致。
- 测试账套 `HSDZ_MES_TEST` 结构陈旧(见 AGENTS),本次验证全部在正式库以夹具+清理完成。
