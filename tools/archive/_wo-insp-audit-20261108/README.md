# 5 张检验单据「审核 / 反审核」全流程验证 + 界面取证(2026-11-08/09)

> 任务:共享 task-8「验证 5 张检验单据的审核与反审核全流程(测试账套)+ 断链修复」。
> 执行人:be-insp(验证 teammate)。**只在测试账套 `YJ_TEST → HSDZ_MES_TEST` 做写操作**;
> 不 git commit、不碰看板页与 `WorkOrderProgressService`(Lead/fe-board 范围)。
> ⚠ 期间发生一次**共用浏览器登录态串库**事故(正式库一张单被误弃审),已用备份**精确复原**,
> 详见 §七。正式库其余状态经 Lead 独立复核一致。

## 一、结论(审核 / 反审核)

| # | 面板 | 单据 | 审批形态 | 审核链路 | 反审核 | 结论 |
|---|---|---|---|---|---|---|
| 1 | QC_FIRST_INSP 首件检验单 | SJ-2026-10-0153(草稿) | 两级(ADMIN_L2_PANELS) | 提交审批→审批中→一级审批通过(待二级)→超级管理员批准(已审核) | 弃审 → 草稿 | **PASS** |
| 2 | QC_PROC_INSP 制程检验单 | ZC-2026-10-0126(草稿) | 两级 | 同上 | 弃审 → 草稿 | **PASS** |
| 3 | QC_OQC_REPORT 出厂检验报告 | OQC-2026-11-0012(草稿) | 两级 | 同上 | 弃审 → 草稿 | **PASS** |
| 4 | QC_ASM_INSP 组装成品检验单 | ZJ-2026-10-0135(草稿) | 单节点 | 提交审批→审批中→审批通过(已审核) | 弃审 → 草稿 | **PASS** |
| 5 | QC_INSP 来料检验单 | IJ-2026-09-0152(草稿) | 单节点 | 提交审批→审批中→审批通过(已审核) | 弃审 → 草稿 | **PASS** |

- **API 全流程实跑:PASS 173 / FAIL 0**,5/5 面板 审核+反审核 全通,无 4xx/5xx、无状态不流转、无弃审被拒。
- **界面入口可用**:QC_PROC_INSP 用 ego 浏览器真实点完「提交审批 → 审批通过 → 批准通过 → 弃审」,
  状态胶囊 `草稿 → 审批中 → 待二级审批 → 已审核 → 草稿`(FLOW_RESULT=PASS,截图见 §四)。
- **未发现断链,未改任何生产代码**(本次任务 0 行产品代码改动/0 commit)。

### 每步断言口径(逐面板 JSON 里逐步留证)

| 步骤 | 断言 |
|---|---|
| 提交审批 | 接口 code=200 且 `data.单据状态=审批中`;`yj_doc_status.pending='Y'`、`approve_node=1`、`pending_by=admin`;`yj_form_approval` 有 `SUBMIT/PENDING`;签署格:编制(检验员)有值、审核人/审批人为空 |
| 一级审批通过(两级) | `审批中→待二级审批`;`pending='Y'`、`approve_node=2`、`shr` 仍空;留痕 `APPROVE_L1/L1_PASSED@1`;签署格「审核人」=系统管理员、「审核时间」有值、「审批人」仍空 |
| 二级批准(两级) | `待二级审批→已审核`;`pending='N'`、`shr='admin'`、`approve_node=NULL`;留痕 `APPROVE/APPROVED@2` 且 `APPROVE_L1` 仍在;签署格「审批人」=系统管理员 |
| 单节点审批通过 | `审批中→已审核`;`pending='N'`、`shr='admin'`;留痕 `APPROVE/APPROVED@1` |
| 弃审 | `已审核→草稿`;`pending≠'Y'`、`shr=NULL`;两级面板 `approve_node=NULL`;留痕 `UNAUDIT/PENDING`(`ButtonService.unaudit` 口径;`UNAUDIT/DRAFT` 只属于自助维护型 `selfModify`);签署格「审核人/审批人」清空、编制格保留 |
| 下游联动 | ASM 审核自动生成产成品入库单(FINISH_IN)草稿、弃审联动作废;QC_INSP 审核自动生成采购入库单(PURCHASE_IN)草稿、弃审联动作废 |

## 二、验证环境

| 项 | 值 |
|---|---|
| 后端 | `http://127.0.0.1:8090`(本会话新代码 jar;期间 Lead 于 00:03 重打包重启,已重跑复核) |
| 前端 | `http://localhost:5173`(vite,源码即时生效) |
| 数据库 | SQL Server 1433(Docker `mssql2019`);写操作仅在 `HSDZ_MES_TEST` |
| 登录 | `admin / 123456`;**factory=`YJ_TEST`**(显示名「YINJIA-MES·测试库」;接口必须传代码,传库名会静默落回正式库) |
| 验证方式 | ① Node fetch 直连后端 `/api/px/callButton`(可复跑);② ego 浏览器真实点击(截图) |

## 三、复跑方法

```bash
cd D:/workspace/yinjia

# ① 盘点(只读):面板元数据/按钮组/草稿候选
node tools/archive/_wo-insp-audit-20261108/_probe.mjs
node tools/archive/_wo-insp-audit-20261108/_probe2.mjs

# ② API 全流程 E2E(5 张单:提交审批→审批通过→[批准]→弃审;测完自动整行还原)
#    输出 evidence/run-<stamp>/summary.json + 每面板 JSON + run.log
node tools/archive/_wo-insp-audit-20261108/_e2e-audit-unaudit.mjs
#    单面板:--only=QC_PROC_INSP ;只看不还原:--no-cleanup

# ③ 界面取证(ego 浏览器,登录态在脚本内显式切成 YJ_TEST,并逐次校验 claims.factory)
#    入口脚本放在 ego 目录,归档副本见 evidence/ui/scripts/
#    round-17.mjs = 干净的 提交审批→审批通过→批准通过→弃审 全链截图
#    round-03/04/05.mjs = 5 面板入口探查(侧栏审批组 / 数据页顶部「审批 ▼」)
#    运行:
#    "C:/Users/vigna/.local/share/ego/active_version_dir/ego-browser.exe" nodejs \
#      -e "await import('file:///C:/Users/vigna/ego/wo-insp-audit-20261108/round-17.mjs')"

# ④ 界面点完后的清场(按测前快照整行还原;先 save 再 restore)
node tools/archive/_wo-insp-audit-20261108/_ui-restore.mjs save    --panel=QC_PROC_INSP --doc=ZC-2026-10-0126
node tools/archive/_wo-insp-audit-20261108/_ui-restore.mjs restore --panel=QC_PROC_INSP --doc=ZC-2026-10-0126

# ⑤ 收尾清场复核(只读,断言测试库回草稿/无留痕 + 正式库无新增留痕)
node tools/archive/_wo-insp-audit-20261108/_verify-cleanup.mjs
```

> `_lib.mjs` = 登录/API/DB/证据落盘;`_doc-lib.mjs` = 面板配置 + docStatusOf 口径复刻 + 整行快照/还原
> (被 E2E、UI 清场、事故恢复共用)。

## 四、界面入口取证(ego 浏览器)

### 两类布局的入口位置

| 面板 | 布局 | 入口 |
|---|---|---|
| QC_FIRST_INSP / QC_PROC_INSP / QC_OQC_REPORT | 文书式(有右侧栏) | 侧栏「② 本单操作 / 审批」段的 **提交审批 / 审批通过(两级时先审批通过、待二级时显示「批准通过」)/ 审批驳回 / 审批情况**,「⑤ 危险操作」段的 **弃审** |
| QC_ASM_INSP / QC_INSP | 数据页(无右侧栏) | 顶部工具栏 **「审批 ▼」**:主按钮即 **提交审批**(`engine.normalizeApprovalGroups` 把审批动作归一成一组),下拉 = 审批通过 / 审批驳回 / 审批情况 / 弃审 / 审核 |

### 实际点击(QC_PROC_INSP/ZC-2026-10-0126,测试库)

`FLOW = {初态:草稿, 提交后:审批中, 一级通过后:待二级审批, 批准后:已审核, 弃审后:草稿}` → **PASS**

| 截图 | 说明 |
|---|---|
| `evidence/ui/shots/round-17-01-draft-testdb.png` | 初态:单据 ZC-2026-10-0126,状态胶囊「草稿」,侧栏「提交审批」可点 |
| `evidence/ui/shots/round-17-02-submit-dialog.png` | 「提交审批确认」对话框(提交说明选填)+ 确认按钮 |
| `evidence/ui/shots/round-17-03-in-approval.png` | 提交后:状态「审批中」,侧栏主按钮变「审批通过」 |
| `evidence/ui/shots/round-17-04-approve1-dialog.png` | 一级「审批通过确认」对话框 |
| `evidence/ui/shots/round-17-05-wait-l2.png` | 一级通过后:状态「待二级审批」,主按钮变「批准通过」 |
| `evidence/ui/shots/round-17-06-approve2-dialog.png` | 二级批准确认框(按钮文案仍是「确认审批通过」——前端把两节点都打到后端「审批通过」,节点由后端 `approve_node` 判) |
| `evidence/ui/shots/round-17-07-audited.png` | 批准后:状态「已审核」,侧栏出现「弃审」 |
| `evidence/ui/shots/round-17-08-unaudit-dialog.png` | 「弃审确认」对话框 |
| `evidence/ui/shots/round-17-09-back-to-draft.png` | 弃审后:状态回「草稿」,toast「弃审执行成功」 |
| `evidence/ui/shots/round-03-*.png`、`round-04-*-approval-dropdown.png`、`round-05-asam-toolbar-approval.png` | 5 面板入口探查:3 张文书单侧栏审批组可见;ASM/QC_INSP 顶部「审批 ▼」及下拉项可见 |
| `evidence/ui/shots/round-02-factory-dropdown.png`、`round-02-after-login.png` | 登录页「登录工厂」切到「YINJIA-MES·测试库」→ 登录后 JWT `factory=YJ_TEST` |

> 复跑注意(踩坑):**带 `?docNo=xxx` 直接 `page.reload()`** 时页面只拿到列表行、明细(`cur.detail`)不装载,
> 前端校验会报「提交审批前需先保存:请至少添加一行明细」且不发请求。正确做法:先进面板(不带 docNo),
> 再 `goto` 带 docNo 走路由跳转(round-17 已按此写)。诊断过程见 `evidence/ui/scripts/round-14/15/16.mjs`。

## 五、清场与「不留脏数据」

测试库用**现有草稿**验证,流程本身以「弃审 → 草稿」收尾;随后再按**测前整行快照**把本轮所有痕迹回滚:

- 头行/明细行:逐列 diff 还原(`headDiff=[]`);
- `yj_doc_status`:测前无行则删除、有行则整行还原;
- `yj_form_approval`:删除本轮新增留痕(id > 测前 MAX(id));`yj_message`:删除本轮消息;
- 自动生单的下游测试单(FINISH_IN / PURCHASE_IN):物理删除(头/行/状态/留痕/消息/流程链);
- `form_flow_link`:删本轮新增、恢复被改动的既有行状态;ASM 关联工单结案行(若有)还原。

最终复核(`_verify-cleanup.mjs` → `evidence/cleanup/cleanup-final-20261109-001841.json` → **RESULT=PASS**):

| 库 | 单据 | 终态 | 本轮审批留痕 |
|---|---|---|---|
| TEST | SJ-2026-10-0153 / ZC-2026-10-0126 / OQC-2026-11-0012 / ZJ-2026-10-0135 / IJ-2026-09-0152 | 全部 **草稿** | 全部 0 行 |
| TEST | 2026-11-08 15:00Z 后检验类审批留痕 | — | **0 行** |
| 正式 | ZC-2026-10-0126 | **已审核**(shr=柴善银,shsj=2026-10-15 08:30:00) | 0 行(误操作行已删) |
| 正式 | 2026-11-08 15:00Z 后检验类审批留痕 | — | **0 行** |

> 说明:正式库 QC_ASM_INSP/ZJ-2026-10-0135 有 2 条 `AUDIT/APPROVED`、`UNAUDIT/PENDING` 历史留痕,
> 是**本次任务之前就存在**的正式库数据(create_time < 2026-11-08 15:00Z),非本轮写入。

## 六、测试单号(与 Lead 指定避开的两张)

| 面板 | 用到的单号 | Lead 指定避开的单号 |
|---|---|---|
| QC_FIRST_INSP | SJ-2026-10-0153 | SJ-2026-10-0043(未使用) |
| QC_PROC_INSP | ZC-2026-10-0126 | — |
| QC_OQC_REPORT | OQC-2026-11-0012 | — |
| QC_ASM_INSP | ZJ-2026-10-0135 | ZJ-2026-10-0085(未使用) |
| QC_INSP | IJ-2026-09-0152 | — |

## 七、⚠ 事故与恢复披露(2026-11-09 00:08)

### 事实

1. 本机 ego 浏览器与 Lead **共用同一 `localhost:5173` origin 的 localStorage 登录态**(`mes_token` 全局一份)。
   我 00:01 已用「登录工厂=测试库」登录并校验过 `claims.factory=YJ_TEST`。
2. Lead 于 **00:07:59** 为正式库排查重新以「YINJIA-MES(正式库 `YJ`)」登录同一浏览器,覆盖了 `mes_token`。
3. 我 00:08:21 在界面上点「弃审」时未再校验账套,该动作落到**正式库**:
   `HSDZ_MES.QC_PROC_INSP/ZC-2026-10-0126`(原状态=**已审核**,shr=柴善银)被弃审成草稿,并多出 1 条 `UNAUDIT` 留痕。
   其余无写入:`yj_message`/`form_flow_link` 均无新增,该单之外无其它单据被改。
4. 发现方式:后续 UI 步骤界面显示「已审核」与测试库接口(草稿)不一致 → 解码标签页 `mes_token` 的 `claims.factory=YJ` 定位。
   取证截图保留在 `evidence/incident/round-09-*.png`(该组截图属于正式库误操作,不作为测试库证据使用)。

### 恢复(精确到单行,未整库还原)

用 **2026-11-06 21:22 的正式库备份**(`D:\workspace\HSDZ_MES_manual_20261106-212242.bak`)还原成临时库
`HSDZ_MES_RECOVER_20261108`(sa 账号,只读比对),再把该单**本次弃审会改的列**回填正式库:

- `yj_doc_status`:shr='柴善银'、shsj='2026-10-15 08:30:00'、archived='N'、update_at 等回测前值;
- `qc_proc_insp_head`:审核人/审核时间/审批人/审批时间 回 NULL(原本就是空,批准由 `yj_doc_status.shr` 口径显示)、
  asp_user2/asp_time2 回 'migration'/2026-10-21 20:19:55;
- 删除我这条 `yj_form_approval` UNAUDIT 行;
- 复核:恢复库 vs 正式库该单 `ROW_DIFFS=[]`、审批留痕一致、`docStatusOf` 口径回到「已审核」;
  恢复库与备份副本随后删除。脚本:`_incident-recover.mjs`(`inspect`/`apply`/`drop`),
  日志 `evidence/incident/incident-*.json`。
- API 复核(正式库只读):`单据状态=已审核`、`审核人=柴善银`、`审核时间=2026-10-15 08:30:00`。
- **Lead 已独立复核**:同口径 SQL 确认一致、无其它残留写入(取证存 `tools/archive/_wo-progress-board-20261108/logs/`)。

### 已加防护

UI 取证脚本(`round-17.mjs` 等)现在:① 进页面后**显式把 localStorage 换成 YJ_TEST token**(API 登录取得);
② **每次业务点击前**校验 `claims.factory==='YJ_TEST'`,不是就抛错中止、不做任何点击;
③ 只对测试库单据操作,并在收尾用 `_ui-restore.mjs` 复核。

## 八、观察项(未改代码,供后续决策)

1. **单节点审批单 `approve_node` 残留**:`QC_ASM_INSP`/`QC_INSP` 单节点审批通过后 `yj_doc_status.approve_node`
   仍是提交时写的 `1`(弃审也不清),但 `pending='N'`,状态推导只看 `pending`/`shr` ⇒ **显示与流转不受影响**;
   本轮清场已删除/还原该行。若要彻底净,可在 `approveApproval` 单节点分支一并清 `approve_node`/`l2_approver`。
2. **QC_INSP 历史「已归档」老单**:测试库 90 张老单是 `archived='Y'` 遗留态;按现行后端口径,
   归档单点「弃审」会先要求「申请修改→管理员审批(修改中)」。这是既有设计,不是本次断链;
   **新流程审核后 = 已审核**,弃审正常。是否给这批老单开直退口子请 Lead/用户定夺。
3. **入口一致性**:QC_ASM_INSP/QC_INSP 是数据页布局(无右侧栏),审批入口在顶部「审批 ▼」下拉,
   与采购入库等数据页单据一致;若希望和另外 3 张一样在侧栏出统一审批组,属 UI 改造(本次未做,避免超范围)。

## 九、产物清单

| 路径 | 说明 |
|---|---|
| `_lib.mjs` / `_doc-lib.mjs` | 公共库(API/DB/证据;状态推导复刻、整行快照/还原) |
| `_probe.mjs` `_probe2.mjs` `_probe3.mjs` `_probe4.mjs` | 盘点(面板元数据/按钮组/草稿候选/物理表列) |
| `_e2e-audit-unaudit.mjs` | **API 全流程 E2E**(5 面板,逐步断言 + 测后还原) |
| `_ui-restore.mjs` | UI 点击前后的快照 / 整行还原 |
| `_verify-cleanup.mjs` | 收尾清场复核(两账套只读断言) |
| `_incident-recover.mjs` | 事故恢复(inspect/apply/drop) |
| `evidence/run-20261109-000016/` | **最终 API E2E 证据**:summary.json(PASS 173/0)、5 面板 JSON、run.log |
| `evidence/_intermediate/` | 中间轮次(脚本自身 bug 修前的运行记录,仅追溯用) |
| `evidence/ui/shots/` | ego 界面截图(干净测试库版 round-17 全链 + 入口探查) |
| `evidence/ui/scripts/` | ego round 脚本归档(round-01/02/03/04/05/14/15/16/17) |
| `evidence/ui/*.json` | UI 测前快照 / 还原复核 |
| `evidence/incident/` | 事故取证与恢复记录(含误操作那组截图) |
| `evidence/cleanup/` | 收尾清场复核 JSON |
| `evidence/probe2-*.json` | 草稿候选盘点原始数据 |
