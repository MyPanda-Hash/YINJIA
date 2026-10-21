# _wo-completion-order-20261021 —— 完工明细列表按完工时间倒序(2026-10-21 任务产物)

用户口径:「让当前完工明细的数据按时间排列从上到下进行,上面是新日期的,下方为旧日期的」。

## 结论

- 面板 `WO_COMPLETION_LIST` 是 flat 只读视图 `v_wo_completion_detail`;建面板时 `date_col` 留空,
  `QueryService.queryFlat` 因此退回 `ORDER BY t.id DESC`(报工行自增 id 顺序)。id 顺序 ≠ 完工时间顺序,
  补录/多工单并行报工后新旧行交错 —— 实测正式库里 `id=3338`(完工 10-15)排在 `id=3337`(完工 10-16)上面。
- 修法(只改元数据):`yj_panel.date_col = N'wgsj'` ⇒ `ORDER BY t.[wgsj] DESC, t.id DESC`。
  迁移脚本 `tools/migrate-wo-completion-sort-20261021.sql`,两账套已执行(幂等,重复执行 `[OK] 1 batches`)。

## 验证(2026-10-21)

| 账套 | 行数 | 第一行(最新) | 末行(最旧) | 结论 |
|---|---|---|---|---|
| HSDZ_MES(YJ) | 1153 | 2026-10-20 01:10:53 | 2026-10-12 16:40:00 | 非递增 ✅ |
| HSDZ_MES_TEST(YJ_TEST) | 12 | 2026-10-16 18:01:12 | 2026-08-10 09:58:56 | 非递增 ✅ |

```bash
node tools/archive/_wo-completion-order-20261021/_check-api.mjs            # 正式账套 YJ
FACTORY=YJ_TEST node tools/archive/_wo-completion-order-20261021/_check-api.mjs
```

`_check-api.mjs` 登录 8090 后拉 `WO_COMPLETION_LIST` 第一页,断言「完工时间」非递增(新日期在上、旧日期在下)。

## 文件

- `_Q.java` —— 查面板元数据 + 完工行(按 id)与视图列,改前取证。
- `_Refs.java` —— 查 `ref_panel='WO_COMPLETION_LIST'` 引用数(0,`date_col` 不影响参照带回)与空 `wgsj` 行数(0)。
- `_Pending.java` —— 对比清单与 `yj_schema_log`,确认两个账套只待执行本任务这一条迁移。
- `_check-api.mjs` —— 浏览器同款接口回归探针(见上)。
