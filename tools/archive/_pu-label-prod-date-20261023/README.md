# 采购订单「打印材料码」增生产日期 — 取证(2026-10-23)

## 用户口径

> 「采购订单的打印材料码界面需要在批次号后面加个生产日期,进行填写,填写后可以打印的材料码会加上生产日期」

## 改了什么

| 环节 | 改动 |
|---|---|
| 库 | `bd_pu_label` 加 `[生产日期] date NULL`(列数 15→16)+ 列级 `MS_Description`;按头登记(一张打印单 = 一个批次号 = 一批货 ⇒ 一个生产日期,与批次号同级;**不加行表**) |
| 后端 | `PuLabelService`:dialog 回 `生产日期`(默认空,不猜)/ print 落库(新增 `prodDate` 重载)/ reprint 带回 / labelRows+records 展示;`parseDate` 只收 `yyyy-MM-dd`(也认 `yyyy/MM/dd`、`yyyyMMdd`),空=不登记,格式错=拒 |
| 前端 | `MaterialLabelDialog.vue`:批次号 chip **后面**紧跟 `<el-date-picker>`(`value-format="YYYY-MM-DD"`);`cardsOf` 取**服务端回读**的 `生产日期` 灌进卡面;「已打印记录」加「生产日期」列 |
| 多语言 | 前端静态包 en/ja/ko/de/es/fr/ru/th/vi/zh-TW 补 `生产日期`/`选择日期`;`yj_translation` 补 `选择日期`(10 语言) |

## 迁移脚本(两账套均已执行,幂等)

- `tools/migrate-pu-label-prod-date-20261023.sql` — 加列 + 注明 + 3 条自检
- `tools/i18n-pu-label-prod-date-20261023.sql` — 补 `选择日期` 词条(已存在即跳过)

## 验证

| 探针 | 做什么 | 结果 |
|---|---|---|
| `_q-pu-label-shot.mjs` | 真登录 → 采购订单 → 选中 YJ-20261012-04 → 工具栏「打印」下拉 →「打印材料码」;量日期框 DOM 位置与标签 | **PASS 5/5** |
| `_q-en-shot.mjs` | 同路径但 `mes_locale=en`,核日期框标签/占位词/记录表头全英文 | **PASS 4/4** |
| `_q-card-render.mjs` | 按 `cardsOf` 同形映射调 `printProductCards`,断言卡面「生产日期」栏真的印值;空值留手填线;二维码口径不变 | **PASS 6/6** |
| `frontend/src/core/views/MaterialLabelDialog.prodDate.test.js` | 钉住链路 4 环(界面顺序 / 提交带参 / 出纸取回读值 / 重打共用) | **7/7**(并入 `npm test` 853/853) |

截图:`shots/01-dialog-with-prod-date.png`(中文)、`shots/02-dialog-full.png`(整窗)、`shots/03-dialog-en.png`(英文)。

## 关键判据(实测抓到的)

- 中文:`.mlq-bar` 里 chip 顺序 = 供应商 → **批次号 → 生产日期** → 打印上限;`sameRow=true` 且 `d.left > b.right`(确实在批次号右边、同一行)
- 英文:label `Production Date:` / placeholder `Select date` / 记录表头 `Batch No. · Production Date · …`
- 库:历史 5 张打印单 `生产日期` 为 NULL(本次之前打的)⇒ 卡面该栏留空白手填,与原行为一致
- 卡面:`生产日期：<span class="v">2026-10-20` 抓取命中;二维码仍是 `0@编码@批次`(日期**不进码**)

## 顺手发现(未改,不在本次范围)

- 弹窗顶栏的「打印上限 = …」提示 chip 会**换行**到第二行,把「可一次勾选多行…」那条黄底提示挤下去(crop 见 `shots/01-…`)。原因是 top bar 变宽后 `flex-wrap` 生效 —— 本次按用户要求只加日期框,未动版式;若要一行放得下,可把两条提示合并或收窄 chip 内边距。
