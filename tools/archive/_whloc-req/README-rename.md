# 库位 → 仓位 改名：全量清单（取证留档 2026-10-08）

配套：`docs/plans/2026-10-09-库位改仓位-改名清单.md`

| 文件 | 用途 |
|---|---|
| `q-07-rename.sql` / `q-07-out.txt` | 库位相关**对象全量**：物理列 / 表索引约束 / yj_panel / yj_field / yj_translation(36行) / MS_Description / 视图 / 对照「仓位」列 |
| `q-08-conflict.sql` / `q-08-out.txt` | **改名冲突与依赖**：yj_translation 现有「仓位*」词条 + `uq_translation(scope,ref_key,locale)` 唯一键 + yj_field 同名 label + bs_wh_loc 索引/默认约束/依赖 |
| `q-09-sweep.sql` / `q-09-out.txt` | **兜底扫描**：在全部 `yj_*` 元数据表的所有字符列里搜「库位」，防止漏点 |

## 关键结论

1. **`yj_translation` 有唯一键 `uq_translation(scope, ref_key, locale)`**，且 `field/仓位编码/en`、`field/仓位编码/ja`、`field/仓位/en` **已存在**
   ⇒ 改名脚本必须**冲突感知**，不能无脑 `UPDATE ref_key`。
2. **`yj_field.col_name` 就是物理列名**（`QueryService.selectCols` 拼 `t.[col_name] AS [label]`）
   ⇒ 改 `col_name` 必须同步 `sp_rename`。
3. **历史日志不改**：`yj_archive_change_log.doc_no`(9行)、`yj_usage_log.doc_no`/`panel_name`(9+9行) 是历史事实快照（archive 面板虚拟单据编号=面板名），改了就成篡改审计。

## 复跑

```powershell
cd D:\workspace\yinjia\tools
$env:JAVA_TOOL_OPTIONS = "-Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8"
foreach ($q in @('q-07-rename','q-08-conflict','q-09-sweep')) {
  & "C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe" -cp "lib\mssql-jdbc.jar" SqlRunner.java `
    "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" `
    yinjia "Yinjia@2026" "archive\_whloc-req\$q.sql"
}
```
