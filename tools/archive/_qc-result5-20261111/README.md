# 检验数据记录 · 检测结果固定五格(2026-11-11)

## 需求与口径

用户原话:「检验数据记录的检验结果改为固定五格。」截图红框框的是检验报告(YJ-QR-96)表体
「检验结果」区里的 **检测结果** 那一列。追问后确认两条:

1. **每行检测结果格拆成 5 个小格**(填 5 个实测值:抽 5 件 / 测 5 次);
2. **数据库加 5 列、一值一格**(不是把五个值拼成一个文本)。

## 落了什么

| 层 | 改动 |
|---|---|
| 数据库 | `qc_insp_rec_detail` +`结果1..结果5` nvarchar(200) NULL(31→**36** 列)+ 逐列中文注明;幂等脚本 `tools/migrate-qc-insp-rec-result5-20261111.sql` |
| 元数据 | `yj_field` 5 行(detail / seq 31..35 / visible=1 / editable=1);旧列 `检测结果` → 历史列(visible=0 / hidden=1 / editable=0,**物理列与数据保留**) |
| 历史数据 | `结果1 ← 检测结果`(只填空值);正式库与测试库各 8 行 |
| 多语言 | `yj_translation` 结果1..结果5 的 en/ja/ko/zh-TW + 前端 `en.js` 5 条(Result 1..5) |
| 前端 | `core/qc/qcInspRecColumns.js` 增唯一真源 `QC_INSP_REC_RESULT_KEYS`;`core/views/QcInspRecSheet.vue` 两行表头(检测结果 跨 5 列 / 第二行 1..5)+ 每行 5 个单值格,只读态同 5 格;打印摘掉 ＋/× 列 |
| 文档 | `docs/development/数据库表清单.md` v3.87 + `qc_insp_rec_detail` 行;`tools/db-migrations.txt` 登记 |

## 证据(可复跑)

脚本按 `C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-NN.mjs` 原样拷贝,
用 `ego-browser nodejs -e "await import('file:///<path>/round-NN.mjs')"` 复跑(需 5173 起着的 vite)。

| 轮次 | 做了什么 | 结果 |
|---|---|---|
| round-02 | 打开 检验数据记录 面板 | 表头「检测结果」跨 5 列、第二行 1..5(`round-02.png`) |
| round-06 / 10 | 新增报告 → 加行 → 填检验项 / 检测标准 / 五格 | 每行 5 个输入格,键入值正确回显 |
| round-14 | 点「保存」 | toast「「保存」成功」;库里 `结果1..结果5 = 1.1/2.2/3.3/4.4/5.5`、`检测结果` 为 NULL |
| round-15 | 重新打开该单 | 五格原值回填(`round-15.png`) |
| round-16 | 给 body 加 `approval-printing` + CDP print media | 五格各 124px、＋/× 列不出现(`round-16-print.png`) |
| round-17 | 打开已归档单 JYSJ-2026-09-0037 / 老单 JYSJ-2026-09-0001 | 只读态 5 格、迁移回填的文字在**第一格**(`round-17-a.png` / `round-17-b.png`) |

落库取证(测试账套 HSDZ_MES_TEST):

```
id  检验项  检测标准        检测结果  结果1 结果2 结果3 结果4 结果5
29  外观    436±0.5/5mm     NULL      1.1   2.2   3.3   4.4   5.5
30  外观    1100±(±10)      NULL      9.1   9.2   NULL  NULL  NULL
```

## 单测 / 体检

- `node --test`(frontend):1638 条、**1636 通过**;失败的 2 条在
  `MaterialLabelDialog.boxQty.test.js` —— 属另一件「每箱数量」改动,与本次无关。
  本次新增/改写的 `qcInspRecColumns.test.js` **8/8 通过**(见 `node-test-summary.txt`)。
- 截图(`round-*.png`)与上一节的不一致:仓库 `.gitignore` 第 134 行忽略 `*.png` ⇒
  **截图只在开发机** `C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/` 里,复跑脚本即可重现。
- `DbNormAudit`:正式库 / 测试库均 `RESULT: FAIL-7`,7 项全是存量债
  (02/03/04/05/09/10/12),输出里**没有任何一条提到 结果1..结果5 或 qc_insp_rec**
  (见 `dbnorm-prod.txt` / `dbnorm-test.txt`)。
