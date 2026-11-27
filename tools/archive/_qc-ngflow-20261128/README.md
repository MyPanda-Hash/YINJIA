# _qc-ngflow-20261128 —— 来料不合格分支改道(特采单 → 不合格品处理单(来料)) 取证与复跑

用户口径(2026-11-28,原文见迁移脚本 `tools/migrate-qc-ng-disposal-20261128.sql` 头注):
① 特采单改名「不合格品处理单(来料)」并挂回 品质管理 > 来料品质;② 不再经退料单,取消暂收退料单的特采字段;
③ 检验数据记录「检验结论=不合格」审批通过 → 自动生成并进入处理单,检验结论格可点进处理单;
④ 处理单审批通过后回填来料检验单明细「特采」,据此判断不合格数量进采购入库(让步接收)还是暂收退料。

## 复跑顺序(都在 `D:\YINJIA-main` 下)

| 步 | 命令 | 作用 |
|---|---|---|
| 0 | `cd tools && YINJIA_SQL_DB=HSDZ_MES java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-ng-disposal-20261128.sql`(再跑一次把 `HSDZ_MES_TEST` 也跑一遍) | 元数据/列变更(幂等) |
| 1 | `java -cp lib/mssql-jdbc.jar archive/_qc-ngflow-20261128/_Q.java archive/_qc-ngflow-20261128/setup.sql HSDZ_MES_TEST` | 把 IJ-2026-11-0007 / JYSJ-2026-11-0021 置成可跑状态(送检 100 / 合格 60 / 不合格 40,结论=不合格) |
| 2 | `powershell -ExecutionPolicy Bypass -File tools/archive/_qc-ngflow-20261128/verify-flow.ps1` | 端到端:记录提交+审批通过 → 自动生成处理单 → 两级审批通过 → 检验单审核按特采分流入库 |
| 3 | `java ... _Q.java .../q16.sql HSDZ_MES_TEST` | 取证:检验行 特采=1 / 入库单(特采=是,来源=不合格品处理单(来料))/ 链路 备用1=特采·备用2=处理单号 |
| 4 | `powershell ... verify-qcflow-api.ps1` | 品质监控接口口径(不合格品处理单号/状态/特采 + 汇总「待不合格品处理」) |
| 5 | `ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/qc-ngflow-20261128/round-09.mjs')"` 等 | 界面取证(纸面标题/检验结论链接/品质监控节点),截图见 round-*.png |
| 6 | `java ... _Q.java .../cleanup.sql HSDZ_MES_TEST` | 收尾:清掉本轮造出的单/链路并还原数量,自检 6 列全 0 |

## 本轮结果(2026-11-28 实测)

- 记录审批通过 → 生成 `TCI-2026-11-0007`(供应商/采购单号/产品名称/总数量 100/不合格品数量 40/比例 40%/
  不良说明=记录处理意见/检验单号/检验数据记录单号/批次号 全部带出),记录回填单号;
- 处理单两级审批通过 → 检验行 `特采 = 1`;
- 检验单审核 → 合格 60 → `PI-2026-11-0023`(`特采=否`)/ 不合格 40 → `PI-2026-11-0024`
  (`特采=是`,来源单据 `不合格品处理单(来料)`,来源单号 `TCI-2026-11-0007`);
- 品质监控:节点名 `不合格品处理单(来料)`、汇总出现「待不合格品处理」、行上带 `特采`;
- 界面:纸面标题「不合格品处理单（来料）」、检验结论格出现「不合格品处理单 TCI-2026-11-0007」链接并可跳转。

## 文件说明

- `_Q.java` + `q*.sql`:一次性只读查询器与逐轮取证 SQL(UTF-8 无 BOM;`_Q` 打印 TSV)。
- `setup.sql` / `reset.sql` / `cleanup.sql`:造数、重跑前归零、收尾清理。
- `verify-flow.ps1` / `verify-qcflow-api.ps1`:接口级端到端与监控口径核对(UTF-8 **带 BOM**,
  Windows PowerShell 5.1 读无 BOM 脚本会把中文变乱码)。
- `round-*.mjs` / `round-*.png`:ego-browser 界面取证脚本与截图(每轮一个新文件,不覆盖)。
- `_edit-*.cjs` / `_splice.cjs` / `newblock.java.txt`:本轮的批量改文件脚本与插入的 Java 代码块
  (一次性 codemod,留档以便解释 diff 来源,不再需要执行)。
