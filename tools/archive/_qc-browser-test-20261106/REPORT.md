# egolite 浏览器走查:制程检验单(QC_PROC_INSP)—— 2026-11-06

**结论:全部测试项 PASS(16/16),未发现产品缺陷;发现 1 个既有响应式观察项(与本次改动无关)。**

- 测试人:Lead(ego-browser skill / ego lite 0.6.2.8)
- 被测实例:`http://127.0.0.1:8091` = 当前工作区源码打包的新 jar(HEAD `2e3f8555a`,
  jar sha256 `9a041d5feee45190e17eda4c25a9122c20c97ec2b40241ac97d7f1e206d7d376`,入口 `assets/index-D8V0JTYj.js`)
- 账套:**YINJIA-MES·测试库(HSDZ_MES_TEST)**;账号 admin;所有写操作只落测试账套
- 时间:2026-11-06 17:25 ~ 17:45

## 一、测试用例与结果

| # | 用例 | 结果 | 证据 |
|---|---|---|---|
| 1 | 登录测试账套并打开「品质管理→制程检验单」面板 | PASS | `round06-paper.png` |
| 2 | 纸面表头**没有「工序」**(字段已界面隐藏) | PASS | 表头标签=单据编号/单据日期/检验类别/工单号/产品名称/抽检总量/检验日期/检验方案 |
| 3 | 「检验方案」是**输入框**,新建草稿默认「出货控制计划执行」 | PASS | `round07-new-draft.png`;新单 ZC-2026-11-0021 |
| 4 | 「检验方案」**可修改**:改为 `EGO测试方案-20261106` 后保存 | PASS | 保存成功;`round08-after-save.png` |
| 5 | 刷新页面重新打开单据,修改仍保留(后端不覆盖人工值) | PASS | `round09-reopened.png`;DB: `qc_proc_insp_head.检验方案 = EGO测试方案-20261106` |
| 6 | 明细「结果判断」是**下拉框**,选项含 合格/不合格,选「不合格」 | PASS | 下拉选项实测 `["合格","不合格"]`(另含两个全局搜索项,不影响) |
| 7 | 明细行保存落库:检验要求 + 结果判断 | PASS | DB: `qc_proc_insp_detail.结果判断 = 不合格`;纸张 Excel 导出含该值 |
| 8 | 表尾签署三格:检验人 / 审核人 / 批准 | PASS | `round07/08` 截图;检验人=系统管理员(默认检验人) |
| 9 | 侧栏**无「审核」直审入口**,有「提交审批」 | PASS | side btn 清单:新增/保存/…/提交审批/审批情况(无“审核”) |
| 10 | 提交审批 → 状态「审批中」,单据锁定(保存按钮消失) | PASS | `round12-pending.png`;提示「提交审批」执行成功 |
| 11 | 一级审批通过 → 状态「待二级审批」,审核人/审核时间落值 | PASS | `round14-l2-pending.png`;表尾审核人=系统管理员 |
| 12 | 二级「批准通过」→ 状态「已审核」,批准人落值 | PASS | `demo-05-audited-1920.png`;表尾 检验人/审核人/批准 三格齐全 |
| 13 | 「审批情况」显示完整留痕(提交/APPROVE_L1/审批通过) | PASS | `demo-06-history-1920.png`;3 条记录含意见与时间 |
| 14 | 弃审 → 回草稿并清空审核/批准签名格 | PASS | 状态=草稿;表尾三格清空 |
| 15 | 删除草稿单(整单删除) | PASS | 提示「ZC-2026-11-0021 已删除」;列表不再出现 |
| 16 | 测试数据清场(测试账套物理删除,五表 0 残留) | PASS | 见 `_cleanup.mjs` / `_cleanup-round2.mjs` 输出 |

补充取证(数据库直查,测试账套):
- `qc_proc_insp_head`:检验方案=EGO测试方案-20261106(自定义值未被覆盖)、检验员=系统管理员;
- `qc_proc_insp_detail`:结果判断=不合格、检验要求=EGO 测试文本;
- 审批留痕:`SUBMIT → APPROVE_L1(node1) → APPROVE(node2)` 齐备。

## 二、观察项(非本次改动引入,未修改)

1. **窄窗口 + 左栏展开时纸面列被压缩**:egolite 默认窗口约 1028px 时,左侧「制程检验单选择」栏展开占
   ~440px,纸面可用宽 ~750px;`qc_proc_insp_head` 纸面网格 `colgroup` 固定列宽合计约 724px,导致
   「检验要求/检验方法」两个自适应列被压成细条(文字竖排)。窗口拉宽到 1920px(或收起左栏)后版式正常
   (对比 `demo-04-draft-1920.png`)。属既有纸张网格的窄宽响应问题,与本次三项需求无关;如需要可另开
   「纸面最小宽度 + 横向滚动」的优化任务。
2. 测试账套是旧快照,**没有真实非管理员审批角色**(角色 1031+ 不存在)⇒ 本次由 admin 一人完成两级审批,
   侧栏出现「本单由你提交…通过后会记为自审」提示。正式库有 质量审核(1039)/生产(1033) 等审批角色,
   一级审批由这些角色完成、二级为超管。

## 三、截图索引(`tools/archive/_qc-browser-test-20261106/`)

| 文件 | 内容 |
|---|---|
| `round06-paper.png` | 打开面板/纸面(旧单据,只读) |
| `round07-new-draft.png` | 新建草稿:检验方案默认值、无工序、表尾三格 |
| `round08-after-save.png` | 改检验方案 + 加明细 + 结果判断=不合格 后保存成功 |
| `round09-reopened.png` | 刷新重开:修改已持久化 |
| `round12-pending.png` | 提交审批 → 审批中 |
| `round14-l2-pending.png` | 一级通过 → 待二级审批、审核人落值 |
| `round15-audited.png` / `demo-05-audited-1920.png` | 批准 → 已审核(三格签名) |
| `demo-04-draft-1920.png` | 1920 视口下的完整纸张版式(推荐查看) |
| `demo-06-history-1920.png` | 审批情况留痕弹窗 |
| `round16-approval-history.png` | 审批情况(第一轮单据) |
| `demo-07-cleaned.png` | 清理过程 |
| `demo-08-final-list.png` | 清场后的列表(25 条,已无测试单) |

## 四、复跑方式

```bash
# 1) 起当前工作区代码的 8091(测试账套同机库)
bash tools/archive/_qc-insp-verify-20261106/_start-8091.sh start
# 2) 浏览器脚本(ego lite):见 scripts/ 目录(本次真实运行的脚本原样存档)
#    ⚠ 脚本里 taskSpace(9) 是本次运行的 TaskSpace id;复跑时先跑 round-01 建新 space,
#      再把后续脚本首行的 taskSpace(9) 改成新 spaceId(或直接 import round-01 输出的 id)。
"C:/Program Files/Citro Labs/ego lite/Application/0.6.2.8/ego-browser.exe" nodejs \
  -e "await import('file:///D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/scripts/round-21.mjs')"
# 3) 收尾清理(测试账套白名单闸门)+ 停 8091
node tools/archive/_qc-browser-test-20261106/_cleanup.mjs
bash tools/archive/_qc-insp-verify-20261106/_start-8091.sh stop
```

> 说明:以上写操作全部只落在 HSDZ_MES_TEST;测试单 `ZC-2026-11-0021`、`ZC-2026-11-0022` 已从
> `qc_proc_insp_head`/`qc_proc_insp_detail`/`yj_doc_status`/`yj_form_approval`/`yj_message` 物理清场(复核 0 残留)。
> 收尾时 8091 仍在运行(供查看),ego lite 浏览器停在「制程检验单」列表页(25 条,无测试单)。
