# _merge-push-1016 — 对齐远端(merge origin/main)后本机首跑迁移失败的取证

**背景**:2026-10-16 本地 main 与 origin/main 各领先 13 条,合并后 `DbSync` 在
`migrate-align-docdate-batch-time-20261016.sql`(远端来的一条)**本机**报
`从字符串转换日期和/或时间时，转换失败` ⇒ `执行 0, 失败 1`,整条迁移链中止
(该条是协作机上写的,数据形态与本机不同)。

**诊断链**:

| 文件 | 结论 |
|---|---|
| `align-fail-probe.out` | SqlRunner 直接跑该脚本也是同一条报错(定位到脚本第一批) |
| `q9-align-probe.sql` / `q9.out` | 候选表与日期列类型清单;**`TRY_CONVERT` 在兼容级别 100 不存在**(不能用它兜底) |
| `q10-align-culprit.sql` / `q10.out` | 元凶:`bd_purchase_in` / `bd_sale_out` / `bd_material_out` 的 **`转ERP时间` 是 nvarchar**,其中 `ISDATE=0` 各 8 行(10-14 试运行批次);`创建时间`、`sl_recv`/`qc_insp` 的日期时间列都是干净文本 |
| `q11-erp-time-rows.sql` / `q11.out` | 那 24 行的实际值 = `Oct 14 2026 12:17PM`(应用 ERP 推送写下的 JS 日期串,`asp_user1=N'试运行'`) |
| `q12-good-shape.sql` 内联 | 同列里能解析的 310 行形态是 `yyyy-MM-dd` ⇒ 修正只需换**比较方式**,不必改写入表达式 |
| `merge-dbsync-prod.out` | 失败现场:`[SQL失败] 从字符串转换日期和/或时间时，转换失败` / `执行 0, 跳过 479, 失败 1` |
| `merge-dbsync-prod2.out` / `merge-dbsync-test.out` | 修正后:两账套各 `执行 4, 失败 0`(另三条远端脚本也随之下发) |

**处置**(见提交 `fix: 合并后修 migrate-align-docdate-batch-time-20261016.sql ...`):
§2 的 `转ERP时间` 改成**按列型分支** —— 日期列仍 `CONVERT(date, ..)`,文本列只比前 10 位
(`LEFT(转ERP时间,10) <> CONVERT(varchar(10), 单据日期, 120)`),写入表达式不变;
兼容级别 100 下没有 `TRY_CONVERT`,只能靠列型分流。
