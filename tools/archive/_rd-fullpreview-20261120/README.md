# 研发管理「单据预览」全屏化 · 现场取证（2026-11-20）

用户口径：「现在所有的研发模块的单据预览全部做成和立项申请和产品信息表类似的单据查询界面」。

## 一、判定规则取证（活库 HSDZ_MES，查 yj_panel）

```
SELECT panel_code, panel_name, module_group FROM yj_panel
WHERE panel_code LIKE 'RD[_]%' OR module_group = N'研发管理';
```

- 结果 **32 行，module_group 全部 = 研发管理，且 32 张全部是 RD_ 前缀** ⇒ 两条判据在本库等价。
- 前端面板配置 `GET /api/px/getPanelConfig` 的 `metadata` 只有
  `panelCode/panelName/panelCategory/panelButtons…`，**不下发 moduleGroup**（PanelConfigService）
  ⇒ 取 `panelCode.startsWith('RD_')`（零后端改动、更可靠）。
- 例外：`RD_PROD_DOCLIST` 是「产品矩阵预览」（列出产品行 × 4 文件状态，库里只有 1 张单），
  保留原产品预览，不进单据全屏（`FULL_PREVIEW_EXCLUDED`）。

## 二、覆盖面板清单（活库 32 张 RD_ 面板）

| 类别 | 面板 | 全屏 |
| --- | --- | --- |
| 立项/计划/进度 | RD_APPROVAL、RD_PLAN、RD_PROGRESS | ✅ |
| 样品单 | RD_SAMPLE_EXT、RD_SAMPLE_INT、RD_SAMPLE_ND | ✅ |
| 数据记录表 | RD_FILTER_EFF、RD_ALKALINE、RD_MINERAL、RD_ANTIBACT、RD_SCALE、RD_RO_PROTECT、RD_SOAK、RD_DROP_PREC | ✅ |
| 制程/测试/使用记录 | RD_SELFMADE、RD_SPIKE_WATER、RD_DOM_TEST、RD_EQUIP_USE、RD_INSTR_USE | ✅ |
| 工艺清单/规格书/检验计划/变更 | RD_MOLD_PROC、RD_ASM_PROC、RD_X_SINTER、RD_SPEC_DOC、RD_INSP_PLAN、RD_CHANGE | ✅ |
| 产品信息/共享文件库 | RD_PROD_INFO、RD_SHARE_FILE | ✅ |
| 产品文件列表 | RD_PROD_DOCLIST | ❌ 矩阵「产品预览」保留（唯一例外） |
| 已下架且无入口 | RD_ASM_BOM、RD_MOLD_FORMULA、RD_SAMPLE_NO | —（不在菜单，走不到预览入口） |
| 独立页面（非 PanelxList） | RD_EXTRA_REC_FILE | —（/rd/extraRecFile） |

**全屏覆盖 = 27 张**（28 张纸面式 RD 面板 − RD_PROD_DOCLIST）。

## 三、归属人字段探测（yj_field 实测 + getPanelConfig 的 dataSchema.fields）

候选顺序：`申请立项人 → 申请人 → 申请 → 编辑人 → 编制人 → 负责人 → 制表人`,
再补研发面板实测存在的同类字段 `测试负责人 / 编写人 / 录入人 / 项目负责人 / 产品负责人 / 表单管理人`；
一个都没有 ⇒ 创建人（列表行的「发起人」）。

| 面板 | 探测结果 |
| --- | --- |
| RD_APPROVAL | 申请立项人 |
| RD_PROD_INFO | 编辑人 |
| RD_SAMPLE_EXT / RD_SAMPLE_ND | 申请（值 = `姓名/日期`，比较时取斜杠前一段） |
| RD_CHANGE | 申请人 |
| RD_PLAN | 负责人 |
| 8 张数据记录表（含 RD_FILTER_EFF） | 测试负责人 |
| RD_MOLD_PROC / RD_ASM_PROC | 表单管理人 |
| RD_INSP_PLAN | 编写人 |
| RD_SELFMADE | 录入人 |
| RD_SPEC_DOC / RD_PROGRESS / RD_EQUIP_USE / RD_INSTR_USE / RD_SPIKE_WATER 等 | 无 ⇒ 发起人 |

**与父任务描述的出入**：父任务写「数据记录表=编辑人」，实测 yj_field 里没有「编辑人」，
owner 字段是「测试负责人」；另「表单管理人/编写人/录入人」也是实测补上的。

默认范围：有「我的」单据 ⇒ 我的；我的为 0 ⇒ 全部（避免一打开就是空表；
实测烧结工艺清单「表单管理人」= 柴善银，admin 打开时我的 = 0）。

## 四、ego 实测（vite 5173，admin/系统管理员，1440×900）

脚本：round-03（浏览器全量巡测）→ round-05（7 面板默认态/全部/关键字/跳转）→
round-06（跳第 3/5 张验证定位）→ round-08（最终截图 + 关键字截图 + 768 窄屏）。
证据：本目录 `r05-evidence.json`、`r06-evidence.json`、`r08-evidence.json`（截图与脚本输出）。
截图（`r08-*.png`、`r05-*.png`）按仓库 `.gitignore` 的 `*.png` 规则不入库，现场文件留在
`_scratch/ego-rd-fullpreview-20261120/`；脚本 `round-0N.mjs` 与 JSON 已随本任务提交，可复跑。

| 面板 | 默认 | 全部 | 关键字 | 跳转 |
| --- | --- | --- | --- | --- |
| RD_SAMPLE_EXT | 只看我申请的 6/11 | 11 | 1 条（全行匹配） | 跳转按钮 → 第 3/11，纸面「样品单编号 SPW-2026-11-0009」 |
| RD_SAMPLE_ND | 全部（本库 0 张）空态 | 0 | — | 无数据 |
| RD_SAMPLE_INT | 只看我申请的 1/5（发起人） | 5 | 1 条 | 点行 → 第 3/5 |
| RD_FILTER_EFF | 全部 5（测试负责人整列空） | 5 | 1 条 | 点行 → 第 5/5 |
| RD_MOLD_PROC | 全部 3 | 3 | 1 条 | 点行 → 第 3/3 |
| RD_PLAN | 全部 5 | 5 | 1 条 | 点行 → 第 3/5 |
| RD_SPEC_DOC | 全部 3 | 3 | 1 条 | 点行 → 第 3/3 |

- 每张都验证：`title=单据预览`、`sidePreviewShown=false`（不再并存右栏预览）、
  浮层 `scrollWidth == clientWidth`（1440：1390/1390）。
- 768 窄屏：`panel 768/768`、`bar 768/768`、`tableWrap 736/736`、页面 `scrollWidth==clientWidth`。
- 「项目等级」：这些面板数据里没有该字段 ⇒ 下拉不渲染（gradeShown=false）；
  立项/产品信息表才有（本地两份账套 `rd_approval.项目等级` 全空，未能取到"显示态"活体样本，
  显隐逻辑由 `v-if="gradeOptions.length"` + docPreview.test.js 守卫）。
