# 出货检验表观(QC_ASM_INSP):「进入组装/装箱即出单」+「选生产工单」(2026-11-12)

> 用户口径:
> 1.「出货表观在组装/装箱环节就要进行检验。当前实现的还是自动生成单据对吧,修改当前生成出货表观的生成时间,
>    在进入到组装/装箱这个工序或者产线的时候就生成这个出货表观的表单。」
> 2.「同时增加当前出货表观可选生产工单,实现方式和出货功能检验的选择工单一致。」

## 一、改了什么

### 1) 生成时机:从「组装达计划量」改成「进入组装/装箱即出」

| | 改造前 | 改造后 |
|---|---|---|
| 判据 | `QcInspAutoService.OP_PANELS` = {组装→QC_ASM_INSP};「该工序累计已审报工 ≥ 计划量」(且成型达标) | 新增 `AsmInspEntry`(自动/手工共用),**进入组装/装箱环节即出**:①路线里组装/装箱那道的前道已审报工流入(可加工量折成品>0 = 台账「已落实」);②该道自己已有已审报工(兜手机端直写/存量跨序);③工单当前线 `plang.scx` 或该道台账**实际**线属「组装」车间(装箱归组装;不看预排计划线) |
| 触发面 | 报工单审核(`ButtonService.woInspGenerate`) / 手机端报工吸收(`ExternalReportAbsorbService`) | 不变,只换判据 |
| 表头 | 工序=报工工序(组装);报工数量=组装累计已报工 | 工序=命中的组装环节工序(组装/装箱);报工数量=max(可加工量, 该道已审报工) |
| 占用链 | `form_flow_link(source=WO_REPORT/SCJL)`,弃审报工级联作废 | 记 `source_panel_code='ASM_ENTRY'`(来源=工单号):切炭报工触发的那张**不挂**切炭报工,弃审切炭不会误伤表观单 |

### 2) 新增「选生产工单」

- 后端 `QcAsmInspController`(`/api/qc/asmInsp/woLines`、`/fromWoLine`),与制程检验单同一套交互:
  列表=未作废+未结案+路线含组装/装箱;准入=已进入(未进入行**照旧列出并置灰**+原因);强制开单复用
  `WoInspGateGuard.enforceVerdict`(权限词「强制开单」+ 必填原因 + `yj_usage_log` 留痕);
  表头/明细复用 `QcInspAutoService.asmInspHeadForRow` —— 与自动出单同源。
- `PanelConfigService` 给 QC_ASM_INSP 注入「选生产工单」;`QcProcInspWoPicker.vue` 增 `mode='asm'`;
  `PanelxList` 按面板给 mode 与回执话术;新增中文词条补 en(`进入环节/进入量/已审报工量/可开单/强制开单/…`)。

## 二、验证证据

### 1) 自动出单(正式库,真实吸收链路)

- 夹具:`asm-fixture.sql` 造工单行 `GD-TEST-ASM-20261112`(路线 `GY-CB-STD`,一条「组装」已审报工 300);
- 触发:`POST /api/px/scheduleBoard/absorbMobile {"days":1}` → 手机端报工吸收真实链路;
- 结果:生成 `QC_ASM_INSP ZJ-2026-11-0004`,落值见 `verify-doc.txt`:
  工单号/工单行号=1/工序=**组装**/批次号/报工数量=300;`form_flow_link` source=**ASM_ENTRY**;
- 清理:`asm-fixture-cleanup.sql` 删除夹具与验证单据,自检 plang/scjl/表观单/占用链残留 **0/0/0/0**。

### 2) 手工选单(接口)

- 已进入行重复选择 → `已存在=true` + 原单号(幂等,`ZJ-2026-11-0005` 为删掉自动单后手工新建);
- 未进入行(如 `GD-2026-11-0017` #1)→ **422**「该工单行尚未进入组装/装箱工序（上一道工序还没有已审核报工流入），暂不能生成出货检验表观」。

### 3) 界面(ego 浏览器,脚本 round-01..04.mjs)

| 证据 | 内容 |
|---|---|
| `round-01-picker.png` | 5173 面板:侧栏出现「选生产工单」;选中夹具行后回执「该工单行已有出货检验表观:ZJ-2026-11-0005」并打开单据 |
| `round-02-dialog-5173.png` / `round-02-dialog-8090.png` | 5173 源码版与 8090 打包版弹窗同款:提示语=表观单口径,列含 进入环节/进入量/已审报工量 |
| `round-03-blocked-row.png` | 未进入行置灰:红字原因 + 「强制开单」+ 「确定」禁用 |
| `round-04-en-dialog.png` / `round-04-en-blocked.png` | 切 en:提示语/列头(Entered Stage 等)/原因话术全英文 |

### 4) 构建

- `mvn -DskipTests package` 通过(fat jar `BOOT-INF/lib = 129`),8090 已换新包;
- `cd frontend && npm run build` 通过,dist 已同步到 `backend/src/main/resources/static`;
- 无 DDL、无迁移脚本(`tools/db-migrations.txt` 不新增)。

## 三、可复跑

```powershell
# 夹具/验证/清理(正式库;清理脚本会删掉夹具与验证单据)
cd tools
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia "Yinjia@2026" ..\tools\archive\_qc-asm-entry-20261112\asm-fixture.sql
# 触发吸收(需登录 admin/123456 取 token 后):
#   POST http://127.0.0.1:8090/api/px/scheduleBoard/absorbMobile  {"days":1}
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia "Yinjia@2026" ..\tools\archive\_qc-asm-entry-20261112\asm-fixture-cleanup.sql
# 界面:round-01..04.mjs 放 C:/Users/<name>/ego/qc-asm-entry-20261112/ 后用 ego-browser nodejs 执行
```

## 四、已知边界

- **产线判定只看「实际线」**:预排台账的「计划生产线」在排产时每道都会写,拿它判会让整批未生产的工单在排产那一刻就出表观单,故不用。
- **历史已进入组装但没出单的行**不会自动补:触发面仍是报工审核/吸收(事件驱动)。需要补单走面板「选生产工单」(本任务新增入口)。
- **测试账套(HSDZ_MES_TEST)结构陈旧**(`plang` 缺 `工艺路线/当前工序` 等中文列),新入口在 YJ_TEST 账套会因既存结构差异报列名无效 —— 本次未重建测试库(另行确认)。
