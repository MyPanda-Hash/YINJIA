# 组装物料清单(ASM_BOM)全量导入 — 一次性导入包 2026-11-05

> 给应用服务器(生产机)用的一次性数据导入包。**只在服务器本机执行**,不动代码、不换 jar、不改表结构,只灌数据。

## 1. 这次要导什么

| 项 | 值 |
|---|---|
| 数据来源 | 金蝶 BOM 引出表 `引出列表_BOM单_20261019174847.xlsx`(sheet「列表数据」,3641 数据行 / 73 列) |
| 导入目标 | `HSDZ_MES.dbo.bs_asm_bom`(面板「组装物料清单」,数据建模 → 生产) |
| 范围 | **827 张 BOM 单据 / 817 个产品 / 3640 行子件**;工序=组装 |
| 同一产品多版本 | 10 个产品各有 2 个版本,**全部保留**(各成一张单据);代码取数口径:默认BOM=是 → 版本号最大 → 单据编号最大 |
| 与上一版差异 | 上一版 `migrate-asm-bom-data-20261030.sql` 只导了在产 236 个产品 / 1085 行;本包是它的**超集** |
| 影响面 | 只 `DELETE` + `INSERT` 来源=「金蝶BOM引出列表_20261019174847」的行;**面板里手工新建的 BOM 不动**;零 DDL |
| 幂等 | 可重复执行,行数/单数/产品数不变 |

## 2. 打包(从仓库真源重建,不要手拷)

```powershell
# 仓库根目录执行(重建 deploy\incr-asm-bom-full-20261105\ 的派生物并打 zip)
powershell -NoProfile -ExecutionPolicy Bypass -File tools\archive\_assemble-asm-bom-full-pkg.ps1
# 产物:deploy\incr-asm-bom-full-20261105\  +  deploy\incr-asm-bom-full-20261105.zip
# 成功标志:RESULT: PKG-OK
```

> 包里的 SQL 副本 / `tools/` / `SHA256SUMS.txt` 都是**派生物**(由上述脚本从仓库真源重建并逐字节校验),
> 已按仓库惯例加入 `.gitignore`;README-AI.md / apply.bat / check.bat / CHECK-after.sql 是源文件。
> 拷到服务器时把**整个目录**(或 zip)一起拷,不要只拷 apply.bat。

## 3. 包内文件

```
incr-asm-bom-full-20261105/
├─ apply.bat                              # 【源】一键:预检 → 备份库 → DbSync run → 只读核对(判 ALL-OK)
├─ check.bat                              # 【源】只读核对(任何时候都能跑,不改任何数据)
├─ CHECK-after.sql                        # 【源】核对 SQL(UTF-8 无 BOM;含中文列名,故 sqlcmd 必须 -f i:65001,o:65001)
├─ README-AI.md                           # 【源】本说明
├─ migrate-asm-bom-data-full-20261105.sql # 【派生物】导入脚本(与仓库 tools/ 同名文件逐字节一致)
├─ SHA256SUMS.txt                         # 【派生物】包内文件指纹
└─ tools/                                 # 【派生物】
   ├─ DbSync.java                         #   仓库 tools/DbSync.java 副本(run 模式把脚本登记进 yj_schema_log)
   ├─ db-migrations.txt                   #   仅供本项目 run 模式启动时读取(该模式不使用清单内容)
   └─ lib/mssql-jdbc.jar                  #   JDBC 驱动副本
```

> ⚠ 包内 `tools/` 只是为了让"一键"不依赖服务器上有没有仓库副本;正式迁移清单**唯一权威**仍是仓库
> `tools/db-migrations.txt`(本脚本已登记在末尾)。
> ⚠ `apply.bat` / `check.bat` 刻意保持**纯 ASCII + CRLF**(cmd.exe 在某些机器上会撕碎 UTF-8 中文 bat);
> `check.bat` 里 sqlcmd 读 CHECK-after.sql 时已按仓库惯例带 `-f i:65001,o:65001`,避免中文来源标记被读乱。

## 4. 执行(服务器,管理员 cmd)

```cmd
:: 0) 把本目录整个拷到服务器,例如 C:\yj-deploy\incr-asm-bom-full-20261105
::    不要放在 C:\yinjia 里面
:: 1) 只读预检(可选但建议)
certutil -hashfile apply.bat SHA256
:: 2) 一键执行(会先备份 HSDZ_MES 再导)
apply.bat
```

`apply.bat` 输出依次应为:

```
RESULT: PREFLIGHT-OK            ← 库在、bs_asm_bom 表在
[2] backup HSDZ_MES ...
RESULT: BACKUP-PASSED bak=pre-asm-bom-full-<时间戳>.bak
[3] run migration ...
  [print] [INFO] asm-bom full import: rows=3640 docs=827 prods=817 missing_unit=0 blank_sub=0 bad_seq_doc=0 ...
  [print] [PASS] asm-bom full import self-check OK
  [OK] 23 batches
RESULT: MIGRATION-OK
[4] verify ...
rows=3640 docs=827 prods=817 missing_unit=0 bad_seq_docs=0
schema_log=1 multi_version_products=10 other_source_rows=0
panel_docs=827
RESULT: ALL-OK
```

判据:`apply.bat` 会 **findstr 硬断言前 6 项**(rows/docs/prods/missing_unit/bad_seq_docs/schema_log),后 3 项(multi_version_products/other_source_rows/panel_docs)只打印、需人工核对(服务器上通常为 10 / 0 / 827):

| 断言 | 期望值 | 含义 |
|---|---|---|
| `rows=` | **3640** | 本来源子件行数 |
| `docs=` | **827** | BOM 单据数 |
| `prods=` | **817** | 父产品数 |
| `missing_unit=` | **0** | 计量单位缺行数(金蝶「分子单位」兜底 + 存货档案覆盖) |
| `bad_seq_docs=` | **0** | 行序不连续的单据数 |
| `schema_log=` | **1** | DbSync 已把本脚本登记进 `yj_schema_log` |
| `multi_version_products=` | **10** | 有两版 BOM 的产品数 |
| `other_source_rows=` | 服务器应为 **0** | 面板手工新建 BOM 的行数(导入前如果有,导入后必须还是同样的数) |
| `panel_docs=` | 服务器应为 **827** | 面板可见单据数(含手工新建的会更大) |

## 5. 只读核对(不导数据也能跑)

```cmd
check.bat
```

## 6. 回滚

- **整库回退**:还原 `C:\yinjia\backup\pre-asm-bom-full-<时间戳>.bak`
  (⚠ 会丢掉备份之后的业务写入,非必要别用)。
- **只回到旧口径(236 产品)**:部署脚本**不会**把 `tools/` 装到 `C:\yinjia`,所以别去那里找。
  做法:取任意一个历史增量包(或仓库)里的 `tools\`(含 `DbSync.java` + `lib\mssql-jdbc.jar`
  + `db-migrations.txt`),把仓库 `tools\migrate-asm-bom-data-20261030.sql` 拷进该 `tools\`,
  然后在该目录执行 `java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-20261030.sql`
  (该脚本按同一 `来源` 标记先删后插,终态回到 1085 行;仍然幂等)。

## 7. 与常规增量部署的关系

- 本脚本已登记仓库 `tools/db-migrations.txt`,但**增量部署不会自动把新脚本放进 to-run 清单**:
  `deploy-incremental.bat` 的 to-run 是每个包手工定稿的(见 `deploy/to-run-*.txt` / 打包脚本)。
  所以二选一:
  1) **推荐**:本次先跑本包 `apply.bat` 一次性灌数(幂等);
  2) 或下次打增量包时把 `migrate-asm-bom-data-full-20261105.sql` 明确写进该包的 to-run 清单。
  ⚠ **只把脚本放进 `tools/` 而不进 to-run 的后果**:`deploy-incremental.bat` 的 `DbSync baseline`
  会「只登记不执行」、随后 `sync` 判「跳过」⇒ 服务器永远没有这批数据。
- 已经执行过 `apply.bat` 的:`yj_schema_log` 已有同名脚本记录,后续 `sync` 复核会判「跳过」,不会重跑。

## 8. 本地(开发机)执行记录 2026-11-05

两账套均已执行并复核:

| 账套 | 明细行(本来源) | 单据 | 产品 | 缺计量单位 | DbSync |
|---|---|---|---|---|---|
| `HSDZ_MES`(正式) | 3640 | 827 | 817 | 0 | 23 batches,自检 `[PASS]`;复跑同样 PASS(幂等) |
| `HSDZ_MES_TEST`(测试) | 3640 | 827 | 817 | 0 | 23 batches,自检 `[PASS]`;复跑同样 PASS(幂等) |

- 独立核对(`tools/archive/_asm-bom-import-full-20261105/verify.py`)两模式全 PASS:
  SQL 文本 ↔ Excel 逐行逐字段、库内数据 ↔ Excel 逐行逐字段(含其它来源行未被动)。
- 面板接口实测(本地 8090):`ASM_BOM` 列表 `totalSize=827`;产品 `A-48-05` 返回 2 张单
  (`A-48-05_V0001/V0002`);单据 `A-48-05_V0002` 明细 9 行、计量单位齐全。

## 9. 指纹

见 `SHA256SUMS.txt`(由组装脚本生成,sha256sum 格式 `hash *相对路径`)。核验:
```cmd
certutil -hashfile migrate-asm-bom-data-full-20261105.sql SHA256
certutil -hashfile tools\lib\mssql-jdbc.jar SHA256
```
