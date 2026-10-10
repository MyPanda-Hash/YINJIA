# 增量部署包 pkg-incr-20261010(换 app.jar + 执行 40 条强制迁移,不动服务器业务数据)

> 解压到 **C:\yj-deploy**(沿用既定部署目录;若旧包内容还在,先清走,避免两套 to-run/manifest 混放)。
> 服务器:**管理员 cmd** 执行;命令可整段复制粘贴(cmd 块内不带注释)。
> jar 内嵌前端 `index-DM7W8RLe`;manifest **465 条**。

## 与上一个包(10-09 / pkg-incr-20261008)的关系

上一个包已上线 ALL-OK(见《部署说明》§A8),服务器当时进入的状态:

| 指纹 | 值(部署前请核对仍然如此) |
|---|---|
| 首页前端 | `assets/index-CtZ3s6Hm.js` |
| `C:\yinjia\app.jar` SHA256 | `ca386364…`(完整值见 §A8) |
| 四单四面板 | 与开发机同代(基线一致) |

本包 = 其后 **149 个提交**的全部增量(主线 + `feat/wo-qc-trace-20261009` 合并),manifest 429 → **465 条**。
to-run **40 条** = **36 条新增**(含本次打包前补登记的 1 条)+ **4 条字节变更需重跑**;
**退场 0 条**;逐条按 DbSync 同一哈希口径核过(开发机两账套均已「执行 0 / 跳过 465 / 失败 0」)。

> 脚本名带 `20261009`/`20261015` 的是**批次标签**(那一批的编号),与执行日期无关。

## 内容

| 文件 | 说明 |
|---|---|
| `app.jar`(约 90.5 MB) | 本 HEAD 由 `mvn clean package -DskipTests` 完整构建(class major 69 = Java 25);内嵌前端 `index-DM7W8RLe` |
| `deploy-incremental.bat` | 一键脚本:CHECK 只读体检 / GO 全流程(停→备→迁→换→起→验)/ GO APP / GO DB |
| `apply-migrations.bat` | 只跑迁移不动 jar(备用) |
| `verify-package.ps1` | 包完整性校验(按 SHA256SUMS.txt 逐文件复核) |
| `probe-login.ps1` | 登录验收探针(默认 admin/123456) |
| `tools/` | db-migrations.txt 清单(465 条)+ **仅清单内**脚本 + DbSync.java + lib\mssql-jdbc.jar |
| `tools/verify/` | 回归闸与体检:`FourDocAudit.java`(四单漂移闸)+ `DbNormAudit.java`(13 项体检),配套数据 4 个文件 |
| `to-run-20261010.txt` | 强制执行清单:40 条(顺序 = 清单顺序) |
| `SHA256SUMS.txt` | 全包完整性清单 |

## ⚠ 本批对**生产数据/界面**的可见影响(部署前请知悉)

1. **19 张表会被 DROP**(模块下架,均出自本轮迁移):
   - 请购单 `bd_pu_req`/`bl_pu_req`、其他入/出库 `bd_other_in`/`bl_other_in`/`bd_other_out`/`bl_other_out`、
     委外入/发料 `bd_outsource_in`/`bl_outsource_in`/`bd_outsource_issue`/`bl_outsource_issue`(10 张)
   - 品质「制程品质/不良处理/品质追溯」5 张面板对应 7 张表(`qc_disposal`/`qc_op`/`qc_op_detail`/
     `qc_record`/`qc_record_detail`/`rod_return`/`rod_return_detail`)
   - 检验规范 `qc_insp_spec_head`/`_detail`(2 张)
   **开发机只读探针已核:服务器上这些面板当前全部 0 行**(`QC_INSP_SPEC` 在服务器压根不存在,那条是空转),
   即删表不带生产数据;另有 GO 第 3 步的整库备份兜底。
2. **仓库档案对齐金蝶真实账套**:软删本地自建 `CK01~CK05`。服务器现状恰好是**同一编码各 4 份重复**的脏数据
   (共 34 行,见 §A8 遗留②),本批正好清掉。
3. **四单基线已刷新**:`PURCHASE_IN` 因「采购入库明细启用仓位」在 10-09 刷新过冻结点 ⇒ 四单回正脚本会
   **重建 PURCHASE_IN 的字段登记**(新增仓位相关字段)。四单是文档口径唯一基线管辖的对象,属预期变化。
4. **生产工单「行级化」批次**(`*20261015*` 7 条):给 报工/用量/产成品入库 等补**工单行号**列并**回填存量**
   (`scjl`、`yj_usage_log`、`bd_finish_in` 等),`plang` 行状态逐行重算、清掉「旧口径报工达标即结案」的脏 ja。
   属**存量数据改写**,只改「能唯一确定」的行(脚本头部写明不猜)。接口/界面随之改为按「工单号+行号」定位。
5. **功能面**(随 jar 生效):三类工序检验单「合格数量」改派生值(只录不合格)、「多行文本」字段类型上线、
   销售出库单补「销售订单号/行号」、权限矩阵改版(按导航栏归并+组内筛选)、系统更名「银嘉数字化平台」、
   三张出库单启用左栏单据选择、桌面现存量 TOP 滚动全量等。

## 服务器操作

先核包指纹(zip 的 SHA256 见交付说明;`ca386364…` 那个是上一个包的,**不要拿来比**):

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat
```

判据:末行 `RESULT: CHECK-OK` + `package sql files: 465`。
(`PREFLIGHT-OK` 已内含按 `SHA256SUMS.txt` 逐文件核验 —— 解压完整性由它保证。)

```cmd
deploy-incremental.bat GO
```

预期 7 个 RESULT 依次出现:

```
APP-STOPPED
BACKUP-GATE-PASSED
MIGRATIONS-OK
NEW-JAR-IN-PLACE
APP-STARTED
LOGIN-OK
ALL-OK
```

自动顺序:停应用 → 备份库 `C:\yinjia\backup\pre-deploy-<时间戳>.bak`(**失败硬停**)→ 按 to-run 逐条强制迁移
→ baseline 刷哈希 → 裸 sync 复核(须「执行 0」)→ 换 jar(旧 jar 归档)→ 起应用 → 登录探针。
**GO 前建议先关掉 Navicat**(它缓存旧表结构,部署后打开会报 `Access violation`,重开刷新即可)。
任何一步不过即打 `RESULT: FAIL-*` 并停止,详细输出在 `C:\yj-deploy\logs\deploy-<时间戳>.log`。

## 部署后复核

```cmd
cd /d C:\yj-deploy\tools
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java
```

预期 `执行 0, 失败 0, 跳过 465`。

```cmd
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar verify\FourDocAudit.java HSDZ_MES
```

预期末行 `[PASS]`(四面板差异全 0)。

```cmd
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar verify\DbNormAudit.java
```

**需先设口令**:`set YINJIA_SQL_PASS=<口令>`。预期 `FAIL 3 / WARN 1` —— 三项均为**既有存量债**
(见表尾「已知事项」),**非本包引入**,不必当成本包问题。

```cmd
sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables"
```

预期 **210** 左右(下架 19 表 + 新增成品检验规范 2 表之后的值,与开发机一致)。

```cmd
certutil -hashfile C:\yinjia\app.jar SHA256
```

应等于包内 `SHA256SUMS.txt` 里 `app.jar` 那一行。

开发机终验:http://36.140.66.163:8090 登录 → 首页资产指纹应变成 `index-DM7W8RLe.js`;
抽查 生产工单/快速排产/工序报工单(行级定位)、工序检验单(合格数量为派生)、成品检验规范、权限矩阵、
桌面「现存量 TOP 滚动」。

## 回滚

顺序不能反:先停应用 → 再回滚库 → 换回 jar → 起应用。

```cmd
taskkill /f /im java.exe
sqlcmd -S localhost -d master -E -Q "RESTORE DATABASE [HSDZ_MES] FROM DISK=N'C:\yinjia\backup\pre-deploy-<时间戳>.bak' WITH REPLACE, RECOVERY"
copy /y C:\yinjia\backup\app-<时间戳>.jar C:\yinjia\app.jar
C:\yinjia\start.bat
```

(若 RESTORE 报「数据库正在使用」,先 `ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE` 再重试。)

## 已知事项(不阻塞,勿误判为本次引入)

- **体检 3 项存量债**(棘轮基线都是 0,属未清债):① `bd_sale_out` 10 个英文字段无中文注明;
  ② `PURCHASE_IN` 6 行完全重复的字段登记;③ 缺 en 译名 275 处(20 个遗留面板 + 255 个字段标签)。
- **登记层已核查为六向零缺漏**(实库 210 表 / 97 视图 ↔ 在册台账 ↔ 数据库表清单;清单 465 ↔ tools\*.sql 一致),
  其中本次打包前补了两处:`fix-stock-report-module-group.sql` 登记进链(4 张库存报表 `module_group` 乱码修复)、
  `qc_fin_spec_head/_detail` 两张新表补进台账与表清单(v3.11)。
- **两个一次性清理脚本有意留在链外**(`cleanup-kucun-resync-marker.sql` 清写入者标记、
  `cleanup-probe-residue-roles.sql` 按硬编码 id 删探针残留角色)—— 已进 `DbNormAudit` 检查 12 的链外白名单;
  本包 `tools/` 只装清单内脚本,故**不含**它们。若服务器确需执行,请单独审阅后手工跑。
- 若 GO 重试后复查发现 `bs_wh_loc` 列数是 40(`area-a-raw` 旧版重跑会复活两个空死列 —— 该问题已在
  本批脚本里根治,仅当混用了旧版脚本才会出现),包内备有一次性清理脚本
  `tools\archive\_registry-audit-20261008\_cleanup-stray-whloc-cols-test.sql`。
