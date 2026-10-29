# 生产领料面板（PROD_PICK_LIST）增量包 —— 给服务器上的 AI 执行

> 一句话：**把「生产领料」只读面板加到「WMS管理系统 → 库存核算 → 单据」里**，
> 数据源是数据库里现成的 `dbo.outh`（出库流水表）的**材料出库段（src=6）**，
> 呈现方式与「混料记录 / 报工记录」一致（一行一条、同表展开、按页查询、可筛选、可导出）。
> 本包**只做增量**：不重建库、不换 jar、不动任何已有面板，`outh` 源表一个字节不改。

---

## 0. 装完是什么样

| 项 | 值 |
|---|---|
| 菜单位置 | WMS管理系统 → 库存核算 → **单据** → **生产领料**（紧跟「材料出库单」之后） |
| 面板码 | `PROD_PICK_LIST` |
| 地址 | `/panelx/list/PROD_PICK_LIST` |
| 呈现形态 | `flat` + 类别 `报表` —— 与「混料记录 / 报工记录」同款 |
| 权限 | 只读：`view,query[,export]`（按「材料出库单明细表」等价补授），无审批、无新增/保存/删除 |
| 数据源 | 视图 `dbo.v_prod_pick_list` = `dbo.outh` 里 `src = 6`（材料出库）且未删除的行 |
| 默认排序 | 单据日期 DESC, id DESC（最新的在最上面） |
| 列 | 登记 18 列，列表默认展示 13 列（关掉的 5 列见下） |

### 0.1 为什么是"视图"而不是直连 outh

`outh` 是**全出库段共用**的流水表，`src` 段号：

```
5 销售出库 / 6 材料出库 / 7 其他出库 / 8 委外发料（历史另有 10 / 12）
```

直连会把销售出库、其他出库一起列出来，所以建一张**只读包装视图**筛出 `src = 6`。
`outh` 本身不建表、不加列、不复制数据。

### 0.2 数据实况（2026-10-22 本地正式库实测）

| 指标 | 值 |
|---|---|
| 材料出库行 | **2,094 行 / 487 张单** |
| 单据编号 | 全部 `SCLL-YYYYMMDD-000NN`（SCLL = 生产领料） |
| 单据类型列 | 恒为「材料出库单」 |
| 单据日期 | 2026-09-01 ~ 2026-10-14 |
| 成本单价 / 成本金额 / 经手人 / 审核人 / 审核时间 | **全为空**（等 `inv_cost_ledger` 回填成本；审核列这些流水行本来就不落） |

> ⚠ 所以列表默认**关掉**这 5 列：单据类型（恒定）、仓库编码（仓库名称已够辨仓）、
> 经手人 / 审核人 / 审核时间（全 NULL）。要看得去「表格调整 / 列设置」把列打开。

---

## 1. 包里有什么

```
apply.ps1                                   一键执行（数据库 + 前端菜单）
rollback.ps1                                回滚（还原 jar / 删面板元数据）
tools\prod-pick-preflight.sql               前置只读检查（outh 在不在、材料出库段几行）
tools\migrate-prod-pick-outh-20261022.sql   面板迁移（幂等：视图 + 面板 + 字段 + 译名 + 授权）
tools\verify-prod-pick-outh.sql             只读体检 13 项
tools\rollback-prod-pick-outh-20261022.sql  只删本功能写进去的元数据
tools\SqlRunner.java + tools\lib\mssql-jdbc.jar   直连 SQL 的执行器（不依赖 sqlcmd/Schannel）
static\                                     前端构建产物（含新增菜单项）
verify\prod-pick-outh-e2e.mjs               HTTP 端到端校验（登录→面板配置→取数→按单号筛选）
README-AI.md                                本文
SHA256SUMS.txt                              全包校验和
```

---

## 2. 执行（按顺序）

> 工作目录 = 解压后的包目录；PowerShell 一律 `-ExecutionPolicy Bypass`。

### 第一步：只做数据库（不动服务，最安全）

```powershell
powershell -ExecutionPolicy Bypass -File .\apply.ps1 -DbOnly
```

期望最后一行：`RESULT: PROD-PICK-DB-OK`

- 这一步会：前置检查 outh → 建/更新包装视图 → 建面板行 → 登记 18 个只读字段
  → 写中英日译名 → 按「材料出库单明细表」等价补授只读权限 → 跑 13 项只读体检。
- **不会重启服务、不碰 jar**。面板元数据有 30 秒 TTL 缓存，刷新页面即可看到新面板。

### 第二步：把菜单项装上去（会重启一次服务）

```powershell
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

期望最后一行：`RESULT: PROD-PICK-OK`

- 在第一步基础上**只替换 app.jar 里的前端静态文件**（`BOOT-INF/classes/static`），
  不重新打包、不覆盖后端 class：备份 jar → 停服务 → `jar uf` 覆盖 static → 起服务
  → 轮询登录 → 跑 HTTP 端到端校验。

### （可选）只装菜单；或指定期望行数做端到端断言

```powershell
powershell -ExecutionPolicy Bypass -File .\apply.ps1 -StaticOnly
powershell -ExecutionPolicy Bypass -File .\apply.ps1 -ExpectRows 2094
```

---

## 3. 判定标准（硬闸门）

| 输出 | 含义 |
|---|---|
| `RESULT: PROD-PICK-DB-OK` | 数据库部分装好且 13 项体检全 PASS |
| `RESULT: PROD-PICK-OK` | 数据库 + 菜单全部装好，HTTP 端到端也 PASS |
| `RESULT: OUTH-MISSING` → `RESULT: FAIL-NO-SOURCE-TABLE` | 库里没有 `dbo.outh`，什么都没改，见「排错 A」 |
| `RESULT: FAIL-DB` | 迁移或体检失败，日志在 `logs\apply-<时间戳>.log` |
| `RESULT: FAIL-STATIC` | jar 锁住/替换失败；旧 jar 已自动还原，服务可照常启动 |
| `RESULT: FAIL-E2E` | 面板装上了但 HTTP 校验不过（旧 jar 在 `backup\` 里，`rollback.ps1` 可退回） |

---

## 4. 排错

### A. `FAIL-NO-SOURCE-TABLE`：找不到 `dbo.outh`

```sql
SELECT name, type_desc FROM sys.objects WHERE name IN (N'outh', N'v_outh') ORDER BY name;
```

- `outh` 是库存出库流水表（`inh` 的镜像），**全量部署的服务器上一定在**；
  若真没有，说明这台库不是本系统的完整账套 —— 不要凭空造同名表，先核对部署方式。
- **本包不会**创建 `outh`，也不会往里写数据。

### B. `FAIL-NO-JAVA`

`apply.ps1` 需要 `java`（跑 SQL）与 `jar`（改 jar）。优先取 `$env:JAVA_HOME`，其次 PATH。

### C. `FAIL-STATIC`：jar 被占用

服务没停干净。确认没有 java 进程占用 `C:\yinjia\app.jar` 后重跑；
旧 jar 已备份在 `C:\yinjia\backup\app-<时间戳>.jar`，`rollback.ps1` 一键还原。

### D. 面板装好但列表是空的

先确认服务端 `outh` 里材料出库段有数据：

```sql
SELECT COUNT(*) FROM dbo.outh WHERE src = 6 AND ISNULL(asp_cancel,'N') <> 'Y';
```

0 行不是故障（面板先装上，有数据自然显示）；**行数不为 0 却空表**才是问题，
通常是服务器 jar 里的前端不是本包的 `static`（没跑第二步）。

---

## 5. 回滚

```powershell
powershell -ExecutionPolicy Bypass -File .\rollback.ps1 -Db       # 还原 jar + 删面板元数据
powershell -ExecutionPolicy Bypass -File .\rollback.ps1 -DbOnly   # 只删面板元数据
```

只删本功能写进去的东西：视图 `v_prod_pick_list`、`yj_panel` / `yj_field` / `yj_role_panel`
里的本面板行、面板名译名（`scope='panel'` 的「生产领料」）。
**`dbo.outh` 与字段名译名（单据编号/批号…是全库共享词条）一个字节都不动。**

---

## 6. 注意事项

1. **幂等**：迁移脚本可反复跑。重跑只更新标题/顺序/类型/宽度，
   **不动**界面上改过的 `alias` 与列的显隐（`visible` 只在首次安装时落默认值）。
2. **列显隐看 `visible`，不是 `hidden`**：平表列表的列由 `PanelConfigService.buildGridColumns`
   按 `visible` 过滤（`hidden` 是编辑表格/表单那侧的开关，对列表不生效，本包已实测）。
3. **多语言**：面板名与字段名都写了 en（+ 面板名 ja）译名，
   其余语种由后端机翻兜底；切到英语应显示 `Production Picking` / `Document No.` / `Quantity`。
4. **口径边界（务必转告维护人）**：本面板只显示**已进 outh 流水**的材料出库单据。
   本地实测 `bl_material_out` 有 494 张单，其中 487 张已进 outh；
   剩下 7 张（`LL-2026-10-0001..0006` 扫码领料演示单 + `CL-2026-08-2501`）**没进 outh**，
   在本面板里看不到 —— 要看全部单据用「库存核算 → 材料出库单」面板。
5. **库存批次追溯**：`outh.批号` 有 1,313 / 2,094 行为空（金蝶无批次商品默认 `PC0000` 口径的老问题）。
   本面板是**查看**用途，不做出库校验，不影响上线前批号必填改造。
