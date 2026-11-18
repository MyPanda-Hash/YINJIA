# 生产退料单报错 + 明细表归位(2026-11-18)

用户报障(2026-11-17 晚/18 早,测试账套 YJ_TEST):

1. 「生产退料单报错」—— 打开 WMS管理 → 库存核算 → 生产退料单整页 500:
   `SQL state [S0001]; error code [207]; 列名 '工单行号' 无效`
2. 「图二红框的两个明细表要放在库存明细里面」—— 生产领料明细表 / 生产退料明细表
   从「库存核算」移到「库存明细」。

## 一、报错根因与修复

`yj_field[MATERIAL_RET.工单行号].place` 是 `query,header,detail`,
取数时既进头表 **也进行表** 的 SELECT 列;而物理列只在头表:

| 表 | 工单行号 |
|---|---|
| `bd_material_ret`(单据头) | **有**(int) |
| `bl_material_ret`(明细行) | **没有**(它是照 `bl_material_out` 克隆的,那张也没有) |
| `bd_material_out` / `bl_material_out` | 头有、行没有(同款) |

业务上也本该在头:手机扫码退料 `MobilePickController.submitReturn` 把
「工单号(物理列 加工单号)+ 工单行号」写在**单据头**。

修复 = 纯元数据:`place` 改为 `query,header`(列表照旧显示、表单照旧可填,明细不再选该列),
脚本 `tools/migrate-material-ret-wo-line-nodetail-20261117.sql`,两账套均已执行并登记 `yj_schema_log`。
写入路径不受影响:`ButtonService.upsertLineRows` 本来就用 `tableCols(lineTable)` 过滤行表列。

## 二、菜单归位

`frontend/src/business/menus.js`:`prodPickList(PROD_PICK_LIST)` / `prodRetList(PROD_RET_LIST)`
由 `invAcct > invAcctDoc` 移到 `invDetail`,位置紧挨
`材料出库单明细表` 与 `生产退料单明细表`(领料↔材料出库、退料↔退料单)。
面板码/路径/数据源/权限行/叶子 code 一个字节没动;`yj_menu_node` 覆盖表为空(0 行),
所以侧边栏完全由 menus.js 决定。回归用例 `frontend/src/business/menus.test.js` 同步更新(28/28 绿)。

## 三、证据(可复跑)

- `probes/probe-q1.sql`:直读 `bl_material_ret.工单行号` → `列名 '工单行号' 无效`(复现)
- `probes/audit-field-vs-table.sql`:全库审计「yj_field 声明的列在对应物理表上是否存在」,
  修复前唯一真问题就是 `MATERIAL_RET.工单行号`(另两条 MANU_SCHEDULE / FIELDMGR 是
  派生列/视图计算列,非本类问题)
- `probes/probe-log3.sql`:两账套 `yj_schema_log` 有本次迁移 + `place=query,header`
- `probes/round-01.mjs` → 报错现场;`probes/round-02.mjs` / `round-06.mjs` → 修复后三个接口 200、页面无红条
- `ui/round-05.mjs` → 5173 侧边栏「库存明细」里已有两张明细表;`ui/round-07.mjs` → 8090 打包实例同样生效

## 四、顺带发现(未处理,不属本任务)

`tools/sync-db.bat` 增量同步在 `migrate-qc-proc-insp-batch-table-20261111.sql` 处失败
(「出货检验功能记录表(批次矩阵)迁移自检失败」),该脚本尚未进 `yj_schema_log`,
整条链在它之后中止 —— 属出货检验批次矩阵那条任务的在办件,本任务只做记录。
