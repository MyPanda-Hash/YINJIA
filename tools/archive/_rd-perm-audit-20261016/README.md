# 研发域角色权限对账与补全(2026-10-16)

用户原话:「现在组织架构里面的研发管理模块角色可配置的权限与现在的面板功能是对不上的,现在审视一遍,把这个权限配置完善」。

## 结论(一句话)

**不是研发管理一个模块配错了,而是「组织架构矩阵下发的词表」与「引擎真读的词表」是两套。**
全库几十张面板受影响:非文书类面板永远授不出「申请修改/删除申请」,而库里已授的
`modify/modlog/del` 在界面上**根本没有列**(看不见、点不掉);另有 5 个废词(`edit/delete/price/review/adjust`)
其中 3 个全库零消费者。同时 `can_approve` 与 `perms` 的 `audit` 词是两个真源,
导致研发审核在 8 张 RD 面板上"前端显示审批按钮、一点就 403"。

**归位口径(已实施)**:矩阵可勾的词 = 引擎真读的词(11 项)+ 页面级词(10 项);
`can_approve` 恒等于 `perms` 含 `audit`。长期口径与维护规矩见
[`docs/development/角色面板权限词表.md`](../../../docs/development/角色面板权限词表.md)。

## 本目录产物(全部只读探针,可重跑)

| 文件 | 作用 |
|---|---|
| `_q-rd-perm-matrix.mjs` | 走接口:研发管理 25 张面板 × 4 角色的「矩阵可勾词 / 库内已勾词」+ 每张面板真实按钮→引擎词 |
| `_q-rd-role-panel-raw.mjs` | 走库:yj_role_panel 逐格原样(perms/can_approve)、角色两两差集、词频、**两层审批门错位清点**、矩阵勾不到的词 |
| `_q-perm-words-cols.mjs` | 迁移前取证:yj_role_panel 结构/约束 + legacy 词行清单 + 全库词全集 |
| `_q-perm-gate-e2e.mjs` | 端到端:动作集 before/after + callButton 前门正反例 8 条(默认两处都指 8090,要 A/B 才传 `--old`) |
| `_q-orgadmin-matrix-ui.mjs` | 活体界面(CDP/Edge headless):矩阵列、勾选可见性、表格几何 + 截图 |
| `_inject-legacy-perms-20261016.sql` | 在**测试账套**造旧态,用于验证迁移真的会改造(自带库名硬闸门) |
| `_q-run-sql.mjs` | 调试器:按 GO 逐批执行 SQL 文件并打印完整错误/消息(仅排障用) |
| `_q-users.mjs` | 账号↔角色映射取证(cp=研发审核;liulei/chaishanyin/fengmin=文件负责人) |
| `rd-perm-matrix.md` / `role-panel-raw-*.txt` | 上述探针的输出快照(UTF-8,证据留档) |
| `_shots/1-orgadmin-rd-matrix.png` | 归位后的组织架构「研发管理」矩阵实拍(⚠ `*.png` 全仓 gitignore,截图只在本机,重跑 `_q-orgadmin-matrix-ui.mjs` 可再生) |

## 关键证据摘录

- 归位前矩阵给通用面板的列:`view,query,add,edit,delete,export,print,audit,price,review,adjust,field,warn`(13 项,5 个废词,无 modify/modlog/del)
- 归位后:`view,query,add,modify,modlog,del,export,print,audit,field,warn`(11 项,全是引擎词)
- 库侧 18 行含 legacy 词(`DISPATCH/MANU_ORDER/OP_TIME/OUTSOURCE_ORDER/RD_PROGRESS/ROUTE` × 角色 2/4/5),迁移后
  词频变化:`modify 183→201`、`del 174→192`、`audit 13→21`(研发审核 8 行补齐),废词归 0,全库词表越界 0 处
- 归位前「矩阵里没有列却已授权」的词覆盖几十张面板(`QC_*/PURCHASE_IN/SO_ORDER/PU_ORDER/MATERIAL_OUT/FINISH_IN/OTHER_*/SALE_OUT/RD_CHANGE` …)
- 活体界面:「项目进度查询」行在库里授的 `modify/del` 归位前**看不见**,归位后如实显示为已勾选的「申请修改/删除申请」
