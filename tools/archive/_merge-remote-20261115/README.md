# 2026-11-15 合并 origin/main 到本地（远程内容 + 本地内容双保留，含远端 43 条迁移执行）

| 属性 | 内容 |
|---|---|
| 本地起点 | `19b22f9b7`（样品检验 feat + static 同步之后） |
| 远端 | `origin/main = 48d8e9ed6`（2026-11-13 16:02） |
| merge-base | `7a931556be28c1e0b00e1abaa94ae0843c805661` |
| 合并提交 | `c9c5426a6`（merge）；适配 `dbfa5e54f`；静态产物 `bd172cc54`；DB 执行证据见本目录后续提交 |
| 本地/远端 | 合并后 **87 ahead / 0 behind**（远端 191 提交 + 本地 84 提交都在） |
| 备份分支 | `backup/pre-merge-20261115` → `19b22f9b7` |

## 一、拉取（网络异常与 partial clone 处置）

- `github.com` DNS 被污染（解析到 `20.247.166.64` 不可达，正确 IP=`20.205.243.166`），直连/系统代理拉大 pack 反复
  `Recv failure / early EOF / invalid index-pack`。
- 处置：**partial clone** 只拉 commit+tree（`git fetch --filter=blob:none origin main`，成功拿到 48d8e9ed6），
  再按每批 8 个把缺的 **3653 个 blob** 补齐，直到 `rev-list --objects --missing=print` 归 0。
  脚本：`fetch-blobs-loop.py`（临时工具）、`map-proxy.py`（IP 映射代理留档）。
- 副作用：仓库带 `remote.origin.promisor=true` / `core.repositoryformatversion=1`；对象已齐，离线可 build/merge。

## 二、6 处冲突：全部「两侧都保留」

| 文件 | 解析 |
|---|---|
| `ButtonService.java` | 本地 `assertFinishInInspLink` 门禁块 + 远端 `audit()` 自审/直审改造注释块 |
| `tools/db-migrations.txt` | 本地 14 条 + 远端 43 条按日期归并 = 57 条（脚本名无交集） |
| `tools/db-inuse-tables.txt` | 本地 3 张样品检验表 + 远端 `v_qc_insp_rec_detail` 行 |
| `docs/development/数据库表清单.md` | 本地 v3.85–v3.97 保留；远端行重编号 v3.98–v3.111（内容逐字未改） |
| `frontend/src/i18n/locales/zh-TW.js` | 两侧新增词条并集 |
| `backend/src/main/resources/static/index.html` | 取本地版，随后 npm build 整体重建 |

行尾：远端 LF / 本地 CRLF，用 `merge.renormalize=true` 合并，避免整文件假冲突。
合并后适配两个测试：`railStatusTabs.test.js`（远端新增右栏单据预览=第三处 DocSelectRail）、
`recordSheetAttachStrip.test.js`（断言前归一化 CRLF）。

## 三、远端 43 条迁移执行（两账套，2026-11-15 09:20–09:25）

**执行方式**：`DbSync run` 逐条（顺序=清单顺序），先正式后测试；执行前两账套各打一份备份：
`D:\sql\data\{HSDZ_MES,HSDZ_MES_TEST}-pre-remote-migrations-20261115.bak`（COMPRESSION，容器内
`/var/opt/mssql/data/…`）。脚本 `backup-before-migrations.sql`。
日志：`run-migrations-HSDZ_MES.log` / `run-migrations-HSDZ_MES_TEST.log`。

执行中遇到的 2 个本机特有问题与处置：

1. **`migrate-merge-gen-20261113.sql` 编译期报「Invalid column name '采购单号'」**
   根因：该脚本**整文件无 GO**，② 清理段直接 `SELECT bl_purchase_in.[采购单号]`，与 ① 的 ALTER 同批次 ⇒
   列不存在时编译期报错（作者机器上该列早已存在，故未暴露）。
   处置：先用 `pre-merge-gen-compat.sql` 把三列按脚本最终形态预建（幂等），脚本按原逻辑跑完
   （`bl_purchase_in.采购单号` 会被它自己删掉，检验/退回两列保留 + 补注明）。
2. **`migrate-pu-order-price-wh-not-required-20261113.sql` 前置守卫中止**（要求 PU_ORDER 明细「单价/仓库」
   恰有 2 行 required=1，实际 1 行——本机「仓库」历史上已是非必填）。
   处置：`temp-pu-order-wh-required.sql` 临时把「仓库」required 置 1 → 脚本按原样执行（两格都改 0 + 自带自检）→
   最终状态与脚本目标一致。

**执行结果**：两账套 `DbSync sync` 均「执行 0 / 跳过 793 / 失败 0」，`yj_schema_log` = 830 行。

### 3.1 组织架构迁移的副作用与修复（重要）

`migrate-org-from-server-20261111.sql` 按 2026-11-11 服务器备份**整表重灌** `yj_dept/yj_role/yj_user/yj_role_panel`
（20 角色 / 32 账号 / 1654 行授权），其授权矩阵只保留 4 张历史面板 ⇒ 本地新增的 3 张面板授权被清空：

- `SAMPLE_REG` / `INSP_COMMISSION` / `QC_LINE_PATROL` → 迁移后 `yj_role_panel` 为 0 行（`panels_without_grants=3`）。
- 修复：`repair-local-panel-grants.sql` 按**迁移前快照**补回 39 行授权（role_id 在 org 脚本里按服务器 id 原样重灌，
  语义角色不变）⇒ 修复后 3 面板各 13 行、`panels_without_grants=0`，委托单 4 个审批角色（1031/1033/1039/1042）保持 `can_approve=Y`。
- 说明：本机 admin 口令哈希沿用（登录 admin/123456 正常）；账号/角色已对齐服务器组织架构（32 人）。

### 3.2 测试库 HSDZ_MES_TEST：重建（旧快照陈旧）

迁移后全局面板冒烟发现测试库 14 个面板 500（视图缺 `asp_cancel`/缺列、8 个视图缺失）——这是测试库**旧快照**的
结构性陈旧，按 repo 既有口径「测试库结构陈旧 ⇒ 直接重建」处理：

- `rebuild-test-db.sql`（用 **sa** 执行）：备份正式库 → `RESTORE … WITH REPLACE, MOVE` 覆盖测试库 → MULTI_USER。
  ⚠ 会覆盖测试库数据（测试库定位=演示/试用，可弃）。
- 重建后：面板 154/154、视图 113/113、`yj_schema_log` 830、`yj_role_panel` 1693、用户 32 ——与正式库一致；
  `DbSchemaDiff` = **IDENTICAL**（面板 154/154、字段 4719/4719）。
- 过程留档：`recreate-missing-views-test.sql`（重建前先试过按正式库定义补 8 个视图）、
  `RestoreViewsFromProd.java`、`ExportViews.java`、`view-restore-failures.txt`（当时 69 个 Kingdee 遗留视图
  因测试库缺基表无法重建——已由整体重建根治）。

## 四、执行后验证（全部可复跑）

| 校验 | 结果 |
|---|---|
| `DbSync sync` 两账套 | **执行 0 / 跳过 793 / 失败 0**（`yj_schema_log` 830） |
| `FourDocAudit` 两账套 | **`[PASS]`**（四单 yj_field 与基线一致；物理列缺失 0） |
| `DbNormAudit` 两账套 | **FAIL-3**（与合并前一致：02/09/12 为存量债；测试库由 FAIL-7 收敛到 FAIL-3） |
| `DbSchemaDiff` | **RESULT: IDENTICAL**（面板/字段 0 缺 0 多） |
| 全局面板冒烟 `smoke-panels.mjs` | **两账套 154 面板 × (config+query) 全部 200，失败 0** |
| 样品检验 E2E `_sample-insp-20261115/probe-flow.mjs`（测试账套） | **16/16 PASS**（新增→带目录→保存→提交→审批通过→已审核→弃审→留痕） |
| 身份/权限 | admin 两账套登录正常；`panels_without_grants=0`；委托单审批角色保持 |
| 测试数据 | 冒烟/E2E 产生的 WT-* 单已按 `cleanup-test-data.sql` 清零（测试库 0 单、目录 44 行） |

> 注：正式库存在 1 张**用户操作产生**的空白草稿 `WT-2026-11-0001`（2026-11-15 09:17 由界面「新增」创建，
> 无明细/无内容），未擅自删除。

## 五、本目录文件

| 文件 | 用途 |
|---|---|
| `backup-before-migrations.sql` | 迁移前两账套备份（容器路径） |
| `run-migrations-*.log` | 两账套逐条执行日志 |
| `pre-merge-gen-compat.sql` | 兼容补列（让 merge-gen 脚本可编译） |
| `temp-pu-order-wh-required.sql` | 临时恢复前置守卫状态 |
| `repair-local-panel-grants.sql` | org 迁移后补回 3 张本地面板的 39 行授权 |
| `rebuild-test-db.sql` | 测试库整库重建（sa，覆盖测试库数据） |
| `smoke-panels.mjs` | 全局面板冒烟（两账套） |
| `q-*.sql` | 各阶段只读取证 SQL |
| `ExportViews.java` / `RestoreViewsFromProd.java` / `recreate-missing-views-test.sql` | 测试库重建前的视图修复尝试（留档） |
| `fourdoc-audit-*.txt` / `dbnorm-audit-*.txt` / `dbschema-diff-after.txt` | 执行后体检原始输出 |
| `pending-HSDZ_MES*.txt` | 执行前 43 条待执行清单（留档；现已全部执行） |
| `fetch-blobs-loop.py` / `map-proxy.py` | 拉取期网络处置脚本 |
