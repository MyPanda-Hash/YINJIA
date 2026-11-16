# _prod-ret-list-20261116 — 生产领料明细表改名 + 生产退料明细表新增

任务用户口径(2026-11-16):

> 「检查现在的手机扫码是不是对应的材料出库单和生产退料单。
>  还有这个改成生产领料明细表,再加一个生产退料明细表(其实生产退料只用记录生成到生产退料单上的就行,
>  不是每个单都有退料单的)。记录手机里面的单据。」

## 结论 ①:手机扫码确实对应「材料出库单」和「生产退料单」

| 动作 | 落地单据 | 业务类型 | 单号前缀 | 证据 |
|---|---|---|---|---|
| 手机扫码领料 → 提交 | **材料出库单** `bd_material_out`/`bl_material_out` | `生产领料` | `LL-` | `MobilePickController.PANEL_OUT = "MATERIAL_OUT"`;正式库 `bd_material_out` 业务类型=生产领料 的 6 张单 `LL-2026-10-0001..0006` |
| 手机扫码退料 → 提交 | **生产退料单** `bd_material_ret`/`bl_material_ret` | `生产退料` | `TL-` | `MobilePickController.PANEL_BACK = "MATERIAL_RET"`(2026-11-13 由「其他入库单」改过来);测试库 6 张 `TL-2026-11-0001..0006` |

退料**不是每张单都有**:2026-10-30 第三轮起废弃了「生单时预建 0 数量退料草稿」,
改成现场真退料时才 `submitReturn` 生成一张退料单并按工单号/工单行号回填
(`MobilePickController` §④「退料(已完成单上按需退)」注释 + `MobilePickDoc.vue`)。

## 结论 ②:两张明细表

- `PROD_PICK_LIST` 显示名 `生产领料` → **`生产领料明细表`**(数据源、面板码、路径都不动 → 仍是 `v_prod_pick_list` / `outh.src=6`)
- 新增 `PROD_RET_LIST` **`生产退料明细表`**,数据源 `v_prod_ret_list`
  = `bd_material_ret` 头 JOIN `bl_material_ret` 行(未删除),**不 join 领料单、不补 0 行** ⇒ 天然只列真实退料单
  - 比领料那张多一列 **工单号**(头表 `加工单号`)——手机扫码是扫工单号起手的,退料单 2026-11-13 起也写工单号/工单行号
  - 19 字段 / 展示 14 列;只读 `view,query[,export]`,授权按「生产退料单明细表」等价补授

## 复跑方式

```powershell
# 迁移(两账套)
cd tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-prod-ret-list-20261116.sql
$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-prod-ret-list-20261116.sql

# 界面(ego 浏览器;taskSpace = start-system-20261110)
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/start-system-20261110/round-08.mjs')"
```

`probe/q*.sql` = 取证用的只读查询(表结构 / src 段号分布 / 面板与字段 / 视图定义)。

## 截图

| 文件 | 内容 |
|---|---|
| `round-08-ret-list.png` | 5173 · 生产退料明细表(6 行,含工单号) |
| `round-08-pick-list.png` | 5173 · 生产领料明细表(改名后,共 2897 条) |
| `round-10-flycard.png` | 左导航 WMS管理·库存核算:材料出库单 → 生产退料单 → **生产领料明细表 → 生产退料明细表** → 其他出库单 |
| `round-11-en.png` | 英文走查(表头/导航全英文;工单号 = Work Order No.) |
| `round-12/13-8090*.png` | 打包版 8090(入口 chunk `index-5aUrFcik.js`)同样生效 |
| `round-14/16-mobile*.png` | 手机扫码页(单据页按钮「提交转材料出库单」) |

## 附:体检与单测

- `node --test`(frontend):1849 项全 PASS(`menus.test.js` 的挂点数 43→44 已随本次改动更新)
- `verify/FourDocAudit.java HSDZ_MES`:PASS(四单基线未受影响)
- `verify/DbNormAudit.java`:两账套均 `FAIL 7 / WARN 1`,与本次改动无关 —— 全量输出中
  **命中 `PROD_RET_LIST` / `v_prod_ret_list` / 两张明细表的条数为 0**(属仓库既有债务)
