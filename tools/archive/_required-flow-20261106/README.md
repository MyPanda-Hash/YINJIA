# 必填项星号/缺项一次全高亮 + 产品信息表提交审批跳产品文件列表 + 列表流程全览（2026-11-06）

## 用户口径（三条）

1. 「所有的必填项在保存提交审批的时候要有高亮提示哪一个还没有填写，要打*号」
2. 「防止有必填项根本就没有在面板上出现表格或者字段框，但是又因为是必填项导致单据保存不了，
   之前出现过，现在检查一遍」
3. 「产品信息表在提交审批之后跳转到产品文件列表，可以查看流程信息，现在给这个产品文件列表更新一下，
   加入一个隐藏切换入口可以像项目流程管控一样，可以全览得看到流程看到哪里了」

## ① 必填可视 + 缺项一次全亮

- **星号**：`RecordSheetPanels` 的标签格按 `yj_field.required` 打红 `*`（`.rs-req::after`）。
  覆盖：大标题格（产品名称这类 `titleKey`）、报告头信息格（编辑人/日期）、封面字段与签字栏、
  键值对行、网格行、明细表头（plain 列）。**不写死在模板文案里**，全按元数据走。
- **一次全亮**：`focusKey`（单键）→ `focusKeys`（集合），新增 `focusFields(keys)`。
  `PanelxList.validateInlineDraft` 由「命中第一项就 return」改成**收集全部**缺失项
  （表头 + 逐条明细行 + 整表必填页签），一次高亮并提示
  「还有 N 项必填没填：产品编号不能为空、产品名称不能为空、请至少添加一行明细」。

生产实测（8090，`round-45.mjs`）：点「保存」→ 上述提示 + `document.querySelectorAll('.rs-focus').length = 5`
（多处同时点亮；截图 `prod-required-highlight.png`）。

## ② 「必填但没画在纸上」体检 + 防回归

- 新增单测 `frontend/src/core/views/recordSheetConfigs.requiredRendered.test.js`：对 `recordSheetConfigs`
  每个面板，凡 `required && !hidden && visible` 的字段必须在配置的**渲染面**上找得到
  （封面 / 报告头 info / 键值对 / 网格 / 明细列 / 大标题 `titleKey` / 测试主题输入 / `variantKey` /
  `dualDocNo` / `groupBy.headKey` / pageTabs），否则失败点名。
  豁免只登记两条并钉死名单：`单据编号`（后端自动出号）、`单据日期`（拦单前自动填今天）。
- **结论：当前没有这类字段**。历史疑点 7 张数据记录表的「测试主题」走报告头大标题输入、
  「申请单类型」走 `variantKey` 变体切换行 —— 都在纸上（第一版审计模型漏了这两条渲染路径，已补进判据）。
  另：后端 `ButtonService.ensureRequiredFilled` 本身**跳过 hidden 字段**，口径一致。
- 基线 `rdPanelLabels.fixture.json` 从**生产元数据**重新生成（新增 `req` 段：required/hidden/visible）。
- 顺手修工具链（macOS）：原 `gen-config-key-fixture.cjs` 走 `SqlRunner + FOR JSON` ——
  SqlRunner 的 SELECT **只打 50 行**、FOR JSON 在 macOS 驱动下被拆行且尾部截断；
  改为新增 `tools/verify/FieldMetaDump.java` 出全量 TSV（956 行），并补 `trustServerCertificate`
  以支持连生产库生成基线。

## ③ 提交审批 → 产品文件列表 → 流程全览

- `PanelxList`：`RD_PROD_INFO` 提交审批成功后跳
  `/panelx/list/RD_PROD_DOCLIST?product=<产品编号>&flow=1`。
- `ProdDocListSheet`：说明行右端加**弱化**的「流程全览 / 矩阵视图」切换（localStorage 记住选择）。
  全览复用 `GET /px/rdDevOverview`（「项目进度查询 · 开发产品」同一份事实），
  每行一个产品（产品编号/产品名称/立项文档编号/产品信息表状态/文件进度 n/4/受控），
  展开看「产品信息表 → 规格书 → 成型工艺 → 组装工艺 → 出货检验计划」五步的单据号与状态；
  从提交审批跳过来时自动展开并高亮该产品。
- 生产实测（`round-46.mjs`）：`?flow=1` 直接进流程全览，7 个产品行；展开首行五步
  = 产品信息表 PI-2026-10-0060 已归档 / 规格书 SD-2026-10-0026 已归档 / 成型 MP-2026-11-0006 /
  组装 AP-2026-11-0002 / 出货检验 IP-2026-11-0006（截图 `prod-flow-overview.png`）。

## 未做/待你验

- 「提交审批成功后自动跳转」这条**没有在生产上真跑**：跑它要真的提交一张产品信息表（会推进审批流、
  给你和审核人发待办），所以只做了代码路径与构建验证 —— 等你下次正常提交时看一眼即可。
- 本机 Docker（colima）今天停了、且磁盘镜像下载被网络打断，**本地 8090 未恢复**；
  本轮所有界面验收都在生产 8090 上做（截图即证）。
