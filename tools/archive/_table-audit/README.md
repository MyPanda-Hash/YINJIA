# _table-audit —— 后台表定册(2026-09-29)证据快照

这里是一轮"表使用面审计"的原始产物，结论落在：

- `tools/db-inuse-tables.txt` —— 在册台账（206 张在册 + 3 张例外保留）
- `tools/migrate-drop-unused-tables.sql` —— 244 张未用表的清理迁移（含 29 个已下架面板元数据回收）
- `docs/development/数据库表清单.md` §0.1 —— 在册表登记与判定口径

## ⚠️ 快照时点不同，别混读

> **重跑会覆盖**：`_TableAudit`/`_table-classify` 等探针直接写本目录，重跑后 `objects.csv` 与
> `classify.csv` 会变成"当前库状态"。要留住某一轮决策快照，先 `git stash`/另存 `classify.csv` 再跑
> （2026-09-29 就发生过一次：想验证分类器改动，结果把决策快照覆盖成清理后的 209 行，靠 git 回滚救回）。

| 文件 | 时点 | 说明 |
|---|---|---|
| `classify.csv` | **清理前**（454 表） | 逐表判定：`class` / 关联面板 / 在用视图 / 运行期 SQL 引用 / 行数 / 备用列数 —— **删表决策的直接依据** |
| `drop-tables.txt` / `drop-panels.txt` / `drop-plan.txt` | 清理前 | 待删清单（244 表 / 29 面板）与连带面板明细 |
| `drop-risk.csv` | 清理前 | 待删表风险面：被哪些**未在用视图**引用、是否只有注释提及 |
| `refs.csv` | 清理前 | 表名在代码里的引用：`sql_refs_biz`=运行期代码 SQL 位置引用（强证据）、`mentions`=注释/字符串提及（弱证据） |
| `objects.csv` | **清理后**（209 表 + 104 视图） | 实库对象总览：类型/列数/行数/备用列数/中文注明 |
| `panels.csv` / `deps.csv` / `granted.csv` / `fieldcols.csv` / `refpanels.csv` | 清理后 | 面板注册表 / 视图→基表依赖 / 角色授权 / 面板字段（含参照目标）/ 参照目标面板 |
| `misslabels.csv` | 清理后 | 缺 en 译名的字段标签（带 hex，用于识别尾空格） |
| `spares.csv` / `spare-targets.txt` | 清理后 | 备用列覆盖与补列目标（45 张） |
| `summary.txt` | 清点前 | 分类统计与人读摘要 |

## 判定口径（四源并集，任一命中即「在用」）

1. **P** 被「在运营面板」绑定（`yj_panel.head_table` / `line_table`）
   —— 面板是否在运营 = 前端菜单真源 `frontend/src/business/menus.js` 未注释的 `panelCode`
   ∪ `yj_role_panel` 已授权 `view` ∪ 前后端代码引用的面板码 ∪ **参照目标面板**（`yj_field.ref_panel`，多级不动点）
2. **V** 被「在运营面板绑定的视图」引用（视图嵌套深度不限，取自 `sys.sql_expression_dependencies`）
3. **C** `backend/src/main/java` + `frontend/src` 里出现在 SQL 位置（`FROM/JOIN/INTO/UPDATE/ALTER/OBJECT_ID` 之后）
   —— 迁移脚本、整库导出、部署包、生成器**不算**证据（建表 ≠ 在用；这一条收紧前后差 392 vs 92 张表）
4. **D** 有业务数据行

## 重跑步骤（在 tools/ 目录下）

```
java -cp lib\mssql-jdbc.jar archive\_TableAudit.java archive\_table-audit HSDZ_MES   # ① 导实库对象/面板/依赖/授权/参照
node archive\_table-refs.cjs                                                          # ② 扫运行期代码 SQL 引用
node archive\_table-classify.cjs                                                      # ③ 四源分类 → classify.csv / summary.txt
node archive\_table-drop-risk.cjs                                                     # ④ 待删风险面 → drop-risk.csv
node archive\_drop-plan.cjs                                                           # ⑤ 待删清单 + 备用列目标 + 连带面板
node archive\_gen-inuse-tables.cjs                                                    # ⑥ 刷新 tools\db-inuse-tables.txt
```

排查工具链依赖（`yj_schema_log` 就是这么发现必须保留的）：`node archive\_tool-deps.cjs`；
对账清单与实库：`node archive\_catalog-diff.cjs`。

> 注：① 的 `objects.csv` 只含 `is_ms_shipped=0` 的对象 —— 系统自带的 `dtproperties` 不在其中，
> 白名单裁剪时若按"现有表清单"判定会误删它的豁免（`archive\_clean-whitelist.cjs` 首版踩过，已改为只删本次确实删掉的对象）。
