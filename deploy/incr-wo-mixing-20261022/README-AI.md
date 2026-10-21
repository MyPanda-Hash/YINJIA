# 混料记录面板（WO_MIXING_LIST）增量包 —— 给服务器上的 AI 执行

> 一句话：**把「混料记录」面板加到「生产过程」菜单里**，数据源是数据库里现成的 `wo_mixing_list`，
> 呈现方式与「报工记录」完全一致（只读报表：一行一条、同表展开、按页查询、可筛选、可导出/打印）。
> 本包**只做增量**：不重建库、不换 jar、不动任何已有面板。

---

## 0. 装完是什么样

| 项 | 值 |
|---|---|
| 菜单位置 | 生产过程 → **混料记录**（在「物料混合记录」之后） |
| 面板码 | `WO_MIXING_LIST` |
| 地址 | `/panelx/list/WO_MIXING_LIST` |
| 呈现形态 | `flat` + 类别`报表` —— 与「报工记录 / 完工明细」同款 |
| 权限 | 只读：`view,query`（若「报工记录」有 `export` 则同样给 `export`），无审批、无新增/保存/删除 |
| 数据源 | `dbo.wo_mixing_list`（表或视图都行，**只读直连**，不复制任何数据） |
| 列结构 | 已核对服务器真实结构（27 列，见下方 0.1）+ 运行时自适应兜底（源表若又加过列会自动补上） |

### 0.1 服务器上的真实结构（2026-10-22 从备份还原核对，不是猜的）

从 `HSDZ_MES-manual-20261021-184953.bak` 还原后读出的 `dbo.wo_mixing_list`：**27 列 / 8 行**
（这 8 行是 2026-10-21 08:04~08:13 真实落库的数据，一行 = 一张混料单里的一条物料）：

```
id(bigint 自增主键)、单据编号、工单号、工单行id、工单行号、配方单号、配方版本、序号、
物料种类、物料编号、物料名称、配料比、单支物料含量、设计添加量、计划用量、实际用量、
标记(保存前=N / 保存后=Y)、asp_user1..4、asp_time1..4、asp_cancel、asp_print
```

所以面板**没有**「单据日期 / 混料数量 / 单位 / 状态 / 批次号」这些列（表里本来就没有），
默认按「创建时间」(`asp_time1`) 倒序；`asp_user1 / asp_time1 / asp_user3 / asp_time3`
分别显示为 创建人 / 创建时间 / 审核人 / 审核时间；修改人、删除人、打印次数、删除标记
属技术列，不进面板。合计行会对「小数/整数」列自动求和（与系统其它报表面板同一条规则）。

---

## 1. 包里有什么

```
apply.ps1                              一键执行（数据库 + 前端菜单）
rollback.ps1                           回滚（还原 jar / 删面板元数据）
tools\migrate-wo-mixing-list-20261022.sql    面板迁移（幂等）
tools\verify-wo-mixing-list.sql              只读体检 12 项
tools\rollback-wo-mixing-list.sql            只删面板元数据
tools\SqlRunner.java + tools\lib\mssql-jdbc.jar   直连 SQL 的执行器（不依赖 sqlcmd/Schannel）
static\                                前端构建产物（含新增菜单项）
verify\wo-mixing-list-e2e.mjs          HTTP 端到端校验（登录→面板配置→取数）
README-给AI执行.md                      本文
SHA256SUMS.txt                          全包校验和
```

---

## 2. 执行（三条命令，按顺序）

> 工作目录 = 解压后的包目录；PowerShell 一律 `-ExecutionPolicy Bypass`。

### 第一步：只做数据库（不动服务，最安全）

```powershell
powershell -ExecutionPolicy Bypass -File .\apply.ps1 -DbOnly
```

期望最后一行：`RESULT: MIXING-DB-OK`

- 这一步会：建面板行 → 按真实列登记字段 → 写中英日译名 → 按「报工记录」等价补授只读权限
  → 跑 12 项只读体检；**不会重启服务，也不碰 jar**。
- 服务无需重启：面板元数据有 TTL 缓存，30 秒内自动生效（刷新页面即可看到新面板）。

### 第二步：把菜单项装上去（会重启一次服务）

```powershell
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

期望最后一行：`RESULT: MIXING-OK`

- 这一步在第一步的基础上，**只替换 app.jar 里的前端静态文件**（`BOOT-INF/classes/static`），
  不重新打包、不覆盖后端 class：
  1. 备份现役 `C:\yinjia\app.jar` → `C:\yinjia\backup\app-<时间戳>.jar`
  2. 停服务（`schtasks /end /tn YINJIA-MES` + 结束 java 进程），等 jar 句柄释放
  3. `jar uf app.jar -C <stage> BOOT-INF` 覆盖静态文件
  4. 起服务（`schtasks /run /tn YINJIA-MES`），轮询登录接口，再跑 HTTP 端到端校验

### （可选）只装菜单、数据库已经自己跑过

```powershell
powershell -ExecutionPolicy Bypass -File .\apply.ps1 -StaticOnly
```

---

## 3. 判定标准（请把这些当成硬闸门）

| 输出 | 含义 |
|---|---|
| `RESULT: MIXING-DB-OK` | 数据库部分装好且 12 项体检全 PASS |
| `RESULT: MIXING-OK` | 数据库 + 菜单全部装好，HTTP 端到端也 PASS |
| `RESULT: FAIL-NO-SOURCE-TABLE` | **库里没有 `dbo.wo_mixing_list`**（表或视图都没有）—— 什么都没改，见下方「排错 A」 |
| `RESULT: FAIL-DB` | 迁移或体检失败，日志在 `logs\apply-<时间戳>.log` |
| `RESULT: FAIL-STATIC` | jar 锁住/替换失败；旧 jar 已自动还原，服务可照常启动 |
| `RESULT: FAIL-E2E` | 面板装上了但 HTTP 校验不过（旧 jar 在 `backup\` 里，可用 `rollback.ps1` 退回） |

---

## 4. 排错

### A. `FAIL-NO-SOURCE-TABLE`：找不到 `wo_mixing_list`

先确认这台服务器上真实的对象名（很多环境里它是**视图**而不是表）：

```sql
SELECT name, type_desc, create_date
  FROM sys.objects
 WHERE name LIKE N'%mixing%' OR name LIKE N'%mix%'
 ORDER BY name;
```

- 如果叫别的名字（例如 `v_wo_mixing_list`、`WO_MIXING_LIST`），把
  `tools\migrate-wo-mixing-list-20261022.sql` 顶层那段

  ```sql
  IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NOT NULL SET @src = N'wo_mixing_list';
  ELSE IF OBJECT_ID(N'dbo.wo_mixing_list', N'V') IS NOT NULL SET @src = N'wo_mixing_list';
  ```

  里的 `wo_mixing_list` 替换成真实名字（**只改这一处**，其余自适应逻辑不用动），再重跑。

- 如果确实只有 `wo_mixing_head` / `wo_mixing_detail`（混料配方快照的父子表）、没有展平的清单对象：
  **不要**让脚本凭空造一张同名表（会和后续全量部署打架）。正确做法是先建一张只读视图，再跑本脚本：

  ```sql
  CREATE VIEW dbo.v_mixing_list AS
  SELECT d.id,
         h.工单号, h.工单行号, h.混料报工单号, h.配方单号, h.配方版本,
         h.产品编号, h.产品名称, h.混料数量, h.单位, h.状态,
         d.序号, d.物料种类, d.物料编号, d.物料名称,
         d.配料比, d.单支物料含量, d.设计添加量, d.计划用量, d.实际用量,
         h.asp_time1, h.asp_cancel
    FROM dbo.wo_mixing_head  h
    JOIN dbo.wo_mixing_detail d ON d.混料头id = h.id;
  ```
  然后把脚本里的对象名改成 `v_mixing_list` 重跑。

### B. `FAIL-NO-JAVA`

`apply.ps1` 需要 `java`（跑 SQL）与 `jar`（改 jar）。优先取 `$env:JAVA_HOME`，
其次 PATH。服务本身能跑就说明机器上有 JDK，把 `JAVA_HOME` 指过去即可。

### C. `FAIL-STATIC`：jar 被占用

说明服务没停干净。手工确认没有 java 进程占用 `C:\yinjia\app.jar`，再重跑；
旧 jar 已备份在 `C:\yinjia\backup\app-<时间戳>.jar`，`rollback.ps1` 可一键还原。

---

## 5. 回滚

```powershell
powershell -ExecutionPolicy Bypass -File .\rollback.ps1 -Db      # 还原 jar + 删面板元数据
powershell -ExecutionPolicy Bypass -File .\rollback.ps1 -DbOnly  # 只删面板元数据
```

- 只删**本功能自己写进去的**元数据（`yj_panel` / `yj_field` / `yj_role_panel` / 面板译名）。
- `wo_mixing_list` 源对象与其中的数据**一个字节都不动**。

---

## 6. 注意事项

1. **面板字段是"按真实列自动生成"的**：装完后如果觉得列太多/顺序不顺手，直接在界面上
   「表格调整 / 字段管理」里改（改的是 `yj_field.alias` 与 `visible`）。**重跑本脚本不会覆盖这些手工调整**
   （脚本只更新标题/顺序/类型，保留 alias 与 visible）。
2. **幂等**：`migrate-wo-mixing-list-20261022.sql` 可以反复跑；源表将来加列，重跑即自动补字段。
3. **源对象没有 `id` 列时会自动建只读包装视图** `dbo.v_wo_mixing_list`（`ROW_NUMBER()` 生成行号）。
   这是硬要求：列表查询的 SQL 固定是 `SELECT t.id AS __id … ORDER BY t.id DESC`。
4. **没有任何列名的对象不能装**：如果源对象一列业务字段都没有，脚本会直接报错退出。
5. 🔴 **全量部署的风险（务必转告维护人）**：本功能的数据源 `wo_mixing_list` 只存在于**服务器**，
   本地开发库没有它。按仓库规矩「下次部署默认全量恢复本地备份」—— **全量恢复会把服务器上的
   `wo_mixing_list` 连同数据一起覆盖掉**。所以在做下一次全量部署之前，必须先把服务器上这张表
   的结构与数据同步回本地库，或者改为只做增量部署。
6. **多语言**：面板名与字段名都写了 en 译名（`yj_translation` + `yj_field.label_en`），
   其余语种由后端机翻兜底。切换英语后应显示 `Mixing Records` 与 `Work Order No.` 这类英文标题。
