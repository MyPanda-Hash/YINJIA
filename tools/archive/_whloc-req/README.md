# _whloc-req — 仓位体系方案评估的取证留档（2026-10-08）

一次性探针，配套文档 [`docs/plans/2026-10-08-仓位体系-方案评估.md`](../../../docs/plans/2026-10-08-仓位体系-方案评估.md)。

| 文件 | 是什么 |
|---|---|
| `excel-dump.txt` | 业务提供的 `仓库库位信息表.xlsx` 三个 Sheet 的逐格 dump（Sheet1 平面图 / Sheet2 编码总册 / Sheet3 空） |
| `expand2.py` | 把 Sheet2 编码总册展开成库位清单：拆 `1/2` 多值、展开 `1-36` 区间、标注 `D2-D7库位排列一样` 继承与 `AH5-1/2/3-1...` 截断 |
| `expand2.txt` | 上面脚本的输出：**老厂区 346 + 新厂区 641 = 987 条**，另 22 处截断待补、2 条继承规则 |
| `q-04.sql` | 库状态实测 SQL（`bs_wh_loc` 存量 / 20 处 `仓位*` 字段定义与数据量 / `kucun`·`inh`·`outh` 列 / `bs_wh` 全列） |
| `q-04-out.txt` | 上面 SQL 的输出（UTF-8） |
| `q-05-selfref.sql` | **当前库位实现能力实测**：`ref_panel = 自己` 的自参照先例（DEPT/FIN_ACC/FIN_EXP/REGION）、参照源分布、`yj_field` 全列（含 `ref_filter`）、archive 面板清单、WHLOC 是否被参照 |
| `q-05-out.txt` | 上面 SQL 的输出 —— 结论：**自参照是引擎既有能力（4 处先例），WHLOC 被零引用** |

## 复跑

```powershell
cd D:\workspace\yinjia\tools
# ⚠ PATH 上的 java 是 1.8(Oracle javapath)，源码模式跑不了；用 JDK 25
$env:JAVA_TOOL_OPTIONS = "-Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8"
& "C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe" -cp "lib\mssql-jdbc.jar" SqlRunner.java `
  "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" `
  yinjia "Yinjia@2026" "archive\_whloc-req\q-04.sql"

& "C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe" -cp "lib\mssql-jdbc.jar" SqlRunner.java `
  "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" `
  yinjia "Yinjia@2026" "archive\_whloc-req\q-05-selfref.sql"

& "D:\deepseek harness\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" archive\_whloc-req\expand2.py
```

> `JAVA_TOOL_OPTIONS` 里必须带 `-Dstdout.encoding=UTF-8`：否则 Java 走控制台代码页(936)，
> 中文列名全成乱码，`SqlRunner` 的 `Invalid column name '库位'` 这类报错也会看不清本名。
