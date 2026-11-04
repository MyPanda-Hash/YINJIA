# 组装物料清单(ASM_BOM)全量导入 — 2026-11-05

> 用户口径(2026-11-05):「这个是当前系统的组装物料清单的内容,需要实现一个一次性脚本能够成功的
> 导入到当前本地全部导入,同时这个脚本要能导入到服务器中去。」
>
> 即:把金蝶 BOM 引出表**全部**灌进 `bs_asm_bom`,并且交付一份能在服务器上跑的脚本/包。

## 一、背景:为什么是"全量"

2026-10-30 那次(见 `tools/archive/_asm-bom-import-20261030/`)只导了
「`plang` 在产产品 ∩ Excel 父件」= **236 个产品 / 1085 行**;Excel 里另有 581 个产品没进库。
本次按用户新口径导**全部**:

| 指标 | 数值 |
|---|---|
| Excel 数据行 | 3641(含末尾 1 行「合计」汇总行:产品名称=`合计`、其余关键列空,丢弃) |
| BOM 块 | **827** |
| 父产品 | **817**(10 个产品各有 2 个版本块) |
| 子件行 | **3640** |
| 工序 | 组装(全部) |
| 默认BOM='是' 的块 | 13 |
| BOM 级备注非空块 | 304(第 7 列 `备注`) |
| 行备注非空行 | 782 |
| 工艺路线名称/产品规格为空 | 34 / 32 个块 |

多版本产品(**全部保留**,各成一张单据,不丢历史版本):A-48-05 / A-48-34 / B-35-03 / B-49-01-1 /
B-88-12 / C-103-03 / D-01-49 / S051-2 / T073-3 / T123-2。

## 二、产物

| 文件 | 说明 |
|---|---|
| `tools/migrate-asm-bom-data-full-20261105.sql` | **导入脚本**(UTF-8 无 BOM,1.30MB,23 批:建表守卫 + DELETE + 19 批 INSERT + 计量单位 UPDATE + 自检) |
| `deploy/incr-asm-bom-full-20261105/` | **服务器一次性导入包**(apply.bat 一键:预检→备份→DbSync run→只读核对;详见包内 README-AI.md) |
| `tools/archive/_assemble-asm-bom-full-pkg.ps1` | 包组装器(从仓库真源重建包内 SQL 副本/tools/SHA256SUMS 并打 zip;产物部分已 .gitignore) |
| `tools/db-migrations.txt` | 末尾登记本脚本(⚠ 增量部署**不会**自动进 to-run 清单,详见 `deploy/incr-asm-bom-full-20261105/README-AI.md` §7) |
| `tools/archive/_asm-bom-import-full-20261105/gen-asm-bom-full.mjs` | 生成器(node + SheetJS,Excel → SQL + 报告) |
| `tools/archive/_asm-bom-import-full-20261105/verify.py` | 独立核对器(openpyxl 重算,static / runtime 两模式) |
| `tools/archive/_asm-bom-import-full-20261105/DumpSql.java` | 只读导出器(整表 TSV,无 500 行上限) |
| `tools/archive/_asm-bom-import-full-20261105/gen-report.json / .md` | 生成期对账报告 |
| `tools/archive/_asm-bom-import-full-20261105/{exec-,verify-,check-after-,panel-api-}*.txt` | 两账套执行/独立核对/面板接口证据(本目录) |

## 三、口径与字段映射

- **块结构**:产品编码(第 2 列)非空的行开新块,该行同时是块内第一个子件;同块后续行都是子件。
- **合计行**:末尾 1 行是「合计」汇总行(`产品名称=合计`、其余关键列空),不是子件 —— 按「子件关键列全空」丢弃。
  `T410_V0001` 块实际就是 6 行;全表有效子件行 = 3640。
- **字段**:单据编号=`编码`(如 `A-32-01_V0009`)、产品编码/名称/规格=块头、工序=`组装`、
  版本号=`_V` 后缀、默认BOM/使用状态(→状态)/工艺路线名称照抄、行序=块内 1..n、
  子件编码/名称/规格=第 4/5/6 列、标准用量=`ROUND(分子/分母,4)`、用量分子/分母保留原值、
  损耗量=0、行备注=第 32 列、**备注=第 7 列(BOM 级,上一版漏导,本次补上)**。
- **计量单位**:先写 Excel「分子单位」(3640 行全部非空,且与 `bs_inv.计量单位` 本地实测 **0 差异**),
  插入后按 `bs_inv.计量单位` 覆盖(存货档案优先;档案查不到的保留金蝶分子单位)⇒ 两账套 `missing_unit=0`。
- **幂等**:开头 `DELETE FROM dbo.bs_asm_bom WHERE 来源 = N'金蝶BOM引出列表_20261019174847';`
  再全量插入。只动本来源的行,**不碰面板手工新建的 BOM**;零 DDL、零结构变更。
- **与上一版关系**:本脚本是 `migrate-asm-bom-data-20261030.sql` 的超集,两脚本顺序执行终态 = 本脚本
  (新环境整链重放:先 236 后 3640,多执行一次删除插入,结果一致)。

## 四、验证证据(本地两账套已执行)

### 4.1 执行

```powershell
cd tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-full-20261105.sql
$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-full-20261105.sql
```

两账套输出均为:

```
[print] [INFO] asm-bom full import: rows=3640 docs=827 prods=817 missing_unit=0 blank_sub=0 bad_seq_doc=0 bad_std=0 bad_proc=0 bad_loss=0 bad_cancel=0
[print] [PASS] asm-bom full import self-check OK (expect rows=3640 docs=827 prods=817)
[OK] 23 batches
```

**幂等复跑**:两账套各再跑一次,结果同上(行数/单数/产品数不变)。

### 4.2 独立核对(`verify.py`)

| 模式 | 内容 | HSDZ_MES | HSDZ_MES_TEST |
|---|---|---|---|
| `static` | 解析 SQL 文本 ↔ openpyxl 重算 Excel,逐行逐字段 | **PASS**(3640 行全对,26 列×3640) | 同(脚本与库无关) |
| `runtime` | 库内 dump ↔ openpyxl 重算 Excel,逐行逐字段;其它来源行须保留 | **PASS**(3640 行全对;其它来源 2 行未动) | **PASS**(3640 行全对;其它来源 0) |

核对覆盖字段:单据编号/产品编码/产品名称/规格型号/工序/版本号/默认BOM/工艺路线名称/来源/状态/
行序/子件编码/子件名称/子件规格/标准用量/用量分子/用量分母/损耗量/行备注/备注/asp_user1/asp_cancel。

### 4.3 取数口径回归(领料端 / 报工端)

代码两端(2026-11-04 起同口径)排序 = `默认BOM=是 → 版本号 DESC → 单据编号 DESC`,实测:

| 场景 | 产品 | 结果 |
|---|---|---|
| 多版本且都无默认BOM | `A-48-05` | 取 `A-48-05_V0002`(版本号最大)✅ |
| 有默认BOM | `B-38-17` | 取 `B-38-17_V0001`(默认BOM=是)✅ |
| 明细行 | `A-48-05_V0002` | 9 行,计量单位 支/张/PCS/个 全齐,标准用量 1/2/0.04/0.32 ✅ |

在产覆盖(未变,属预期):`plang` 在产 244 产品中 **236 个有组装 BOM**;其余 8 个
(A-32-13/A-32-17/A-32-26/B-65-04/C-95-32/D-01-18/S092-2/T042-6)Excel 本身没有 BOM,不造数。

### 4.4 面板接口实测(本地 8090,admin)

- `GET /api/px/getPanelConfig?panelCode=ASM_BOM` → 200,面板「组装物料清单」,列表分页 100;
- `POST /api/px/queryFormDataList` countOnly → **totalSize=827**;
- 产品 `A-48-05` 查询 → 2 张单 `A-48-05_V0002 / A-48-05_V0001`;
- `getFormDescriptor?code=A-48-05_V0002` → 明细 9 行(与 Excel 一致)。

### 4.5 服务端包自测

包内 `tools/` 的 DbSync + 最小清单 + SQL 副本在本地对 `HSDZ_MES` 实跑 → `[OK] 23 batches` + 自检 PASS;
`CHECK-after.sql` 实测输出 `rows=3640 docs=827 prods=817 missing_unit=0 bad_seq_docs=0` /
`schema_log=1 multi_version_products=10 other_source_rows=2` / `panel_docs=829`
(本地 `other_source_rows=2`、`panel_docs=829` 是面板开发期留下的 2 张空草稿 BOM;服务器应为 0 / 827)。

## 五、注意 / 遗留

1. **本地 2 张空草稿 BOM 未清**:`BOM-2026-10-0001`、`BOM-2026-11-0001`(来源为空、产品编码为空,
   是 2026-11-04「表头可维护」开发期点「新增」留下的空单)。本次导入**刻意不动其它来源**;
   要清需另行确认(它们让 `panel_docs=829` 而不是 827)。
2. **服务器尚未执行**:本次交付的是脚本+包,服务器上执行 `deploy/incr-asm-bom-full-20261105/apply.bat`
   (或随下次常规增量部署自动执行)。执行后需按 `deploy/部署台账.md` 规范记账。
3. **Excel 其余 53 列未落库**:审核状态/制单人/可用库存/质量管控点/BOM分组/计划策略等属金蝶单据
   元数据或库存快照,当前面板/表结构未建模;本次补了有业务含义的 `备注`(BOM 级),其余不塞。
4. 测试库是陈旧快照(`plang` 只有 15 个在产产品),其覆盖率与正式库不可比;数据本身与 Excel 全等。

## 六、重跑方式

```powershell
# 1) 重新生成 SQL(可选)
node tools/archive/_asm-bom-import-full-20261105/gen-asm-bom-full.mjs
# 2) 静态核对(SQL ↔ Excel)
python tools/archive/_asm-bom-import-full-20261105/verify.py static tools/migrate-asm-bom-data-full-20261105.sql
# 3) 两账套执行(先正式、后测试)
cd tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-full-20261105.sql
$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-full-20261105.sql
# 4) 运行时核对(先 dump 再比;TSV 输出路径用显式 Windows 路径)
java -cp lib\mssql-jdbc.jar archive/_asm-bom-import-full-20261105/DumpSql.java HSDZ_MES <dump_bom.sql> D:/dsh/cache/tmp/bom_full_prod.tsv
python tools/archive/_asm-bom-import-full-20261105/verify.py runtime D:/dsh/cache/tmp/bom_full_prod.tsv
```

`<dump_bom.sql>` 见本目录 `dump-bom.sql`(导出核对所需的 22 列)。
