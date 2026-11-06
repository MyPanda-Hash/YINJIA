# 产品信息表加「客户编码」+ 客户编码/名称互为下拉 + 下游带回（2026-11-06）

## 用户口径

> 「产品信息表的客户名称下边加上一个客户编码字段，然后可以通过客户编码下拉或者客户名称下拉，
> 客户里面的信息带入这两个字段的数据就不需要手动填写，后面那些规格书等单据如果有客户编码的
> 也同步关联上，产品编码引用的时候也带过去，没有就不用管」

## 做法（一条链，全部复用既有「参照同名带回」机制，没写新联动代码）

1. **客户档案指认**：客户编码/客户名称都指 `KHDA`（物理表 `dm_kh`，`dm`=客户编码、`mc`=客户名称）。
2. **产品信息表 `RD_PROD_INFO`**
   - 客户名称：`文本` → `参照 KHDA.mc`（下拉选客户名称）；
   - 新增 客户编码：`参照 KHDA.dm`（下拉选客户编码），字段 seq=42，正好在客户名称（41）下面；
   - 两格互为参照 ⇒ 后端 `PanelConfigService.buildRefMap` 的**同名带回**自动把另一个填上。
3. **规格书 `RD_SPEC_DOC`**：新增 客户编码（参照 KHDA.dm，seq=65）。选「产品编号」引用产品信息表时，
   产品编号那格的 `refMap` 里已含 `客户名称`、`客户编码` ⇒ 一选就把客户维度带过来
   （用户说的「产品编码引用的时候也带过去」）。
4. **其它面板**：现库里除规格书外没有「客户编码」字段（`QC_FIRST_INSP.客户代码` 不在本链上），
   按「没有就不用管」不动。

## 改动清单

| 文件 | 改了什么 |
|---|---|
| `tools/migrate-prodinfo-cust-code-20261106.sql` | 新增迁移：两列（`rd_prod_info_head.客户编码`、`rd_spec_doc_head.客户编码`）+ 列中文注明 + 两个 `yj_field` 字段行 + 客户名称改参照 + 10 条译名 + 自检；幂等 |
| `frontend/src/core/views/recordSheetConfigs.js` | 产品信息表纸面加「客户编码」一行（客户名称下）；规格书封面加「客户编码」一格 |
| `frontend/src/core/views/rdPanelLabels.fixture.json` | 重新生成（改过字段必须重跑 `node tools/gen-config-key-fixture.cjs`） |
| `tools/gen-config-key-fixture.cjs` | 顺手修 macOS 两处：`-cp lib\mssql-jdbc.jar` 反斜杠在 macOS 不是分隔符（改用 `path.join`）；`FOR JSON` 结果在 macOS 驱动下被拆成 ~2KB 多行，改成按顺序拼回再 parse |

## 实测（本地 8090 + HSDZ_MES）

- 纸面：产品编号 / **客户名称** / **客户编码** / 客户料号 依次排列，两格都是「点击选择」参照控件（`round-36.mjs` 读数）。
- 参照弹窗：标题「客户 · 参照选择」，列 = 客户编码/客户名称/客户分类/…，本地 3 个客户（A-26、KH00021、LSKH01）。
- **选客户编码 → 客户名称自动填**：选 `A-26` ⇒ 客户名称 = 广州市鑫万电子商务有限公司（`prodinfo-cust-carry.png`）。
- **选客户名称 → 客户编码自动填**：选 惠州市芯悦纯净设备有限公司 ⇒ 客户编码 = `KH00021`（`prodinfo-cust-carry-rev.png`）。
  两次都**没有点保存**（刷新即丢），库里数据未变。
- 规格书封面：客户料号 下面出现「客户编码」一格（`spec-cover-custcode.png`）。
- 接口核对 `/api/px/getPanelConfig`：
  - `RD_PROD_INFO.客户名称.refMap` = [{客户编码→客户编码}]，`RD_PROD_INFO.客户编码.refMap` = [{客户名称→客户名称}] ⇒ 双向；
  - `RD_SPEC_DOC.产品编号.refMap` 含 {客户名称→客户名称}、{客户编码→客户编码} ⇒ 引用产品即带回。

## 复跑

```bash
cd tools && YINJIA_SQL_PASS=*** java -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env migrate-prodinfo-cust-code-20261106.sql
# 前端：npm run build → 同步 static → 换 jar（本目录 round-36..40.mjs 用 ego 浏览器跑）
```
