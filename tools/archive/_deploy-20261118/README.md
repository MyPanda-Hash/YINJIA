# 2026-11-18 部署取证（`deploy_src.py --ref a75d08bc1 --app-only`）

对应台账 **#56**。服务器 `36.140.66.163`，WinRM 5985 + Basic。

## 本轮核心发现
只读核对 `yj_schema_log` 后发现 **11 条迁移从未在两账套执行过**，而它们对应的代码早已随 jar 上线
（`SALE_IN*` / `MATERIAL_RET*` / `MIX_RECORD` / `MIX_BOM` / `PROD_RET_LIST` 等面板在修复前是坏的）。
⇒ 部署第一步必须核 `yj_schema_log`，不能只看台账条数。

## 执行

| 步 | 命令 | 结果 |
|---|---|---|
| 备份 | `deploy_src.backup_db` | `pre-deploy-20261118-230104.bak`（220.1MB，迁移前） |
| 迁移 | `run_migrations.py <11 条>`（按 `tools/db-migrations.txt` 顺序，两账套） | 11/11 两账套全 OK |
| 测试库补前置 | `--db HSDZ_MES_TEST` 跑 `migrate-wo-pick-doc-20261030` / `migrate-wo-mixing-list-20261022` | （测试库陈旧，缺 `wo_pick_doc` / `wo_mixing_list`） |
| 补登记 | `--db HSDZ_MES` 重跑 `pick-two-docs` / `mix-batch` | 首轮在测试库失败 ⇒ 中止在补登前，正式库 SQL 已成功 |
| 换 jar | `deploy_src.py --app-only --ref a75d08bc1` | ALL-OK |

## 复核命令（只读）

```sql
SELECT COUNT(*) FROM yj_schema_log;                                   -- 857(正式) / 707(测试)
SELECT COUNT(*) FROM yj_panel;                                        -- 166
SELECT COUNT(*) FROM yj_field WHERE panel_code IN
  ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN');                    -- 337(四单基线)
```

接口抽查（外网）：
`POST /api/px/queryFormDataList` → `MIX_BOM`/`SALE_IN`/`MATERIAL_RET`/`PROD_RET_LIST` 200、
`MIX_RECORD` 200(1 行)、`FINISH_IN` 200(618 行)。

## 界面取证

`round-01.mjs` → `round-01-mixbom.png`：`#/panelx/list/MIX_BOM` 渲染正常，
列 = 行序 / 物料种类 / 物料编号 / 物料名称 / 添加比例 / 单支含量g / 设计添加量 / 行备注，无 500。

复跑：

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_deploy-20261118/round-01.mjs')"
```

## 回滚点

```text
库   C:\yinjia\backup\pre-deploy-20261118-230104.bak   (220.1MB, 迁移前)
jar  C:\yinjia\backup\app-20261118-231557.jar          (93.9MB, BF191269…)
```
