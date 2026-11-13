# 方案 A：生产工单「保存草稿 + 整页编制 + 草稿箱」实现契约（2026-11-13 第二轮）

> 用户口径（2026-11-13 下午）：「新建的生产工单如何实现保存草稿的情况呢？是否当前不能使用弹窗形式而是使用页面形式会更好呢？」→ 拍板 **A 实现**：
> 1. 新建工单改为**整页编制**（路由页面，替换原弹窗）；
> 2. **保存草稿**（草稿独立存表，**不写 plang**，避免草稿进入待排产/报工/领料）；
> 3. 生产工单页加**草稿箱**（列表/继续编辑/删除/提交）；
> 4. 提交草稿时才走现有 `WorkOrderCreateService.create`（全量校验）→ 生成正式 `plang` + 工序台账 + 临时工单 `wo_bom`。
>
> 工作区：`D:\workspace\yinjia`。纪律：**不要 git commit/push**；不要 `npm run build`（Lead 统一构建）；不要动 8090；不要改他人写入范围的文​​件。

## 一、后端接口契约（Lead 实现；前端严格按此写）

前缀 `/api/px`，全部需 `WORK_ORDER_LIST` 查看权；写操作另需动作词 `create`（与现「新增」同词）。

### 1) `POST /api/px/workOrderList/draft/save`
body：
```json
{ "草稿id": 0,
  "工单类型": "常规|临时",
  "产品编码": "A-32-01", "产品名称": "", "规格型号": "", "计量单位": "",
  "客户编码": "A-26", "客户名称": "",
  "订单数量": 10, "生产数量": 10,
  "工单日期": "2026-11-13", "计划开工日期": "", "交期": "",
  "工艺路线": "GY-CB-STD", "备注": "",
  "物料清单": [ {"行序":1,"子件编码":"...","子件名称":"...","子件规格":"...","计量单位":"个","标准用量":1,"损耗量":0,"行备注":""} ] }
```
→ `{ "草稿id": 12, "草稿号": "GDD-2026-11-0001", "更新时间": "2026-11-13 14:40" }`
规则：`产品编码` 必填（否则 400「请先选择主物料再保存草稿」）；`工单类型` 只认 常规/临时（空=常规）；新建时取草稿号 `FormNoService.next("GDD")`；已有 `草稿id` 则**覆盖**（只允许 `状态=草稿`，否则 400「该草稿不存在或已提交」）；草稿阶段**不做**路线审核/数量>0/临时工单必须≥1行的严格校验；子件行按提交顺序重排 1..n；常规工单忽略/清空物料清单；日期格式错 400。

### 2) `POST /api/px/workOrderList/draft/list`
body `{ "keyword": "" }`（可选：模糊匹配 草稿号/产品编码/产品名称）
→ 数组，每行：
```json
{ "草稿id":12, "草稿号":"GDD-2026-11-0001", "工单类型":"临时",
  "产品编码":"A-32-01", "产品名称":"S阻垢炭棒/滤芯", "规格型号":"40.5*16*80",
  "客户编码":"A-26", "客户名称":"…", "订单数量":10, "生产数量":10,
  "工单日期":"2026-11-13", "交期":"", "工艺路线":"GY-CB-STD",
  "创建人":"admin", "最后修改人":"admin", "更新时间":"2026-11-13 14:40", "物料项数":2 }
```
只返回 `状态=草稿 且 asp_cancel='N'`，按 `更新时间 DESC`。

### 3) `POST /api/px/workOrderList/draft/get`
body `{ "草稿id": 12 }` → 表头全字段（含 `状态`/`正式工单号`/`创建人`/`更新时间`）+ `"物料清单": [同上行结构]`；不存在 → 400「该草稿不存在或已提交」。

### 4) `POST /api/px/workOrderList/draft/delete`
body `{ "草稿id": 12 }` → `{ "草稿号": "GDD-…" }`；软删（`asp_cancel='Y'` + `asp_user2/asp_time2`）；只允许 `状态=草稿`。

### 5) `POST /api/px/workOrderList/draft/submit`
body `{ "草稿id": 12 }` → `{ "工单号":"GD-2026-11-002x", "行id":123, "草稿号":"GDD-…", "工单类型":"常规|临时" }`
规则：读草稿 → 组装成与 `workOrderList/create` **完全相同的 body** → 调 `WorkOrderCreateService.create`（全量校验：产品存在/数量>0/路线已审核/临时工单≥1 行）→ 成功后草稿 `状态='已提交'` + `正式工单号` 回填 + `asp_user2/asp_time2`；校验失败 400 并原样返回可读中文原因（草稿保持草稿态）。

### 6) `POST /api/px/workOrderList/draft/count`
body `{}` → `{ "数量": 3 }`（草稿态数量；生产工单页角标用）。

## 二、前端契约

### 组件 1：`frontend/src/views/modules/plan/WorkOrderCreatePage.vue`（create-ui）
- 路由 `frontend/src/router/index.js` 增：`{ path: 'prod/plan/workOrderCreate', component: () => import('@/views/modules/plan/WorkOrderCreatePage.vue'), meta: { title: '新增生产工单', code: 'workOrderCreate', panelCode: 'WORK_ORDER_LIST' } }`（放在 workOrderList 那条之后；参照同文件其它生产页写法）。
- **内容从现有 `WorkOrderCreateDialog.vue` 迁移**（同一套表单/页签/临时BOM表/远程选料/默认路线/校验），改成整页：顶部返回列表 + 标题 + 草稿号/保存时间；底部固定操作条「保存草稿」「提交生成工单」「返回列表」。
- 进入页面：`if (!canDo(user,'WORK_ORDER_LIST','create'))` → 提示无权限并返回列表；`onMounted` 拉 `/workOrderList/options`、`/processTask/routes`；若 `route.query.draftId` → `draft/get` 回填 `kind/form/lines`；若 `route.query.kind==='临时'` 选临时页签。
- 保存草稿：最小校验（仅产品编码必填）→ `draft/save`（新草稿 `草稿id:0`）→ 更新页面上的草稿号/草稿id，`tt('草稿已保存')` + 草稿号；不跳走，可继续编辑。
- 提交：走现有 `validateWorkOrder`（含路线审核/数量/临时行校验）→ 若有草稿id → `draft/submit`；否则直接 `/workOrderList/create`（同一份 `buildCreatePayload`）→ 成功提示单号 → `router.push({ path: '/prod/plan/workOrderList', query: { keyword: 工单号 } })`。
- 离开守卫：记录「最后保存/提交成功的快照」，`onBeforeRouteLeave` 时有未保存修改 → `ElMessageBox.confirm(tt('当前有未保存的修改，离开将丢失，是否继续？'))`。
- 删除 `WorkOrderCreateDialog.vue`（页面接管；Lead 会同时把 WorkOrderList 的引用改掉）。
- `business/workOrderCreate.js` 扩展（纯逻辑，继续由 create-ui 写）：`draftToState(draft)`（API 返回 → {form, lines, kind}）、`buildDraftPayload(form, lines, kind, draftId)`、`formSnapshot(form, lines, kind)`（脏检查）、必要的数值规范化；单测补 ≥8 条。**不改 en.js / WorkOrderList.vue / backend。**

### 组件 2：`frontend/src/views/modules/plan/WorkOrderDraftBoxDialog.vue`（draftbox-ui，新建，自包含）
- props `{ modelValue: Boolean }`，emits：`update:modelValue`、`edit({草稿id})`、`submitted({工单号, 草稿号})`、`changed()`。
- 打开时 `draft/list`；表格列：草稿号 / 工单类型 / 产品编码 / 产品名称 / 订单数量 / 客户 / 创建人 / 更新时间 / 操作。
- 操作：`继续编辑`→`emit('edit',{草稿id})` 并关闭；`提交`→confirm → `draft/submit` → 成功提示 + `emit('submitted', …)` + 重新拉列表；`删除`→confirm → `draft/delete` → 提示 + 重新拉列表 + `emit('changed')`。
- 空态「草稿箱暂无数据」；loading；失败提示后端 message。显示层全 `tt()`（新键由 Lead 统一加 en.js，见清单；只用清单内键或 en.js 已有键）。
- **不改 en.js / WorkOrderList.vue / router / backend。**

### 生产工单页集成（Lead）
- 「新增」改为 `router.push('/prod/plan/workOrderCreate')`（不再开弹窗）；删除 WorkOrderCreateDialog 引用。
- 工具栏加「草稿箱」按钮（带数量角标）：点击开 `WorkOrderDraftBoxDialog`；`edit` → `router.push('/prod/plan/workOrderCreate?draftId=…')`；`submitted` → 提示并 `load()` + 刷新角标；`changed` → 刷新角标。
- 进入页面/切回（onMounted/onActivated）刷新 `draft/count` 角标。

## 三、i18n 新键（Lead 统一加 en.js；前端只用这些 key）
| key | en |
|---|---|
| 返回列表 | Back to list |
| 保存草稿 | Save Draft |
| 提交生成工单 | Submit & Create |
| 草稿箱 | Draft Box |
| 草稿号 | Draft No. |
| 草稿已保存 | Draft saved |
| 保存草稿失败 | Failed to save the draft |
| 请先选择主物料再保存草稿 | Select the main material before saving the draft |
| 该草稿不存在或已提交 | This draft does not exist or has already been submitted |
| 草稿箱暂无数据 | No drafts |
| 继续编辑 | Continue Editing |
| 更新时间 | Updated At |
| 提交成功 | Submitted successfully |
| 提交失败 | Submit failed |
| 删除失败 | Delete failed |
| 已删除草稿 | Draft deleted |
| 确认删除草稿 | Delete this draft? |
| 确认提交草稿 | Submit this draft and create the work order? |
| 当前有未保存的修改，离开将丢失，是否继续？ | There are unsaved changes. Leave and lose them? |
| 草稿 | Draft |
| 已提交 | Submitted |
| 加载中… | Loading…（已有则复用） |
| 操作/删除/提交/编辑/取消/确定/客户/产品编码/… | 已有键 |

## 四、验收（Lead 负责）
- 两账套执行迁移；DbNormAudit 无新增 FAIL。
- 单测：`workOrderCreate.test.js` 通过。
- 8091 实例 API 探针：草稿保存（新建+覆盖）→ 列表 → 读回 → 提交（常规/临时各一）→ 校验 plang/工序台账/wo_bom/草稿状态；删除草稿。
- ego 界面：生产工单 →「新增」整页 → 填一半「保存草稿」→ 返回 →「草稿箱」看到草稿 → 继续编辑 → 提交 → 跳回列表并定位新单；草稿箱清空；英文界面走查。
- 测试数据清理；static 同步；分任务 commit。
