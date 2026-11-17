# _pick-two-docs-20261116 — 双领料单(组装/混料)+ 生产退料独立成面板

用户口径(2026-11-18):

> 「现在的生成工单领料需要生成两张领料单(一种就是现在的叫做组装领料,一种是混料领料
>  (根据半成品的物料清单现在是空的))。并且明细要对这两个做区分。
>  而且我还想生产退料独立出来,就是已经领料且审核的领料单据,来扫码退料。
>  其实就是独立出来一个面版,让生产领料不用负责那么多功能,操作也方便。」

## 口径(三问确认)

| 问题 | 答案 |
|---|---|
| 半成品清单为空 | **有明细才生成**混料单(不出空单) |
| 生产领料里的退料 | **去掉**,退料只在新面板 |
| 明细区分 | **只单据级**(台账加「领料类型」,`wo_pick_line` 不动) |

## 结构改动

`tools/migrate-pick-two-docs-20261116.sql`(两账套已执行)

- `wo_pick_doc.领料类型` `nvarchar(20) NOT NULL DEFAULT '组装'`(+ `MS_Description`);存量单据天然是「组装」。
- 唯一索引 `UX_wo_pick_doc_wo`:`(工单号,工单行号)` → **`(工单号,工单行号,领料类型)`** ⇒ 一个工单行可出两张单。
- `MOBILE_RETURN` 页面级面板:全部角色授权(`view,query,pick`)+ 面板译名 10 语。

> ⚠ 踩坑:第一版迁移用「`sys.indexes` 里套子查询引同名列」判断索引是否 2 列,相关子查询静默取错 ⇒
> 索引没重建、脚本整体回滚,**而 `DbSync run` 仍打印 `[OK]`**。改用「先删后建」并用 `SqlRunner` 复跑才看到真实报错。

## 代码

| 文件 | 改动 |
|---|---|
| `WoPickDocService` | `PickDoc` 加 `pickKind`;所有查询带 `领料类型`;`findActive(wo,line,kind)` 重载(旧两参默认查组装) |
| `MobilePickController` | `KIND_ASSEMBLY/KIND_MIX`;生单抽出 `createPickDoc(...)`;`generateOne` 先出组装单,再按**半成品(`**TB`)自己的物料清单**出混料单(清单空则不出);`/returnables` 新端点;`/doc`、`/list`、打印载荷带类型;`returnScan`/`submitReturn` 放行 `MOBILE_RETURN` |
| `PagePanelRegistry` | 新增 `MOBILE_RETURN`(生产退料,module 手机扫码,动作 view/query/pick) |
| `views/mobile/MobileReturnList.vue` | 新页:可退单据列表(已完成 + 材料出库单已审核)→ 选单 → 扫物料 → 填数量 → 提交 |
| `MobilePickDoc.vue` | **去掉退料**:已完成单据不再进退料模式、扫码区只给未完成;底部「开始退料」→「去生产退料」(带 `?no=` 跳到新面板) |
| `MobilePickList.vue` | 行上带「组装/混料」标签 |
| `router` / `menus` / `menus.test.js` | 新增 `MOBILE_RETURN` 路由与叶子(紧跟生产领料);菜单断言同步 |

## 实测

| 项 | 结果 |
|---|---|
| 双单生成(GD-E2E-0018 / D-02-03) | 组装 `LL-2026-11-0026` 项数 5;混料 `LL-2026-11-0027` 项数 4 ✅ |
| 半成品无清单(GD-E2E-0019 / T073) | 只出组装 `LL-2026-11-0028` 项数 4,**未生成混料单** ✅ |
| 列表界面 | `GD-E2E-0018` 同时出现「组装」「混料」两张单,标签正确 ✅ |
| 混料单详情 | 产品编号 `D-02-03**TB`、4 行明细、底部无退料入口 ✅ |
| 生产退料页 | 85 张可退单据;选中 `LL-2026-11-0025` 扫 `YJ-KBL-012` → 已领 10 / 已退 3 / 本次可退 7 ✅ |
| 已完成领料单底部 | 「打印二维码」+「待仓管审批材料出库单」/「去生产退料」(审批后) ✅ |

> 测试数据:`GD-E2E-0018`(D-02-03)、`GD-E2E-0019`(T073)两张临时工单与它们的领料单留在测试库,供复验。

## 已知遗留

- `MobilePickDoc.vue` 里退料模式的函数(returnScan/submitReturn 调用等)**已无入口但仍留在文件中**;
  按代码规范 §E 属技术债,建议下一个任务单独清理(本次为控制风险未一并删)。
- 明细只做**单据级**区分(用户口径),`wo_pick_line` 未加类型列。

## 复跑

```powershell
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/start-system-20261110/round-43.mjs')"
# round-36 列表标签/混料单详情/退料面板 ; round-43 选单+扫码
```
