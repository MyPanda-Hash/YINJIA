# 样品检验汇总表(INSP_SUMMARY)—— 取证与探针

任务:2026-11-17 用户口径「为当前的样品检验增加汇总表,能够查看到一天或者一周,送好多个样品,
测试啥的总表。要按一个时间范围,去导出有多少人送了啥样品测试啥,安排检测工作。」
设计与契约见 `docs/design/样品检验汇总表-首版.md`。

## 目录内容

| 文件 | 用途 |
|---|---|
| `probe-1.sql` | 面板/字段/委托单头行/状态分布(改版前摸底) |
| `probe-cols.sql` | `yj_field` 列清单(拼 SQL 前核对列名) |
| `probe-2.sql` | `yj_doc_status` 结构 + INSP_COMMISSION 状态行 |
| `probe-3.sql` | 迁移后核对:INSP_SUMMARY 授权行、译名条数、INSP_COMMISSION 对照 |
| `probe-4.sql` | 汇总取数 SQL 冒烟(与本服务同一条 SQL;正式库 2026-11-01~17 返回 1 单) |
| `probe-5.sql` | 委托单头/行明细分布(发现孤儿明细,见下) |
| `ego/round-01.mjs` | 5173/8090/English 首轮走查(截图 01~05) |
| `ego/round-02.mjs` | 5173「本月」点击诊断(截图 06) |
| `ego/round-03.mjs` | 5173 页面上下文直调接口(判定「0 行」是账套不同,不是接口问题) |
| `ego/round-04.mjs` | 8090 正式库完整取证:本月/按送样人/按委托单/展开/English(截图 07~10) |
| `ego/round-05.mjs` | **导出内容级取证**:拦截 blob + 用 xlsx 解析 3 个 sheet/行数/合计 |
| `ego/round-06~10.mjs` | 导出无反应的分层诊断(最终定位 `aoa_to_sheet` 标题行不是数组) |
| `ego/round-11.mjs` | 5173 切正式账套 YJ 后复验页面 + 导出(截图 12) |

## 复跑方式

```bash
# 探针(只读;需 YINJIA_SQL_PASS)
cd tools
java -cp lib/mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia env archive/_insp-summary-20261117/probe-4.sql

# 界面(ego 浏览器;5173 源码版 / 8090 打包版)
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_insp-summary-20261117/ego/round-04.mjs')"
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_insp-summary-20261117/ego/round-05.mjs')"
```

## 实测结果(2026-11-17 16:00 前后)

- 迁移:`DbSync run migrate-insp-summary-20261117.sql` 两个账套均 `[OK] 7 batches`;
  正式库 `INSP_SUMMARY` 授权 13 行(admin + 12 个能看委托单/送样登记表的角色),`view,query,export`;
  面板名译名 10 条。
- 页面(8090 / 5173-YJ):「本月」→ 送样人数 1 / 送样单数 1 / 检测项目项次 1 / 收费合计 106.00 /
  已审核 0 / 待检 1;两个页签与展开明细均正常;点单号可跳检验委托单。
- 导出:文件名 `样品检验汇总表_20261101-20261117.xlsx`(23681 字节),3 个 sheet =
  `按送样人 / 按委托单 / 检测明细`,表头与合计行与界面一致。
- English:`Sample Inspection Summary`;页签 `By sender / By commission / sample`;
  按钮 `Search / Reset / Export Excel`;业务数据(人名/样品名/单号)保持原值。

## 发现并已修的问题

1. **导出点了没反应(只在本任务新增页面上)**:首版 `aoa_to_sheet([title, ...])` 第 1 行传的是
   **字符串**而不是数组 ⇒ 运行时报 `Error: aoa_to_sheet expects an array of arrays`,
   Vue 事件处理器把异常吞进 console,界面无任何提示。改为统一 `headRow = [title]` 后复验通过
   (见 `ego/round-05.mjs` / `round-11.mjs`)。
2. **账套差异不是 Bug**:首轮 5173 报 0 行、8090 报 1 行 —— 5173 当时登录在「YJ_TEST 测试库」,
   正式库的委托单不在测试快照里;`ego/round-11.mjs` 切到 YJ 后数字一致(`ego/round-03.mjs` 取证)。

## 遗留观察(不在本任务范围)

- `qc_insp_commission_detail` 里有 **14 行明细挂在旧单号 `1`** 上,而当前唯一委托单的单号是 `14`
  (其下只有 1 行明细)。这些孤儿明细没有单头,因此**不会**进汇总(汇总以单头为锚),
  也不影响本页正确性;但说明「单据编号可手工改号」那次操作可能没有把这批历史明细一起挪过去,
  需要时另开任务核对 `ButtonService.renameDocNo` 与前端明细载荷的单号来源。
- `DbNormAudit` 正式库 `RESULT: FAIL-3`,三项均与本次改动无关(rd_sample_int_detail 缺表注释 /
  216 条缺 en 译名 / 17 个历史脚本未登记);本次**没有新增表或字段**,也没有新增未登记脚本
  (本任务脚本已登记进 `tools/db-migrations.txt`)。
