# 订单结转 · 选择工艺路线弹窗「幽灵选中 + 确定点不了」修复(2026-11-17)

## 用户报障

> 当前如果在上次选择了一个工艺路线,第二次选择工艺路线就会导致当前还选择这条工艺路线会被默认选择,
> 但是无法点击确定,只能选择其他的工艺路线再次点击回这个工艺路线才能点击确定。

## 根因(两条叠加,都在 Element Plus 的 `el-table` 内部状态上)

1. **弹窗内容不销毁** — `el-dialog` 默认 `destroy-on-close=false`,关闭只是隐藏。`el-table` 内部
   `currentRow` 一直留着,重开时行仍是 `.current-row`(高亮)⇒「看着像已经选中」。
   而 `openRouteDialog()` 已经把 `routePick` 清空 ⇒ 确定按钮是灰的。**视觉与状态不一致**。
2. **点回同一条不触发 `current-change`** — `element-plus/es/components/table/src/store/current.mjs`
   的 `updateCurrentRow()` 只在 `_currentRow !== oldCurrentRow` 时才 `emit('current-change')`。
   点回"已经是 currentRow"的那条路线什么都不发 ⇒ `routePick` 仍是 null ⇒ 确定永远点不了,
   必须先点另一条(行变了)再点回来。

## 修改(`frontend/src/views/modules/plan/OrderConvert.vue`)

- 弹窗加 `destroy-on-close`:关闭即卸载内容,`el-table` 的 `currentRow` 随组件一起消失,
  重开是干净的"未选中"状态,不再有幽灵高亮。
- 选中路线改为 `@row-click`(每次点击都落 `routePick`,重复点同一条也生效),
  `@current-change` 保留兜底:过滤关键字把当前行滤掉时它发 `null`,`routePick` 跟着清空
  (否则会出现"确定可点、但选中行已不在列表里")。
- 确定按钮判据抽成 `canApplyRoute`(选中 且 `审核状态 === '已审核'`),语义不变。

## 复现与验证(ego 浏览器,5173 源码版)

脚本与截图即本目录文件;运行方式(**工作区外路径/截图改成本目录即可**):

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/round-03.mjs')"
```

- `round-01.mjs` 进页面并打印页面结构;`round-02.mjs`/`round-03.mjs` **修复前复现**;
- `round-06.mjs` **修复后验证**(先换路由再回来 = 组件重挂载,排除上一轮残留状态);
- `round-07.mjs`/`round-08.mjs` 回归:未审核路线仍置灰、确定不可点;双击行仍能应用
  (`round-08` 用真实指针双击,输出 `已为 1 行设置工艺路线 GY-2026-10-0001`)。

### 修复前(`round-03.mjs` 输出摘要)

```
OPEN_1  okDisabled:true   currentRows:["GY-001…"]           ← 上一轮残留的 current-row
PICK_APPROVED_1 …           okDisabled:false                ← 点已审核路线 = 可点
AFTER_APPLY_1 dialogOpen:false
OPEN_2  okDisabled:true     currentRows:["GY-2026-10-0001…"] ← 幽灵选中,确定却灰
PICK_SAME  (点同一条)        okDisabled:true                 ← 报障点:点回同一条没反应
PICK_OTHER okDisabled:false → PICK_BACK_SAME okDisabled:false ← 用户描述的绕法
```

### 修复后(`round-06.mjs` 输出摘要)

```
OPEN_1  okDisabled:true   currentRows:[]                     ← 干净:没选就是没选
PICK_1  okDisabled:false  currentRows:["GY-2026-10-0001…"]
APPLY   dialogOpen:false
OPEN_2  okDisabled:true   currentRows:[]                     ← 重开无幽灵高亮
PICK_SAME okDisabled:false currentRows:["GY-2026-10-0001…"]  ← 点同一条立刻可点确定
CANCEL  dialogOpen:false
```

截图:`repro-02-dialog.png`(修复前重开时幽灵高亮)、`verify-03-clean.png`(修复后应用完成)。
