# 未勾选明细行置灰 + 不可填(2026-11-17 客户反馈)取证包

## 一、客户口径(原话)

> 「没有勾选的单据明细没有做区分，还是可填。」
> 修改方案：「**没有勾选为灰色而且不能有输入**。所有打印和生单都要有。关于明细勾选的」

背景截图(客户给的):分批送料弹窗里未勾选的行(第 1~4、6 行)白底、`本次送料数量` 照填 50000/40000，
但生单只按勾选的行出 —— 用户以为自己填了会被处理。

## 二、改了什么(一处口径,四处生效)

| 位置 | 改法 |
|---|---|
| `frontend/src/core/selection/pickRowStyle.js` | **新增**:`UNPICKED_ROW_CLASS` / `pickedKeySet` / `isPicked` / `pickRowClass` / `pickRowLocked`,四个弹窗共用 |
| `frontend/src/styles/index.css` | **新增** `.yj-pick-row-off` 灰行样式(全局:行是 el-table 内部 `<tr>`,组件 scoped 够不着) |
| `BatchSendDialog.vue` 分批送料 | 上下两层表都打灰类;仓库/仓位/本次送料数量对未勾选行 disabled |
| `GenerateLinesDialog.vue` 统一生单/合单生单 | 每张来源单一张表各按自己的勾选集合打灰类;仓库/仓位/本次数量 disabled |
| `MaterialLabelDialog.vue` 打印材料码 | 主表 + 补登表打灰类;本次打印数量/每箱数量 disabled |
| `PurchaseOrderPrintDialog.vue` 打印采购订单/无金额 | 打灰类;本次打印数量 disabled |
| `frontend/src/i18n/locales/*.js` | 提示词条 `未勾选的明细行置灰、不能填写`(zh-TW/en/ja/ko/es/fr/de/ru/vi/th 全语种) |

口径边界:**只灰"没勾"的行**,不灰"勾不了"的行(剩余 0 / 单据未审核由 `selectable` 挡住,element 自己有禁用样式)。

## 三、验证(5173 源码版,ego 浏览器)

> ⚠ 截图是 `*.png`,仓库 `.gitignore` 第 134 行统一忽略 ⇒ 截图只留在本机:
> `C:/Users/Lenovo/ego/pickrow-eval-20261117/`(同名文件,与本目录 `screenshots/` 一致)。
> 下表按文件名对应,重跑脚本即可重新生成。

| 截图 | 看什么 |
|---|---|
| `screenshots/v1-batchsend-unchecked.png` | 分批送料:第 2 行取消勾选 ⇒ 整行灰底灰字,仓库/仓位/本次送料数量不可填,合计只算已勾选 |
| `screenshots/v2-puprint-unchecked.png` | 打印采购订单:第 2 行取消勾选 ⇒ 灰行 + 本次打印数量 disabled |
| `screenshots/v10-materiallabel-unchecked.png` | 打印材料码:第 2 行取消勾选 ⇒ 灰行 + 本次打印数量/每箱数量都 disabled |
| `screenshots/v20-generatelines-grey.png` | 统一生单(生单 → 销售出库单):第 2 行未勾 ⇒ 灰行 + 本次数量 disabled,已勾选 3 行正常可填 |

复跑脚本(在 `C:/Users/Lenovo/ego/pickrow-eval-20261117/` 下同名文件):
`round-20/21`(分批送料)、`round-22`(打印采购订单)、`round-35/36`(材料码)、`round-45/46`(统一生单)。

**注意**:统一生单的灰底要用 `getComputedStyle(td).backgroundColor` 判(`#f5f7fa`)——
对话里那次"bg=transparent"是弹窗入场动画期间的瞬时读数,重查即 `rgb(245, 247, 250)`。

## 四、只读探针

`_Q.java`:按库名跑一条 SELECT(`java -cp lib\mssql-jdbc.jar _Q.java HSDZ_MES "<sql>"`),
本轮用来查采购订单/暂收单数据、确认误操作的草稿状态。

## 五、一次误操作的留痕(如实记录)

验证过程中在**正式库**误触「新增」,自动生成了草稿 `PO-2026-11-0001`(3 行,复制自 YJ-20261116-04)。
已按系统自己的删除口径(`POST /api/px/deleteForms` → `ButtonService.deleteForms` → 草稿走 `voidDoc` 软删)作废:
`yj_doc_status(panel_code='PU_ORDER', doc_no='PO-2026-11-0001') = canceled='Y', cancel_by='admin'`。
无下游单据、无审核留痕;正式单据数据未改动。
