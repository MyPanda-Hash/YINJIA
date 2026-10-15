# 样品管理 / 经典单据 两组面板下架前的使用度取证（2026-10-16）

| 属性 | 内容 |
|---|---|
| 文档类型 | 一次性盘点报告（结论可复核，探针在本目录） |
| 触发口径 | 用户：「去除当前这两个菜单内的单据，查看当前数据是否没有在使用了」 |
| 证据日期 | 2026-10-16（正式库 `HSDZ_MES` + 测试库 `HSDZ_MES_TEST`） |
| 涉及面板 | `SAMPLE_REQ` 样品申请单 / `DISPATCH` 工序派工单 / `OUTSOURCE_ORDER` 委外加工单 / `DISPATCH_DETAIL` 工序派工单明细表 / `DISPATCH_STATS` 工序派工单统计表 |
| 涉及对象 | 表 `sample_req` `sample_req_detail` `bd_dispatch` `bl_dispatch` `bd_outsource_order` `bl_outsource_order`；视图 `v_dispatch_detail` `v_dispatch_stats` |

> **一句话结论**：**这 5 张面板的数据确实都没在用了** —— 4 张（DISPATCH / OUTSOURCE_ORDER /
> DISPATCH_DETAIL / DISPATCH_STATS）**零业务数据、零操作留痕**；`SAMPLE_REQ` 只有 **1 张 2026-09-22
> 的草稿测试单**（`SP-2026-09-0001`，无明细行，同一秒留了一条「提交」痕，之后再无任何动作）。
> 数据库侧**没有任何视图/存储过程/别的面板**引用它们（这两张 `v_dispatch_*` 只是 DISPATCH 自己的报表视图）。
> 本轮按仓库既有**轻路线**处置：**只摘菜单**，`yj_panel`/`yj_field`/`yj_role_panel` 与物理表**原样保留**可回滚。

---

## 1 业务数据与留痕（正式库实测）

| 面板 | 表/视图（业务数据行） | 操作留痕 `yj_usage_log` | 角色授权 `yj_role_panel` | 单据状态 `yj_doc_status` |
|---|---|---|---|---|
| `SAMPLE_REQ` 样品申请单 | `sample_req` **1** / `sample_req_detail` **0** | **1**（2026-09-22 action=提交） | **0** | 1 |
| `DISPATCH` 工序派工单 | `bd_dispatch` **0** / `bl_dispatch` **0** | **0** | 3 | 0 |
| `OUTSOURCE_ORDER` 委外加工单 | `bd_outsource_order` **0** / `bl_outsource_order` **0** | **0** | 3 | 0 |
| `DISPATCH_DETAIL` 工序派工单明细表 | `v_dispatch_detail` **0** | **0** | 0 | 0 |
| `DISPATCH_STATS` 工序派工单统计表 | `v_dispatch_stats` **0** | **0** | 0 | 0 |

- 单号台账 `s_allno`（538 行）：**只有 1 个 `SP` 号**（`SP-2026-09-0001`，2026-09-22 14:19:06，
  与 `sample_req` 那唯一一行同秒），**`DP` / `WO` / `WW` / `PG` 一个号都没发过**
  ⇒ 派工/委外两类单**从未开过单**。
- 那唯一一张样品申请单：`单据状态=草稿`，`sample_req_detail` 0 行 ⇒ 是建面板时的试录残留，不是业务单据。
- 附件 `yj_attachment` / 审批 `yj_form_approval` / 单据批次 `yj_doc_batch` / 报表列设置
  `report_column_settings`：对这 5 张面板**全部 0 行**。
- 测试库 `HSDZ_MES_TEST`（正式库快照，含演示数据）：`sample_req_detail` **1** 行、`bl_dispatch` **1** 行，
  其余全 0；留痕 4 条（2026-09-20 15:08 的 新增/保存为草稿，工序派工单 2 + 样品申请单 2），
  单号台账里 `PG`/`SP` 各 1 个 —— 全部是 2026-09-20 那次**演示试录**的残留，不是业务数据。

## 2 依赖取证（结论：没有别人在用它们）

1. **面板间参照**：`yj_field.ref_panel` 指向这 5 张面板的**一行都没有**。
2. **数据库对象**：全库 `sys.sql_modules` 里提到这 8 个表/视图的对象**只有 `v_dispatch_detail` /
   `v_dispatch_stats` 自己**（它们就是 DISPATCH 的面板视图）；其余表 `sample_req`/`sample_req_detail`/
   `bd_outsource_order`/`bl_outsource_order` **无任何引用**。
3. **后端专属代码**：`backend/src/main/java` 里没有按 `SAMPLE_REQ` 编码特判的逻辑；
   仅两处**面板自身配置**与 `OUTSOURCE_ORDER`/`DISPATCH` 相关（摘菜单后不生效，因为面板打不开了）：
   - `PanelConfigService.SELECT_FLOWS`：`DISPATCH ← MANU_ORDER`、`OUTSOURCE_ORDER ← SO_ORDER`（「选单」来源）；
   - `PanelConfigService` 的 `OUTSOURCE_GROUPS_ORDER` 按钮组骨架；
   - 且 `PUSH_TARGETS` 里**没有**指向这两张面板的生单目标 ⇒ 别的单据不会自动生出它们。
4. **前端遗留入口（非本次「这两个菜单」）**：`views/scm/BusinessOverview.vue`「业务总览 · 委外管理」
   流程图里 `OUTSOURCE_ORDER` 仍是一个**可点节点**（点击 `router.push('/panelx/list/OUTSOURCE_ORDER')`），
   `docs` 区也有同名按钮；另有 `PanelxList.vue`/`PanelxForm.vue` 的 `ATTACH_EDIT_PANELS` 名单含
   `OUTSOURCE_ORDER`（只在面板内生效）。**若要连入口一起断绝，这一处需另行摘除。**
5. 工具侧命中均为 `tools/archive/_*` 历史探针与 `tools/verify/panels-ui-smoke.cjs`、
   `panel-request-budget.cjs`（后者把 `DISPATCH` 当"中性起始面板"用），不构成业务依赖。

## 3 本轮处置（轻路线）

- `frontend/src/business/menus.js`：把「样品管理」「经典单据」**两个二级分组连同其 5 个叶子整体摘除**
  （两组摘完即空壳，空分组违反该文件「二级目录一律是带面板的分组」的既有口径）；
  摘除段留了**日期 + 恢复办法**注释，元数据与表**一律没动**。
- `frontend/src/business/menus.test.js`：二级目录断言 6 → 4，并新增「菜单树里不得再有这 5 张面板入口」的钉子测试。
- 未做（要做得另行决定）：删 `yj_panel`/`yj_field`/`yj_role_panel`/译名 + 删视图与表（**重路线**，见
  `docs/development/面板老化盘点-品质管理与智能供应链.md` §5）；摘 `BusinessOverview.vue` 的委外节点。

## 4 复现命令

```powershell
cd D:\workspace\yinjia\tools
$env:YINJIA_SQL_PASS='<口令>'
# 需 JDK 25（源文件模式）;默认 PATH 上是 1.8,会报「找不到主类 SqlRunner.java」
chcp 65001 | Out-Null; [Console]::OutputEncoding=[Text.Encoding]::UTF8
& 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe' '-Dfile.encoding=UTF-8' '-Dstdout.encoding=UTF-8' `
  -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" `
  yinjia env archive\_disp-sample-audit\_q-usage.sql
# 测试库把 databaseName 换成 HSDZ_MES_TEST
```

| 文件 | 内容 |
|---|---|
| `_q-usage.sql` | 元数据/授权 + 8 个对象行数 + 单据台账时间 + 留痕 + 参照 + 附件审批 + DB 依赖 + 对象类型 |
| `_q-usage2.sql` | 发号台账 `s_allno`、那张样品申请单全文、全库「派工/委外」列清单、`yj_panel` 分组分布 |
| `_q-deps.sql` | DB 侧引用（`sys.sql_expression_dependencies` + `sys.sql_modules` 关键字扫描） |
| `_out-usage-prod.txt` / `_out-usage-test.txt` / `_out-usage2-prod.txt` / `_out-deps-prod.txt` | 原始输出 |

**两个坑**：① 本机默认 `java` 是 1.8，`java X.java` 源文件模式跑不了 ⇒ 用 `C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe`；
② 中文输出要**三件套**一起给：`chcp 65001` + `[Console]::OutputEncoding=[Text.Encoding]::UTF8` +
java 的 `-Dstdout.encoding=UTF-8`（只给 `-Dfile.encoding` 不够，`Out-File` 仍会按 GBK 解出乱码；
用 `>` 重定向也一样乱）。
③ 别猜列名：`s_allno` 的单据类别列叫 **`lb`**（不是 `prefix`），`yj_usage_log` **没有 `panel_code`**（只有 `panel_name`）
—— 这两处第一版脚本都撞过「列名无效」。
