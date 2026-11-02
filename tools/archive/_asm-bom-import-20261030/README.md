# 组装物料清单(BOM)导入 — 2026-10-30

task-2(负责人 bom-import)。从金蝶导出的 BOM 表生成 `bs_asm_bom` 导入 SQL,并在**两个账套**执行。

## 产物

| 文件 | 说明 |
|---|---|
| `tools/migrate-asm-bom-data-20261030.sql` | **导入脚本**(UTF-8 无 BOM,幂等,7 批) |
| `tools/archive/_asm-bom-import-20261030/gen-asm-bom.mjs` | 生成器(node,读 Excel → 生成 SQL + 报告) |
| `tools/archive/_asm-bom-import-20261030/verify-static.py` | 静态核对(openpyxl 独立重算 vs SQL 逐行对账) |
| `tools/archive/_asm-bom-import-20261030/gen-report.json / .md` | 生成期对账报告(每产品子件数、多版本跳过、用量样例) |
| `tools/archive/_asm-bom-import-20261030/in-production-products.txt` | 在产产品清单(plang 未作废行 distinct dm,244 个) |
| `tools/archive/_asm-bom-import-20261030/db-probe.txt` | 取在产清单/表结构/`bs_inv` 列的 DB 探针原始输出 |
| `check-formal.txt` / `check-HSDZ_MES.txt` / `check-HSDZ_MES_TEST.txt` / `check-detail.txt` | 两账套执行后自检查询输出 |

## 数据来源

`C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx`
sheet「列表数据」,共 3642 行(表头 1 + 数据 3641),73 列。实际用到的列(1 基):
产品名称 1、产品编码 2、规格型号 3、物料编码 4、物料名称 5、规格型号(子件) 6、编码(BOM 编号) 10、
用量:分子 11、用量:分母 13、使用状态 15、默认BOM 16、工艺路线编码 25、工艺路线名称 26、行备注 32。

## 口径

- **块结构**:产品编码非空的行开新块(该行同时是块内第 1 行子件),同块后续行是子件。827 块 / 817 个父产品。
- **范围**:plang 未作废行(`ISNULL(asp_cancel,'N')<>'Y'`)distinct dm = 244 个在产产品
  ∩ Excel 父产品 817 = **236 个产品**;在产但无 BOM 的 8 个(`A-32-13, A-32-17, A-32-26, B-65-04,
  C-95-32, D-01-18, S092-2, T042-6`)按约定不导、不造数。
- **每产品一张 BOM**:优先 `默认BOM='是'`;否则取 `编码 _V 后缀数字最大`。本批实际跳过多版本块 2 个:
  `D-01-49_V0001`(取 V0002)、`S051-2_V0001`(取 V0002)。Excel 另有 8 个多块产品不在产、整体不导:
  A-48-05 / A-48-34 / B-35-03 / B-49-01-1 / B-88-12 / C-103-03 / T073-3 / T123-2。
- **字段映射**:见生成器与 SQL 头注;`标准用量=ROUND(分子/分母,4)`(分母空/0 按 1)、`损耗量=0`、
  `计量单位` 插入时留空,脚本末尾由 `bs_inv.计量单位` 按 `存货编码=子件编码` 回填(查不到保持 NULL)。
- **幂等**:脚本开头 `DELETE FROM dbo.bs_asm_bom WHERE 来源=N'金蝶BOM引出列表_20261019174847';`
  只清理本来源的行,再全量插入;重复执行行数不变(已两账套各复跑一次验证)。

## 重跑方式

```powershell
# 1) 重新生成 SQL(可选:--xlsx/--prod/--out 覆盖默认路径)
node tools/archive/_asm-bom-import-20261030/gen-asm-bom.mjs
# 2) 静态核对(独立 openpyxl 重算 + 与 SQL 逐行对账)
python tools/archive/_asm-bom-import-20261030/verify-static.py
# 3) 两个账套执行(先正式、后测试)
cd tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-20261030.sql
$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-data-20261030.sql
```

在产清单重取(plang 变了才有必要):

```sql
SELECT DISTINCT dm FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY dm;
```
(用 `tools/archive/_1019-questions/Q.java` 查,输出写到本目录 `in-production-products.txt`)

## 执行结果(2026-10-30)

| 账套 | 行数 | 单据数 | 产品数 | 缺计量单位行 | DbSync |
|---|---|---|---|---|---|
| HSDZ_MES(正式) | 1085 | 236 | 236 | 0 | 7 batches OK,自检 `[PASS]` |
| HSDZ_MES_TEST(测试) | 1085 | 236 | 236 | 11 | 7 batches OK,自检 `[PASS]` |

- 两账套各复跑一次(第二次执行),行数/单据数/产品数不变 → 幂等成立;`yj_schema_log` 两账套各有
  `migrate-asm-bom-data-20261030.sql` 记录。
- 测试库 11 行缺计量单位:10 个 `子件编码`(`B-85-07**TB`、`YJ-GL-047/048/049`、`YJ-JPL-068`、
  `YJ-KG-JC-B03`、`YJ-TB-011/012/013`、`YJ-YCYX-055`)在测试库 `bs_inv` 快照里没有/无量纲,
  属测试库陈旧快照的预期差异,正式库 0 行缺失。
- 数据侧附加核对(两账套,均为 0 行异常):`工序<>'组装'`、`损耗量<>0`、
  `ABS(标准用量-ROUND(用量分子/用量分母,4))>0.00005`、`单据编号` 不以 `_版本号` 结尾、
  `asp_user1<>'金蝶BOM导入'` / `asp_cancel<>'N'` / `asp_time1 IS NULL`、行序非 1..n 连续。
  行备注非空 227 行(含 90 行 `整箱套袋` 原样保留),工艺路线名称非空 1070 行(3 个产品 Excel 本身为空)。

## 遗留 / 注意

- `tools/db-migrations.txt` 的登记属 Lead 写作用域,本任务未改(执行走 `DbSync run`,不依赖清单);
  **如需纳入常规 `sync` 增量,请 Lead 补一行 `migrate-asm-bom-data-20261030.sql`**。
- Excel 块 `T410_V0001` 在源表里子件编码为空(仅 1 行),该产品不在在产范围,未进导入;生成器对
  「选中块含空子件编码」会直接报错拒绝生成,防止静默丢行。
- 生成器不新增 node 依赖:复用 `frontend/node_modules/xlsx`(SheetJS 0.18.5)。
