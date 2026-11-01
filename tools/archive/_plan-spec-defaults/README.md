# 「同品名同规格」族兜底 —— 勘察与验证取证(2026-10-29)

对应需求:订单结转→转工单的工艺路线预填,除「同物料上次」外再按 **同品名+同规格** 的产品族兜底。
实现:`OrderConvertService.PENDING_FROM` 的 `specroute` 派生表 + `frontend/src/business/routeDefaults.js`。

## 结论(正式账套 HSDZ_MES,2026-10-29 实测,待结转 2026-09-01~10-28)

| 指标 | 数值 |
|---|---|
| 待结转行 / 物料数 | 226 行 / 162 物料 |
| 「品名+型号」家庭数 | 144(其中 13 个家庭跨多个物料编码) |
| 同物料档命中 | 192 行 |
| **族档新增命中** | **5 行**(同物料无历史,靠同品名同规格的兄弟编码补上) |
| 三档全空(仍需手选) | 29 行 / 25 物料 |
| 其中「同品名(不限规格)」有历史 | 10 行 / 9 物料(若再加一档品名兜底可补) |
| 其中完全没有历史 | 19 行 / 16 物料(新品/客户专用件) |
| 单次 pending 查询耗时 | 144 ms(两个 ROW_NUMBER 派生表,1:1 不膨胀行数) |

## 文件

- `q2-leftover-materials.sql` —— 把「三档全空」的 25 个物料逐个查:本编码历史 / 同品名同规格历史 /
  同品名(不限规格)历史 / 该品名最近路线 / 档案绑定路线。结论:25 个物料**本编码历史全为 0**,
  同品名同规格历史也全为 0 ⇒ 族档补不上;9 个物料只有「同品名不同规格」的历史。
- `q3-family-sample.sql` —— 族档样例校验:`折叠复合阻垢炭棒/滤芯 · 48*30*231` 家族里只有
  `B-46-09-1` 转过单(GD-2026-09-0131 / 2026-09-23 / GY-CB-STD),待结转的 `B-46-09` 正是靠它带出。

## 复现命令(只读)

```powershell
cd tools
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java ^
  "jdbc:sqlserver://127.0.0.1:1433;encrypt=false;databaseName=HSDZ_MES" yinjia <密码> ^
  archive/_plan-spec-defaults/q2-leftover-materials.sql
```
