# 出货检验纸面列宽调整取证(2026-11-17)

## 需求(用户原话)

> 「出货功能检验和出货表观检验需要对这个列宽进行调整,检验方法的宽度大一些,检验要求的宽度小一些」
> (附截图:出货检验功能记录表 YJ-QR-154,红框=检验方法列偏窄、蓝框=检验要求列偏宽)

## 改动

`frontend/src/core/qc/QcProcInspSheet.vue` 的 `colWidths`(屏幕与打印同一套百分比):

| 列 | 改前 | 改后(批次 ≤2 / 3 / ≥4) |
|---|---|---|
| 检验项目 | 11% | 11% |
| 检验方法 | 12% | **26% / 22% / 20%** |
| 检验要求 | 32% / 26% / 20% | **18% / 14% / 12%** |
| 批次号 / 本批结果判断 | 平分余量 | 平分余量(口径不变) |
| 操作 | 3.5%(可编辑时) | 3.5%(可编辑时) |

两张单共用同一个纸面组件(见 `PanelxList.vue` 的 `PROC_INSP_SHEET_PANELS = ['QC_PROC_INSP', 'QC_ASM_INSP']`),
所以改一处两张单同时生效。

## 取证(ego-browser + 5173 源码版)

- 环境:5173(vite 源码即时生效),登录工厂 **YINJIA-MES(正式库)**。
- 实测列宽(表格最小宽 636px 时,`<colgroup>` 的 style 即真值):
  - 检验项目 11% → 70px;检验方法 26% → **165px**;检验要求 18% → **114px**;
    批次号/本批结果判断 20.75% → 各 132px;操作 3.5% → 22px。
- 出货检验功能(QC_PROC_INSP):`round-13.png`,单据 ZC-2026-10-0131(4 行明细)。
- 出货检验表观(QC_ASM_INSP):`round-15-asm.png`,单据 ZJ-2026-11-0007。
- 脚本:`round-09.mjs`(打开单 + 量列宽)、`round-11.mjs` / `round-13.mjs`(功能单)、
  `round-15.mjs`(表观单)。目视:检验方法表头格已明显宽于检验要求。

## 复跑方式

```bash
ego-browser nodejs -e "await import('file:///<本目录绝对路径>/round-13.mjs')"
```

脚本里写死了 taskSpace id 4(该轮次的浏览器任务空间),复跑时若空间已关闭,把
`taskSpace(4)` 换成 `taskSpace('qc-insp-colwidth-20261117')` 即可。

## 未做

- Excel 导出列宽(`qcProcInspExport.js` 的 `PROC_INSP_BASE_COLS`:方法 40 / 要求 34)本来就方法更宽,本次不动。
- 8090(jar 内 static)需 `npm run build` + 同步 static + `rebuild-prod.ps1` 才生效;本次只同步了
  `backend/src/main/resources/static`,没有重启 8090 服务(避免打断用户会话)。
