# _wol-picking-20261105 — 生产工单「转领料单」下架 取证脚本(任务产物)

用户口径 2026-11-05:「把当前这个转领料单的按钮删除,记得把权限设置中的也去除掉,
不需要删除当前的工单和领料的实现,只需要完成对这个按钮的去除即可。」

## 本目录脚本(全部只读;除 DbSync 外不改库)

| 脚本 | 用途 |
|---|---|
| `_q-picking-rows.sql` | 两库 `yj_role_panel`(WORK_ORDER_LIST)总行数 / 含 picking 行数 + 明细 |
| `_q-any-picking.sql` | 全库任意面板是否还有 picking 授权 |
| `_q-simulate.sql` | **只读模拟**迁移脚本的整词修剪:先看清 old→new perms 再执行 |
| `_q-edge.sql` | 整词修剪边界自测:首/中/尾/唯一/重复词各位置的输出 |
| `_q-schema.sql` | yj_role_panel 列类型 + perms 列中文注明现状 |
| `_q-verify.sql` | 迁移后复核:残留 picking=0、行数、yj_schema_log 是否登记、perms 明细、列注明 |
| `_q-hash.sql` / `_q-pending.sql` | 执行前确认清单里"待跑脚本"只有本任务这一条(另一条 bak-snapshot 已在两库登记且哈希一致,DbSync 会跳过) |
| `_check-sfc.mjs` | WorkOrderList.vue 语法/编译体检(@vue/compiler-sfc)+ 断言按钮/toPicking/useTabsStore/canDo('picking') 代码残留=0 |
| `_check-java-braces.mjs` | 两个 Java 文件去注释后括号配平(不替代编译,Lead 统一构建) |

运行方式(本机 PATH 的 `java` 是 1.8,不能用;统一取 JDK 25):

```bash
JAVA="C:/Users/vigna/.jdks/ms-25.0.4/bin/java"
cd tools
YINJIA_SQL_PASS='Yinjia@2026' "$JAVA" -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar \
  SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" \
  yinjia env archive/_wol-picking-20261105/_q-verify.sql
```

## 取证结果(2026-11-05)

- 迁移前含 picking 行:**HSDZ_MES 5 行 / HSDZ_MES_TEST 4 行**(均在 panel_code=WORK_ORDER_LIST);
  全库其它面板零命中。
- 迁移后:两库 `residual_picking = 0`,perms 里其余词与顺序原样
  (例 `view,query,print,close,split,picking,export,assign,dayplan`
  → `view,query,print,close,split,export,assign,dayplan`)。
- DbSync:`HSDZ_MES 执行 1 / 失败 0`;`HSDZ_MES_TEST 执行 5 / 失败 0`
  (该库此前后落了 4 条早已提交的历史脚本 —— recipe-materials-backfill-20261103 /
  mold-spec-strip-prefix-20261103 / clean-blank-prodinfo-and-dept-20261104 /
  sinter-workshop-deptname-20261104,两账套纪律要求补跑;全部 [OK])。
- 复跑两库均 `执行 0 / 失败 0`;`DbSync run migrate-drop-wol-picking-perm-20261105.sql` 再跑一遍
  也是 0 行变更(幂等证据)。
- yj_role_panel.perms 列中文注明已刷新(标明 picking 2026-11-05 起只留给后端端点鉴权)。

## 界面 / 权限设置取证(2026-11-05,Lead 收尾)

`_verify-ui.mjs`(无头 Edge + CDP;**只读**,不改任何数据)在 **5173(源码态)** 与
**8090(重打 jar 后的打包产物)** 各跑一遍,均 **11/11 PASS**:

| 检查 | 结果 |
|---|---|
| 权限设置(接口 `GET /api/sys/role/{id}/panels` 的 WORK_ORDER_LIST.actions) | `view,query,print,close,split,recipe,export,assign,dayplan` —— **无 picking**,矩阵不再有「转领料单」列;其余动作照旧 |
| 生产工单页按钮条 | `结案/取消结案/结案回正/切单/排产/撤回切单/打印工单/获取混料配方/导出/刷新` —— **无「转领料单」**;列表 11 行照常 |
| 工单排产 →「排单计划」(勾 2 行) | 打印层 2 行、标题「成型车间排单计划」、正文 **10.5px**、日期列 **3 天 × 6%**、长表头显式换行(生产计划/数量),与新版式一致 |

截图:`ui-workorder-buttons.png`(按钮条)、`ui-plan-sheet.png`(出纸打印层)。

构建/生效:前端 `npm run build` + static 同步 + `mvn package` 由 `tools/scripts/rebuild-prod.ps1`
一次跑完(8090 已重建并重启,jar 内 static 已含本次前端改动);DB 由 `sync-db.bat` 复核
`执行 0 / 失败 0`(迁移早已落库)。
