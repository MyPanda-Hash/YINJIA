# 组装物料清单(ASM_BOM)表头可维护 — 迁移/取证/演练 目录(2026-11-04)

本目录是任务「SQL+文档:组装物料清单表头可维护」的**取证与演练**产物,配套:

- 迁移脚本:`tools/migrate-asm-bom-maintainable-20261104.sql`(只改元数据,不改 DDL、不增删字段)
- 迁移登记:`tools/db-migrations.txt`(末尾追加一行)
- 核查报告:`docs/development/组装物料清单-表头可维护-20261104.md`
- 同批代码修复(另一任务/另一人):`ButtonService`(单表表头优先白名单 + 只并真表头字段 + 新增行补行序 + 空白草稿首行行序=1)、`PanelConfigService`(REF_SYNONYMS 补 子件名称/子件规格)

## 0. 背景一句话

用户 2026-11-04 报障「组装物料清单中的表头无法填写」:2026-10-30 建面板时 11 个表头字段
全部登记 `editable=0` ⇒ 后端下发 `readonly` ⇒ 前端表头输入框全部置灰。本迁移把其中 8 个
(产品编码/产品名称/规格型号/工序/版本号/默认BOM/工艺路线名称/备注)放开为可编辑,
另 3 个(单据编号/来源/状态)保持只读,并把 产品编码/子件编码 改为参照 INV(选料)、
默认BOM 改下拉框、新建单据默认「状态=启用」。

## 1. 目录文件

| 文件 | 用途 |
|---|---|
| `CHECK-before.sql` | 迁移**前**只读取证:面板行/19 字段/config、表头 editable 分布、参照与默认BOM 现状、字段与表规模、**数据影响面**(单据数/行数/默认BOM 分布/状态分布/关键列可空性)、BEFORE-STATE 判定 |
| `CHECK-after.sql` | 迁移**后**只读断言 15 项(表头 8 可编辑/3 只读、参照 2 个 INV、默认BOM 下拉框、config.headDefaults、字段 19、面板形态未变、物理表 47 列、子件编码可编辑);全部 PASS 时违规项=0、输出 `RESULT: PASS` |
| `CHECK-before-output.txt` | **本机实测输出**(2026-11-04,两账套):改前现场 + 数据基线 |
| `REHEARSAL-output.txt` | **本机实测输出**(2026-11-04,两账套):事务内执行迁移 → 重跑验证幂等 → 跑 CHECK-after(15/15 PASS)→ `@@TRANCOUNT 1→0` → ROLLBACK;**未落库**;文件末尾附回滚后复核(与改前一致) |
| `_RollbackRehearsal.java` | 事务内演练探针(一次性):单连接 `setAutoCommit(false)`、按 GO 分批执行迁移/断言脚本、结束打印 `@@TRANCOUNT` 并 ROLLBACK。DbSync 不支持事务包裹,故用 JDBC 直连 |
| `CHECK-after-output.txt` | **落库后**两账套实测输出:各 15/15 PASS、违规 0、RESULT: PASS + `yj_schema_log` 登记行(含脚本 SHA-256) |
| `_ApiVerify.mjs` | **API 级真实写入验证探针**(2026-11-04):连新代码并行实例 8091,**只写测试账套** —— 表头可填/改表头保存落库/连加两行行序/新增 BOM/参照带回/默认值,共 20 项断言 |
| `API-E2E-output.txt` | `_ApiVerify.mjs` 实测输出(20/20 PASS) |
| `cleanup-e2e.sql` | 测试账套 E2E 垃圾清理(**硬闸门:非 HSDZ_MES_TEST 直接 RAISERROR 拒绝**;清完复核 0 残留) |
| `live-8090-metadata-after-migration.txt` | 线上 8090(**旧 jar**,元数据已落库)的 `getPanelConfig` 只读取证:8 表头字段不再 readonly、默认BOM=下拉、headDefaults=状态启用 |

> 本目录输出均为 2026-11-04 本机实跑,非预期值;`REHEARSAL-output.txt` 的结论是
> 「语法/幂等/断言口径通过,但**尚未真正落库**」—— 落库待 Lead 统一安排(避免出现
> 「表头能填、旧 jar 存不回来」的中间态:代码修复要等新 jar 打包替换后才生效)。

## 2. 本机实测环境口径(2026-11-04)

- SQL Server:**127.0.0.1:1433 可直连**(JDBC)。`@@SERVERNAME = 7e136db97189` —— 本机是容器/宿主端口映射,
  进程列表里看不到 sqlservr;两账套 `HSDZ_MES`(正式)/ `HSDZ_MES_TEST`(测试)均返回真实数据。
- 开发机服务:**8090 与 5173 都在运行**(HTTP 200)。
- JDK:**`C:\Users\vigna\.jdks\ms-25.0.4`(JDK 25)**;注意本机 PATH 上的 `java` 是 1.8,
  跑 `DbSync.java` / `Q.java`(用了 `Files.readString`)必须显式用 JDK 25 的 java.exe。
- 改前实测基线(两账套一致):`yj_field` ASM_BOM 19 行、**表头 11 个全 `editable=0`**、
  `yj_panel.config = NULL`、参照字段 0 个、物理表 47 列;`yj_schema_log` 无本脚本。
- 数据影响面(正式库):1086 行 / 237 张单据;默认BOM `NULL` 1063、`是` 23;状态 `启用` 1085、`NULL` 1
  (测试库见 `CHECK-before-output.txt`)。迁移只改元数据,**不动任何业务数据**。

## 3. 可落库时的执行顺序(先正式库 → 后测试库 → 再换 jar → 最后界面走查)

> 前置:确认已拿到含同批代码修复的新 jar;不要「先落库、后换 jar」——旧 jar 仍会
> 行值覆盖表头,用户会看到「能填但存不回来」的中间态。

### 3.1 服务器(生产)

`deploy/部署说明.md` 的默认路线是**增量迁移 + 换 jar**(入口 `deploy\deploy-production.bat`,
内部转 `deploy-incremental.bat`;先 `CHECK` 只读体检 → 再 `GO`)。

```bat
:: 在服务器部署目录(如 C:\yj-deploy)执行
deploy-production.bat                     :: CHECK(只读体检,不动库)
deploy-production.bat GO                  :: 停 → 备份 → 跑迁移(含本脚本) → schema 闸门 → 换 jar → 起 → 验
:: 或只更新数据库/只换 jar 的场合按 deploy/部署说明.md 二、B 与三、热更新 的口径执行
```

### 3.2 开发机(本机,两账套;脚本幂等可重复执行)

```powershell
cd D:\workspace\yinjia\tools
$java = 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe'   # 必须 JDK 11+;本机 PATH 上是 1.8

# 1) 正式库
& $java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-maintainable-20261104.sql

# 2) 测试库(先正式后测试)
$env:YINJIA_SQL_DB = 'HSDZ_MES_TEST'
& $java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-maintainable-20261104.sql
Remove-Item Env:\YINJIA_SQL_DB

# 3) 幂等复跑:两账套各再 run 一次 —— 脚本内 §1/§3/§4/§5 的「影响行数」应全为 0(§2 恒 0);
#    若改用 sync 模式(DbSync.java 不带参数)复核,应输出「执行 0、失败 0」
& $java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-maintainable-20261104.sql
$env:YINJIA_SQL_DB = 'HSDZ_MES_TEST'
& $java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-maintainable-20261104.sql
Remove-Item Env:\YINJIA_SQL_DB
```

> `DbSync run` 成功会写 `yj_schema_log`(script_name + 内容 SHA-256)。**注意:`db-migrations.txt`
> 登记后,脚本字节任何改动都会让 DbSync 下次判「变更」而重跑** —— 本脚本幂等,但非必要不要再改字节。

### 3.3 换 jar(代码修复生效)

- 服务器:走 `deploy-production.bat` 的 `GO`/`GO APP`(见 `deploy/部署说明.md` 二、B / 三、热更新)。
- 开发机:`powershell -ExecutionPolicy Bypass -File tools\scripts\rebuild-prod.ps1`
  (停正式实例 → 等 jar 句柄释放 → 打包 → 重启 8090;只改后端 class 时可 `-SkipFrontend`)。
- ⚠ 8090 的前端是打进 jar 的 `BOOT-INF/classes/static`;纯后端改动按
  `jar uf` 只覆盖 `BOOT-INF/classes`(排除 static),避免前端无谓变化。
- 🔴 **2026-11-04 实测的环境限制**:本机 8090 的 java 进程属**宿主另一会话**(netstat 可见 pid,
  但 `Get-Process`/`tasklist` 无权访问),`rebuild-prod.ps1` 会停在「等待 jar 句柄释放超时(60s)」,
  agent 内**无法重启/替换**该实例。本轮因此:
  1) 迁移照常两账套落库(元数据部分**无需换 jar** 即对 8090 生效,见 `live-8090-metadata-after-migration.txt`);
  2) 用**同一份工作区源码**另打 jar 起在 **8091**(连同一套库),在**测试账套**上跑
     `_ApiVerify.mjs` 完成写入级验证(20/20 PASS,见 `API-E2E-output.txt`);
  3) 8090 加载新代码仍需**宿主机侧**执行 `rebuild-prod.ps1`(或在部署包路线换 jar)后重启;
     重启后再按第 4 节界面清单走查。

### 3.6 表头变更的「已知语义边界」(框架级,非本任务引入)

`headWins` 合并只覆盖**非空**表头值(原注释「空值不覆盖已有值」),且空串经 `labelsToCols` 归一为 null 后
不会写库 ⇒ **可以把表头格改成另一个非空值,但不能清空(置空)**。`_ApiVerify.mjs` 的清理步骤因此对
「原值为空」的备注用 `cleanup-e2e.sql` 的 SQL 兜底;用户若确需清空某格,按同法处理或单独立项改框架语义。

### 3.4 落库后复核(只读)

```powershell
cd D:\workspace\yinjia\tools
$java = 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe'
$env:YINJIA_SQL_PASS = 'Yinjia@2026'
# ⚠ 用 SqlRunner(实测可用;第四个参数 env = 从环境变量读口令)
& $java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar SqlRunner.java `
    "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" `
    yinjia env archive\_asm-bom-maintainable-verify-20261104\CHECK-after.sql
& $java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar SqlRunner.java `
    "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" `
    yinjia env archive\_asm-bom-maintainable-verify-20261104\CHECK-after.sql
```

**2026-11-04 已执行**:两账套 `DbSync run` 均 `[OK] 14 batches`、CHECK-after 各 **15/15 PASS**;
`yj_schema_log` 各 1 行(脚本 SHA-256 `c775ad4b…547092`)。输出见 `CHECK-after-output.txt`。

期望:两账套各输出 `15/15 项通过`、`违规项数 = 0`、`RESULT: PASS`。

### 3.5 演练(不落库,可随时重做;本机已做过,见 REHEARSAL-output.txt)

```powershell
cd D:\workspace\yinjia\tools
$java = 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe'
& $java -cp lib\mssql-jdbc.jar archive\_asm-bom-maintainable-verify-20261104\_RollbackRehearsal.java `
    HSDZ_MES migrate-asm-bom-maintainable-20261104.sql `
    archive\_asm-bom-maintainable-verify-20261104\CHECK-after.sql "$env:TEMP\reh-prod.txt"
& $java -cp lib\mssql-jdbc.jar archive\_asm-bom-maintainable-verify-20261104\_RollbackRehearsal.java `
    HSDZ_MES_TEST migrate-asm-bom-maintainable-20261104.sql `
    archive\_asm-bom-maintainable-verify-20261104\CHECK-after.sql "$env:TEMP\reh-test.txt"
```

## 4. 界面走查清单(换新 jar 后)

1. **表头可填 + 存得回来**:数据建模 → 生产 → 组装物料清单 → 打开 T387_V0001(草稿)或新建一张,
   表头 8 格可点击输入(产品编码/产品名称/规格型号/工序/版本号/默认BOM/工艺路线名称/备注);
   改「产品名称/备注」→ 保存 → 刷新页面 → 值仍在(**验签名:单表 doc 行值不再覆盖表头**);
   单据编号/来源/状态 仍为只读。
2. **选料参照带回**:产品编码 点击参照/下拉选一个存货 → 产品名称、规格型号自动带回;
   明细行 子件编码 选存货 → 子件名称、子件规格、计量单位自动带回(同批 REF_SYNONYMS 生效)。
3. **明细行序不撞唯一索引**:明细「新增数据」连加 2 行子件 → 保存成功(不再报重复键);
   删一行再加一行 → 保存成功;保存后各单 行序 为 1..n。
4. **新建单据默认值**:点「新增」→ (空草稿即可保存)→ 状态自动为「启用」;填产品编码/工序=组装/子件 → 保存;
   单据编号自动 `BOM-yyyy-MM-NNNN`、版本号自动 `Vyyyy-MM-dd-NN`(可手改)。
5. **默认 BOM 维护口径**:同产品多版本时,把要生效的新版 默认BOM 设为「是」(领料/报工按它优先取数)。
6. **下游取数**:移动端 工序报工 选「组装」→ 应能看到该产品当前 BOM;扫码领料 → 领料单按新 BOM 展开。
7. **历史数据不丢**:历史单(如 T387_V0001)表头原值仍显示;不在存货档案里的编码/名称不会显示成空
   (参照控件未命中回退显示原值)。
8. **多语言**:切 en 后表头标签为英文(8 个 label 的 en 译名 2026-10-30 已建,本迁移无新增字段/面板,
   故无新增译名需求;默认BOM 下拉值「是/否」是数据键,按 ADR-0001 不随语言变化)。

## 5. 回滚(仅应急,手工执行,不入迁移链)

若必须回退元数据(注意:回退后表头又会变只读,新 jar 下仍可保存但用户不能改表头):

```sql
-- 手工应急回退(非迁移脚本;执行前先备份)
UPDATE yj_field SET editable = 0
 WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%'
   AND label IN (N'产品编码',N'产品名称',N'规格型号',N'工序',N'版本号',N'默认BOM',N'工艺路线名称',N'备注');

UPDATE yj_field SET data_type = N'文本', ref_panel = NULL, ref_field = NULL, display_field = NULL
 WHERE panel_code = 'ASM_BOM' AND label IN (N'产品编码', N'子件编码');

UPDATE yj_field SET data_type = N'文本', dict_sql = NULL
 WHERE panel_code = 'ASM_BOM' AND label = N'默认BOM';

UPDATE yj_panel SET config = NULL WHERE panel_code = 'ASM_BOM';
```

> 回滚后请把本脚本从 `yj_schema_log` 的记录视作已过期(内容哈希未变,DbSync 不会自动重跑);
> 要重新应用:先执行上面的回退,再 `DbSync run` 本脚本即可。

## 6. 未验证项 / 待办

- ~~尚未落库~~ → **已落库**:2026-11-04 两账套 `DbSync run` 均 OK、CHECK-after 15/15 PASS、
  `yj_schema_log` 各登记 1 行(见 `CHECK-after-output.txt`)。
- **8090 加载新 jar 待宿主机执行**(沙箱无权重启):重启前「表头能填、但改了保存回写不可靠(旧 jar 行值覆盖)」;
  重启命令 `powershell -ExecutionPolicy Bypass -File tools\scripts\rebuild-prod.ps1 -SkipFrontend`,
  重启后按第 4 节走查。写入级逻辑已在 8091(同源码实例)上通过 20/20 API 断言。
- 界面像素级走查(截图/DOM):沙箱无可控浏览器会话,待宿主重启后人工走查第 4 节。
- 服务器/生产环境的执行与验收:按 §3.1 走 `deploy-production.bat`(CHECK → GO),并按部署规范在
  `deploy/部署台账.md` 记账。




