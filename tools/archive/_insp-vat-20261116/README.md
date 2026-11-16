# 检验委托单总金额含 6% 增值税(2026-11-16)

| 属性 | 内容 |
|---|---|
| 需求(用户 2026-11-16 口径) | 「修改文件的总金额计算方式,将合计收费修改为（总金额（含增值税6%）RMB）。之后的总金额需要在原基础上增加6%的数值」 |
| 设计真源 | [docs/design/检验委托单-首版.md](../../../docs/design/检验委托单-首版.md) §3.3 / §4.2 / §八.10 |
| 影响面 | 只有检验委托单(INSP_COMMISSION)纸面合计;数据键/物理列/表结构不变 |

## 改了什么

| 文件 | 改动 |
|---|---|
| `frontend/src/core/qc/inspCommissionVat.js`(新增) | 纯算术模块:`VAT_RATE = 0.06`、`withVat(net)`、`vatTotalText(net)`(按**分**四舍五入,避免 600×1.06 的浮点尾差) |
| `frontend/src/core/qc/InspCommissionSheet.vue` | ① 纸面标签「合计收费：」→「**总金额（含增值税6%）RMB：**」;② 显示值 = 行表「收费」合计 × (1+6%);③ 带入/删行后回写 `head['合计收费']` 用含税口径;④ 打开已保存单据时静默按现行口径重算一次表头(旧单净额保存后即换含税) |
| `frontend/src/core/qc/inspCommissionVat.test.js`(新增) | 4 条回归:税率/金额四舍五入边界/纸面标签/显示与回写同一口径 |
| `frontend/src/i18n/locales/en.js` | 新词条 `"总金额（含增值税6%）RMB："` → `"Total Amount (incl. 6% VAT) RMB:"` |
| `docs/design/检验委托单-首版.md` | §3.3 字段说明 / §4.2 汇总口径 / §八.10 本次变更(数据键仍是 `合计收费`,存的就是含税总金额) |

## 验收证据(5173 源码版,测试账套)

用例:新增委托单 → 从送样登记表带入 6 个检验项(每项收费 100,净额 600)→ 纸面应显示 **636.00**。

| 文件 | 说明 |
|---|---|
| `sheet-636.png` | 真实页面截屏:行表 6 项 ×100,底部「**总金额（含增值税6%）RMB：636.00**」 |
| `print-636.pdf` / `-page1.png` | 真实打印输出(Page.printToPDF,1 页 A4 竖版):同标签 636.00 |
| `export-636.pdf` / `-page1.png` | 「导出 PDF」(html2canvas 通道,1 页 A4 竖版):同标签 636.00 |
| `ui/round-05.mjs` | UI 断言:6 行收费 [100×6]、纸面文案、期望 = 净额×1.06 |
| `ui/round-07.mjs` | 截屏 + 打印 PDF + 导出 PDF 取证 |
| 数据库复核 | 保存后 `qc_insp_commission_head.合计收费 = 636.00`(非 600.00) |

单测:`inspCommissionVat.test.js` 4/4 通过(600→636.00、100→106.00、123.45→130.86、0.05→0.05、空/脏值→0.00);
全量 `npm test` 1951 pass / 8 fail(8 条均为存量红,与本次无关)。

## 收尾

- 测试账套联调单 `WT-2026-11-0006`(6 行 ×100)已物理删除;正式账套未写入数据。
- 本机 8090 用 `apply-frontend-only.ps1` 只换前端(后端 class 未动);入口 chunk `index-CKzFyRwn.js`,
  包内已含新标签(可用 `grep 总金额（含增值税6%）RMB backend/src/main/resources/static/assets/*.js` 复核)。
- **生产服务器未部署**;上线走 `deploy/deploy-production.bat` 增量 + 换 jar 并记部署台账。
