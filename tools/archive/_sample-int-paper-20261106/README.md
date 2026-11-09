# 内部样品单：改回 Excel 纸面版式 + 底部「新增样品」行（2026-11-06 第二轮修正）

## 用户口径（纠正上一版）

> 「改错了，内部的样品开发单的格式还是要和 Excel 的一样的，只不过是和外部开发样品申请单的底部的新增样品
> 数据行一样的操作，而不是表格类的面板」

上一版按「共享表」把 `RD_SAMPLE_INT` 做成了**单表档案式数据面板**（`mode=archive`，列表页 + 表头筛选 +
每页 10/20/50）—— 版式错了。本次撤回该形态，恢复**纸张版式**（模板那 13 列横排表），行操作换成
外部单底部的「新增样品」。

## 改法

1. `tools/migrate-sample-int-paper-rows-20261106.sql`
   - `rd_sample_int_detail` 补 13 个行内列（申请日期/申请人/样品编号/项目名/炭棒尺寸/数量/样品背景/
     配方要求/工艺要求/物料批次要求/期望交期/确认人/样品状态）——原来只有 单据编号 + 留痕列，业务字段全在头表；
   - 存量回填：每张头表单据落一条明细行（幂等：该单已有存活行则跳过）；
   - `yj_panel` 恢复头行式文书：`mode=doc`、`head=rd_sample_int_head`、`line=rd_sample_int_detail`、
     `group_col=单据编号`、`code_col=单据编号`、`prefix=SPN`、`date_col=单据日期`；
   - `yj_field`：单据编号/单据日期/备注 归 `header`，其余 13 格归 `detail`；补 申请日期 / 样品编号 两个行内字段。
2. `docSheetConfigs.sampleIntSheetCfg`：表体行源 `rows:'detail'` + `addLabel:'新增样品'`（与外部单同一套操作），
   纸面仍是模板 13 列，列宽压到 1220px。
3. `PanelxList`：内部单重新进入 DocSheet 版式名单（上一版移出是错的）；审批按钮组仍不含本单（不需要提交审批）。

## 验收

- 本地 8090（`round-73.mjs`，`local-sample-int-new.png`）：纸面标题「内部（开发样品申请单）」+ 13 列表格；
  草稿态底部出现 **「+ 新增样品」**（虚线行）；侧栏只有 保存/保存为草稿，无 提交审批/审批通过。
- 生产 8090（`round-75.mjs`，`prod-sample-int-paper.png`）：同一纸面版式，存量单据内容（SPN-2026-11-0001，
  111 / 34*12*180 / 1 / 测试 / 雅可比HX*65%…）正确带出；不是列表型数据面板。
- 数据库（正式/测试两账套）：`RD_SAMPLE_INT` = doc 头行式，行内字段 13 个，`rd_sample_int_detail.配方要求` 列已存在；
  台账正式 759 → **760**，测试 634 → **635**。

## 部署

- 提交：与上游 10 个提交合并后的 `3c3829a36`（`git fetch` 在本机网络下需 `--filter=blob:none` 才能成功，
  全量 fetch 报 `unexpected disconnect while reading sideband packet`）。
- `deploy_src.py --ref 3c3829a36` → jar `01FDE56D…` / 入口 `assets/index-CwDNmdT7.js`（built 00:54:11）
  / 回滚点 `app-20261107-005416.jar` / 库备份 `pre-deploy-20261107-005412.bak`
- 迁移 1 条（正式/测试两账套 + 补登 `yj_schema_log`）。
