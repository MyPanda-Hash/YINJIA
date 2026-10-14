# 探针：配方计算弹窗「物料编号」下拉取数(2026-10-15)

一次性只读探针，任务：「改配方计算弹窗的物料录入方式（物料编号改可搜索下拉 + 物料种类允许手打）」。
**只读 8090 的 HTTP 接口**，不写库、不改文件、不启停服务（8090 当时已在运行）。

跑法（需 8090 在跑；脚本用 admin/123456 登录，见各文件头）：

```powershell
node tools/archive/_probe-recipe-inv-picker/_probe-inv-rows.mjs
node tools/archive/_probe-recipe-inv-picker/_probe-inv-options-chain.mjs
```

- `_probe-inv-rows.mjs`：POST `/api/px/queryFormDataList`(panelCode=INV) 用 pageSize 5/50/200/1000 各打一发，
  量出档案分支到底回多少行、`所属类别` 的真实值域、`M-001`/`M-003` 是否存在。
  实测结果：**totalSize=114、items=114（四种 pageSize 一样）** ⇒ 档案分支忽略 pageSize
  （`QueryService.queryArchive` 按 `ARCH_LOAD_CAP=50000` 全量返回），故下拉一次性载入即可。
- `_probe-inv-options-chain.mjs`：拿**真实接口数据**喂**生产用的纯函数**
  （`invCarry.invRowsOf` → `recipeRows.invOptionsOf` → `recipeRows.uniqueInvRowOf` + `invFillFor` → `recipeSheet.slotsFromRows`），
  把「档案行 → 下拉选项 → 选中一个编号 → 带出名称/种类/料位分组」整条链走一遍。
  实测：114 行 → 114 个无重复选项；`M-001 炭棒`/`M-003 炭纤维` 都是「折算物料」，
  带出后落**折算料位**且零告警；`YJ-XH-001` 带出「炭粉」+ 含水率 0.06。
