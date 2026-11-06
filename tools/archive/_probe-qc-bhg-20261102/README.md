# _probe-qc-bhg-20261102 —— 不合格报告(制程)两处报障的取证与修复

> 用户报障(2026-11-02,附截图:红框圈住右上信息表的「填写部门 / 填写人」两行):
> 「当前这个不合格处理中的填写人应该默认当前创建的账号名称
> 而且当前填写部门中的点击选择的框体明细超出表格」

面板:`QC_BHG` = **YJ-QR-11 不合格品分析报告(制程)**,表 `qc_bhg`(头)+ `qc_bhg_detail`(行),
版式在 `frontend/src/core/views/docSheetConfigs.js` 的 `qcSheetCfgs.QC_BHG`。

## ① 填写人应该默认当前创建的账号名称

**根因(实查,不是猜的)**

| 事实 | 出处 |
|---|---|
| `yj_field`:填写人 = 文本、**editable=0**(只读) | `qc-bhg-field-metadata.sql` |
| 填写人登记为「编制」格 = 纯落款 | `ButtonService.QC_DOC_PREPARER` → `"QC_BHG", "填写人"` |
| 纯落款**保存时被剥掉入参**、用户改不了 | `ButtonService.save()`: `body.remove(prepCol)` |
| 只有**提交审批**那一刻才写值 | `submitApproval → writeBackSignCell` |

⇒ 草稿期纸面上「填写人」永远是空的(用户截图即证据)。

**更隐蔽的一层**:DocSheet 的**右上信息表**渲染分支只认 sheet 级 `editable`(草稿态),
**不认 yj_field.editable** ⇒ 这一格在界面上还是个能打字的输入框,可用户填了也存不进
(保存剥键),表现为「填了白填 / 关掉再开又空了」。

**修法(前后端各一层,落库以服务端为准)**

- 前端 `core/panel/docDefaults.js`:`DOC_DEFAULTS.QC_BHG = [['填写人', ctx.userName]]`
  —— **仅空值时**带出当前登录人姓名。走 DOC_DEFAULTS 而不是 LOCKED_PERSON(只在新增时写)
  是因为**用户截图那张就是 2026-09-10 的老草稿**:只补新增的话,打开它照样是空的。
  已有姓名一律不覆盖(不会"打开别人的单就改成自己")。
- 前端 `DocSheet.vue`:新增 `infoLocked(info)`,`v-else-if="editable && !infoLocked(info)"`
  —— 元数据只读的格子按纯文本渲染(与签名格 `signKeyLocked` 同口径)。
- 后端 `ButtonService`:新增 `PREPARER_CREATOR_PREFILL = {QC_BHG: 填写人}` +
  `prefillPreparerName()`,在**建单(空白草稿分支)**与**保存末尾**各补一次 ——
  `UPDATE ... WHERE 填写人 IS NULL OR LTRIM(RTRIM(填写人)) = ''`,**只填空值、绝不覆盖**。
- 提交审批时仍按 2026-10-04 口径刷成**提交人**(编制 = 提交审批的人),两处不冲突。

## ② 填写部门的「点击选择」框超出表格

**根因**:`填写部门` 是 DEPT 参照字段 → 信息表里渲染 `.as-ref-ctl`;而该控件**自身写死
`width:200px`**(那是顶栏「文档编号」小格的尺寸)。右上信息表只有 250px 宽,值区 =
250 − 100(标签) − 1(竖线) − 8(左内距) ≈ **141px** ⇒ 虚线框右侧直接顶出纸面边框。

**修法**(`DocSheet.vue` 样式,与既有的 `.q-value .as-ref-ctl` 同款三条):

```css
.as-info-value { min-width: 0; }              /* 值区可收缩 */
.as-info-value .as-ref-ctl {
  width: 100%;        /* 宽度交给格子 */
  flex: 1 1 0;        /* flex-basis 归零,否则仍按内容宽撑开 */
  min-width: 0;       /* flex item 默认 min-width:auto,不写就不肯缩 */
}
```

## 验证

```bash
# 单测(新增 7 条)
cd frontend && node src/core/views/qcBhgFiller.test.js

# 浏览器实测(会自己新增一张草稿、量完自动作废;老草稿只读展示、不动库)
node tools/archive/_probe-qc-bhg-20261102/_verify-qc-bhg-fix.mjs
# 只想复现「新增」那条流(截图固定是新单):YJ_SKIP_OLD=1 node ...
```

2026-11-02 实测结果(两段:老草稿 + 新建草稿;两轮都 RESULT: PASS):

```
=== Ⓐ 打开已有空草稿 BHG-2026-09-0002(用户截图那种) ===
[PASS] 老草稿的填写人也带出当前登录人「系统管理员」
[PASS] 老草稿的填写人同样是纯文本(输入框数 0)
=== Ⓑ 新增一张不合格报告(制程) BHG-2026-11-0007 ===
[PASS] 填写人显示「系统管理员」= 登录人「系统管理员」
[PASS] 填写人不是可输入控件(输入框数 0)
[PASS] 参照框右边界未越过信息表(overflowTablePx=0,应 ≤ 0)
[PASS] 参照框宽度受格子约束(140px / 信息表 250px)
[PASS] 后端建单时也已按创建人预填进库(不只是前端显示)
RESULT: PASS
```

截图(都**不提交**,`.gitignore` 忽略 `*.png`,跑脚本会重新生成):

- `qc-bhg-old-draft.png` —— 用户截图那张老草稿:填写人已有名字、填写部门参照框收在表格内;
- `qc-bhg-new-doc.png` —— 新增单据同一块信息表(填写日期 = 当天)。
