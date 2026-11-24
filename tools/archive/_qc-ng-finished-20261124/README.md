# _qc-ng-finished-20261124 —— 出货检验判不合格:提示窗 + 成品处理单 + 不合格数量扣减产成品入库

## 用户口径(2026-11-24,两轮)

第一轮:
> 「修改为弹窗跳转,当前的功能就转向当前的不合格处理(制程),表观就转向不合格处理(成品),
> 要求需要实现当前的不合格处理数量能影响到后面的产成品入库的实际数量。也就是这些内容都和工单相关联。」

**第二轮纠正(同日,最终形态)**:
> 「是需要点击这个检验结论为不合格能跳出一个弹窗提示前往那个不合格单据。而不是点击后在弹窗打开不合格单据」

⇒ 纸面上把**检验结论选成「不合格」的那一刻**弹出**提示窗**:
- 标题:`检验结论：不合格`
- 正文:`检验结论已选为「不合格」，是否前往「不合格品处理单(成品/制程)」开单？`
- 按钮:`暂不` / `前往开单`(点前往 → 建/取对应处理单 → **整页跳过去**:关本页签 → 开目标页签 → `?docNo=` 定位)

**第三轮(同日)**:「那现在把这个删除掉」(截图纸面动作条上的「⧉ 去开不合格处理单」)
⇒ 动作条那颗按钮与它的显隐判据/样式**已删除**;建单入口只剩「检验结论选不合格 → 提示窗 → 前往开单」。
~~「弹窗内嵌处理单纸面」那种形态也已撤销~~(`NgDispositionDialog.vue` 已删除)。

## 落地

| 层 | 内容 |
|---|---|
| 库(迁移 `tools/migrate-qc-bhcp-finished-20261124.sql`,幂等,两账套已执行) | ① 新表 `qc_bhc_cp`(头)+ `qc_bhc_cp_detail`(行),照 `qc_bhc`/`qc_bhc_detail` 复制;② 制程 `qc_bhc` 补 `工单行号 int` / `批次号 nvarchar(40)`;③ 面板 `QC_BHCP`(doc、前缀 `BHCP`、20 条/页、品质管理);④ `yj_field` 41 列(出货检验单号 → 参照 `QC_ASM_INSP`);⑤ 照 `QC_BHC` 复制 6 个角色授权;⑥ 面板名 10 语言 + 新字段 en;⑦ 表/列中文注明 |
| 后端 | `QcShipInspNgController`:**来源→目标分流**(功能→QC_BHC / 表观→QC_BHCP),带出 `工单号/工单行号/批次号`(批次先吃检验单头,空则按报工单号取完工日),幂等键仍按 `出货检验单号`;`ButtonService`:① `QC_DOC_PREPARER`/`PREPARER_EDITABLE_PANELS`/`RESP_DEPT_PANELS` 登记成品单,② `ensureFinishInDrafts` 新增**不合格数量扣减**(两张 NG 单按 工单号+工单行号+批次 归集,未填批次记到最新批,`onlyLower` 只下调),③ NG 单保存后 `refreshFinishInAfterNg` 刷新同工单行的入库草稿,④ 产成品入库提交/审核前再下调一次;`QueryService.DOC_SUBMIT_TIME_PANELS` += QC_BHCP |
| 前端 | ① `shipInspNg.js` 新增 `NG_TARGETS`/`ngTargetOf`(功能→制程、表观→成品);② 纸面 `QcProcInspSheet` 的「检验结论」下拉 `@change` → `onSummaryChange`,选「不合格」即 `emit('ng-verdict')`;③ `PanelxList.onNgVerdict` 弹 `ElMessageBox.confirm`(暂不/前往开单),确认后走 `openNgDisposition` 建单并整页定位;④ 成品单补进 `DIRECT_AUDIT_BLOCKED`/`L2_DOC_PANELS`/左栏中间列(`产品编码`)、`docSheetConfigs.qcSheetCfgs.QC_BHCP`(继承制程纸面,标题「不合格品处理单（成品）」);⑤ 菜单 质量单据 → 不合格品处理单(成品) |

**占位/假设**(待确认):
- 成品单纸面受控编号暂用 **`YJ-QR-59-成品`**(正式编号确定后改两处:迁移 `文档编号` DEFAULT + `docSheetConfigs.QC_BHCP.docno`);
- 提示窗只在**本次选「不合格」**时弹一次;选回合格/清空不弹;按「暂不」不建单、不跳转(单据照常可保存);
- 没有任何工序/台账信息的工单行不生成入库草稿(沿用原逻辑,不猜数量)。

## 已验证

| 项 | 结果 |
|---|---|
| 迁移 | 两账套 `DbSync run` 均 `[PASS]`(2 表 + 面板 + 41 字段 + 6 角色 + 10 译名 + 制程单 2 列);复跑幂等 |
| 后端编译 | `mvn -o -DskipTests compile` 通过 |
| 前端 | `npm run build` 通过;相关单测 6+6+6+29 全绿(`shipInspNg`/`qcDocsTwoLevel`/`qcInspectionTasks`/`menus`) |
| 数据库体检 | `DbNormAudit` 两账套仍 `FAIL 3 / WARN 1`(02/09/12 均存量,本次对象未被点名) |
| **提示窗(ego 实测)** | `round-22.mjs` + `round-22-ng-confirm.png`:表观草稿 `ZJ-2026-11-0010` → 检验结论选「不合格」→ 弹窗**标题「检验结论：不合格」/正文「检验结论已选为「不合格」，是否前往「不合格品处理单(成品)」开单？」/按钮「暂不、前往开单」**;点「暂不」关闭并刷新丢弃改动(未落库) |
| **旧按钮已删(ego 实测)** | `round-23.mjs` + `round-23-no-button.png`:动作条只剩「＋新增检验项 / ⧉带入检验项目 / ＋添加批次」(`hasOldButton:false`);同一张单再选「不合格」提示窗仍正常弹出 |
| 新面板页面 | `round-20.mjs`:标题「不合格品处理单(成品)」、纸面「不合格品处理单（成品）」、左栏「单号/日期/产品编码/审核状态」、审批/打印/删除齐、无报错 |

## ⚠ 还没验证(需要先让新后端 class 跑起来)

**8090 现役 jar 仍是旧 class**,而 5173 的 `/api` 反代到 8090 ⇒ 下面两条只能验前端,不能验真:
1. 点「前往开单」→ 接口取/建目标单(表观应为 **QC_BHCP**)→ 整页定位到那张单;
2. 不合格数量 → 产成品入库 `实收数量` 扣减(只下调)。

跑通的两种方式(等用户点头,不擅自重启在跑的服务):
- **重建+重启 8090**:`mvn -DskipTests package` → 换 jar → 重启(会断现有会话);
- **并起 8091**(测试账套):复制 backend 源码到 `.tmp/backend-build` 打 jar,`YINJIA_SQL_DB=HSDZ_MES_TEST` 起在 8091,
  用测试库造一张「总结论=不合格」的出货检验单走完整条链后清理(正式库不能造这种验收数据)。

## 复跑

```bash
# 迁移(两账套)
cd tools && YINJIA_SQL_PASS=Yinjia@2026 "C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe" \
  -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-bhcp-finished-20261124.sql
YINJIA_SQL_DB=HSDZ_MES_TEST YINJIA_SQL_PASS=Yinjia@2026 "C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe" \
  -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-bhcp-finished-20261124.sql

# 单测
cd frontend && node --test --experimental-test-isolation=none src/core/qc/shipInspNg.test.js

# 提示窗取证(需 5173 在跑)
"C:/Users/vigna/.local/share/ego/active_version_dir/ego-browser.exe" nodejs \
  -e "await import('file:///C:/Users/vigna/ego/qc-bhcp-20261124/round-22.mjs')"
```
