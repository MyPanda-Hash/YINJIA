# _probe-qc-insp-carry —— 检验报告「按物料编码带入来料检验要求」取证

2026-10-04 用户口径:
> 「更改检验报告,需要根据物料编码能够在来料检验要求找到对应的行。并且在检验项和检验标准中,
>   做到对应填入检验项就是上面的检验项目,检验标准就是下面对应的数据。」

即:来料检验要求(QC_INSP_REQ)那张 Excel 表里 **列名(表头)= 检验项目**,
该列在命中行里的**数据 = 检测标准**,逐列拆成检验报告的「检验项 / 检测标准」两列。

## 文件

| 文件 | 用途 |
|---|---|
| `_v-qc-insp-carry.cjs` | **主探针**(22 条断言全通过):面板渲染 → 自动带入 → 只补缺失项 → 幂等 → 无要求物料拦下 → 弹窗找行 → 中/英/繁三语显示 |
| `_v-custom-tab.cjs` | **每表自定义列探针**(19 条断言全通过):8 个页签 → 给**固定表**(折叠棉)加列「炭棒直径」→ 只出现在该表 → 另一表加同名「外观」两表互不影响 → 录数据保存 → 落库核对 → 列名进检验项标准库 → **带入检验数据记录**(含该表自定义列、不带别表的) → 弹窗可见。⚠ 只打测试账套(factory=YJ_TEST)、可重复跑 |
| `_v-recon.cjs` | 排查探针:改前/改后对照来料检验要求面板与「检验要求」弹窗**能不能看到行**(detail 键回归的证据) |
| `_q-served-build.mjs` | 取证:某实例(8090 打包版 / 5173 热更)下发的 chunk 关键字 + 接口 detail 键/行数 —— 判断"用户看的是哪一版" |
| `QcReqDb.java` | 只读查 qc_insp_req 存活/作废行数 + `yj_archive_change_log` 保存留痕(判断"数据是不是真丢了") |
| `QcReqMeta.java` | 只读查 qc_insp_req 列/备用列池、QC_INSP_REQ 字段元数据 |
| `QcCustomTabDb.java` | 只读查 物料类别词表 / 各页签行数 / 动态字段绑定 / 标准库条目(两账套对照) |
| `_q-req-raw.mjs` | 最小证据:接口 `detail` 的键是 `qc_insp_req` 而非 `items` |
| `_q-req-rows.mjs` | 地面真值:79 行要求数据按页签分布 + 抽查物料的"有数据列" |
| `_d-carry-debug.cjs` | 踩坑留证:新增报告后立刻写「物料编码」会被草稿替换窗口冲掉(写入需自愈重试) |
| `_d-item-dom.cjs` | 踩坑留证:el-select 第一个 `.el-select__selected-item` 是 filterable 的输入外壳(innerText 恒空),选中值在 `.el-select__placeholder` |

## 运行

需 5173(vite)/ 8090(后端)已起;探针自己起 headless Edge 走 CDP:

```powershell
# 带入功能(正式账套,只建草稿不保存)
node tools/archive/_probe-qc-insp-carry/_v-qc-insp-carry.cjs http://127.0.0.1:8090

# 自定义页签(测试账套,会真加字段与数据行 —— 演示数据)
node tools/archive/_probe-qc-insp-carry/_v-custom-tab.cjs
```

## 顺带修掉的回归(本次实测发现)

接口明细键 = `yj_panel.detail_key`(`migrate-arch-single-doc.sql`:档案面板 = `LOWER(panel_code)`,
单据面板 = `items`)。`QC_INSP_REQ` 是**档案面板** → `detail.qc_insp_req`;
而 `QcInspReqSheet` / 检验要求弹窗原先写死 `detail.items` ⇒
**7 个页签全「暂无数据」、报告里点「检验要求」恒「该物料未维护来料检验要求」**。
现统一走 `@core/panel/detailRows`(判据一处),`_v-recon.cjs` 改前 0 行 / 改后 26 行可对照。
