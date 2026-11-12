# _qc-asm-yj154-20261112 —— 出货检验表观(QC_ASM_INSP)接图2 表样:落库与元数据(取证包)

任务:team task-7(Db/元数据)。迁移脚本 `tools/migrate-qc-asm-insp-batch-table-20261112.sql`,
**两账套已执行**(HSDZ_MES、HSDZ_MES_TEST),`DbNormAudit` 前后对比见本目录 4 份日志。

## 1. 一句话结论

「出货检验表观」(`QC_ASM_INSP`)现在与「出货检验单功能」(`QC_PROC_INSP`)是**同一套数据/元数据**:
`qc_asm_insp_detail.内部批次` + `qc_asm_insp_head.内部批次清单 / 表单审核人` 三列(均带中文注明),
`yj_field` 三行(明细可见 / 表头隐藏存取),总结论·处理方式两个下拉框,**面板名/代号/底表/前缀 ZJ 未动**。

## 2. 执行记录(两条命令,均 exit 0)

```bash
cd tools
YINJIA_SQL_DB=HSDZ_MES      "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-asm-insp-batch-table-20261112.sql
#  [connected] Microsoft SQL Server @ HSDZ_MES as yinjia
#  == migrate-qc-asm-insp-batch-table-20261112.sql ==
#    (0 rows)
#    [OK] 8 batches

YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-asm-insp-batch-table-20261112.sql
#  == migrate-qc-asm-insp-batch-table-20261112.sql ==
#    (0 rows)
#    [OK] 8 batches
```

- 只跑本脚本,**没有**跑整链(整链会带上别人的新迁移)。
- 幂等:两账套各复跑一次仍 `[OK] 8 batches`,0 行变更(脚本内 NOT EXISTS / UPDATE 带差异条件)。
- ⚠ `DbSync` 不显示 `PRINT`,所以脚本第 0/6 节的 `[OK] …` / 自检文字在终端看不到 ——
  但自检失败会 `RAISERROR(...,16,1)` ⇒ DbSync 打印 `[SQL失败]`、退出码非 0、且**不写** `yj_schema_log`;
  本次两账套都写了 `yj_schema_log`(见 §4),说明 §6 自检 PASS。
- 指纹:`sha256(migrate-qc-asm-insp-batch-table-20261112.sql)` = `382a4ec6ad859ec9c19a05403db58ad191f18c12f312efe2cb1d0d0a6fbed4a5`,
  与两账套 `yj_schema_log.content_hash` **逐字符相同**(⇒ 两库跑的确实是当前这一版字节;已核对)。
- 另登记 `tools/db-migrations.txt` 末尾 3 行(空行 + 注释 + 脚本名,CRLF),并同步 `docs/development/数据库表清单.md`
  第 271/272 行(qc_asm_insp_head 35→**37** 列、qc_asm_insp_detail 27→**28** 列 + 新增列说明 + 关联面板名改「出货检验表观」)。

## 3. 只读复核(两账套结果一致)

新列(`sys.columns`,`max_length/2` 为字符数):

| 表 | 列 | 类型 | 可空 |
|---|---|---|---|
| qc_asm_insp_detail | 内部批次 | nvarchar(60) | NULL |
| qc_asm_insp_head | 内部批次清单 | nvarchar(500) | NULL |
| qc_asm_insp_head | 表单审核人 | nvarchar(50) | NULL |

`yj_field`(panel_code='QC_ASM_INSP'):

| col_name | data_type | place | seq | hidden | visible | editable | required | dict_sql |
|---|---|---|---|---|---|---|---|---|
| 内部批次 | 文本 | detail | 910 | 0 | 1 | 1 | 0 | — |
| 内部批次清单 | 文本 | header | 295 | 1 | 0 | 1 | 0 | — |
| 表单审核人 | 文本 | header | 296 | 1 | 0 | 1 | 0 | — |
| 总结论 | 下拉框 | query,header | 160 | 0 | 1 | 1 | 0 | `SELECT v FROM (VALUES (N'合格'),(N'不合格')) AS t(v)` |
| 处理方式 | 下拉框 | header,detail | 90 | 0 | 1 | 1 | 0 | `SELECT v FROM (VALUES (N'允收'),(N'合格'),(N'不合格'),(N'报废')) AS t(v)` |

- 面板:`QC_ASM_INSP | 出货检验表观 | Outgoing Inspection Sheet (Appearance) | head=qc_asm_insp_head | line=qc_asm_insp_detail | prefix=ZJ`(未动)。
- 字段总数 44 → 47(新增 3 行);`检测周期`/`实测数值` 的 yj_field 行 = **0**(派生列不建、实测数值不重复登记)。
- 译名:`内部批次 / 内部批次清单 / 表单审核人 / 检测周期` 各 **10 语种**;面板键「出货检验表观」10 语种(2026-11-11 已有,本脚本 NOT EXISTS 未重复插)。
- 存量数据未动:HSDZ_MES 头 439 / 明细 1356;HSDZ_MES_TEST 头 115 / 明细 178。

## 4. 体检结论(`verify/DbNormAudit.java`,两账套,前后各跑一次)

日志:`audit-HSDZ_MES.{before,after}.txt`、`audit-HSDZ_MES_TEST.{before,after}.txt`。

| 项 | HSDZ_MES | HSDZ_MES_TEST |
|---|---|---|
| 05 元数据漂移 | PASS(前后一致) | **FAIL 14 处(前后一致;全部是既存的 v_* 视图漂移,无本次对象)** |
| 07 完全重复的字段登记行 | PASS | PASS |
| 13 面板引用对象缺 pk_col/asp_cancel | PASS | FAIL 6 处(前后一致;既存的 MATERIAL_OUT/SALE_OUT/PURCHASE_IN 视图缺 id) |

- 两账套汇总数**前后一致**:正式 `FAIL 3 / WARN 1`(02/09/12 为既存)、测试 `FAIL 7 / WARN 1`(01/02/03/05/09/12/13 为既存)。
- 唯一变化:第 12 项「迁移链清单 ↔ 文件一致」**18 处 → 17 处**,`migrate-qc-asm-insp-batch-table-20261112.sql`
  从「未登记的脚本」名单里消失(= 已登记进 `tools/db-migrations.txt`);其余 17 处仍是别人的既存未登记脚本。
- 「本次对象被点名」检查:`grep -E "qc_asm_insp|QC_ASM_INSP|内部批次|表单审核人|检测周期"` 在两份 after 日志里 **0 命中**。

## 5. 复跑命令

```bash
# 执行(幂等;只跑本脚本)
cd tools && YINJIA_SQL_DB=HSDZ_MES      "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-asm-insp-batch-table-20261112.sql
cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-asm-insp-batch-table-20261112.sql

# 体检
cd tools && YINJIA_SQL_DB=HSDZ_MES      YINJIA_SQL_PASS='<口令>' "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar verify/DbNormAudit.java
cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST YINJIA_SQL_PASS='<口令>' "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar verify/DbNormAudit.java

# 只读复核(探针)
cd tools && "$JAVA_HOME/bin/java" -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_Query.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia "<口令>" \
  "SET NOCOUNT ON; SELECT col_name,data_type,place,seq,hidden,visible,dict_sql FROM yj_field WHERE panel_code=N'QC_ASM_INSP' AND col_name IN (N'内部批次',N'内部批次清单',N'表单审核人',N'总结论',N'处理方式') ORDER BY seq;"
```

`_append-miglist.sh` = 一次性脚本:把脚本名追加到 `tools/db-migrations.txt` 末尾(空行 + 注释 + 脚本名,CRLF,
与文件既有换行一致;已登记则 no-op,不改其它行)。

## 补充(Lead 整体验收,2026-11-12)

- **UI(正式库)**:出货检验表观 ZJ-2026-10-0135 —— 标题=出货检验表观、右上「表单编号：YJ-QR-154」、
  抬头 3 行 2 组(检测周期 `2026-10-18 07:46 ~ 2026-11-01 05:15` 由后端派生)、检验明细 18 行、
  每行「录入对应结果」显示的是该单历史的「检验结果」值、表尾 检验人/审核人/处理意见(旧值「合格转库存(FI-…)」原样显示);
  左栏「单据选择」仍在。脚本 `round-47.mjs`。
- **落库往返(测试账套 YJ_TEST,ZJ-2026-10-0071 ≠ 正式库同一张单)**:`round-43.mjs` 用真实保存接口提交
  3 个检验项目 × 2 内部批次(261201/261202)+ 内部批次清单 + 表单审核人=冯敏 ⇒ 读回 6 行、每批 3 行、
  每格「检验结果」「结果判断」正确、检测周期照常派生;验完 `round-44.mjs` 已把该单还原成原始 3 行。
- 注意:UI 验收前必须**强制刷新**(SPA 同 hash 的 goto 不会重载文档,会看到后端重启前的旧数据)——
  README 这一轮踩过一次,排查记录见 round-46/47。
