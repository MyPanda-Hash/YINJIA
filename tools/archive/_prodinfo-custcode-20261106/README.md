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

## 追加调整（同日）：产品形态 / 应用场景 并到一行

用户口径：「调整一下，应用场景和产品形态放在同一行」。

- 改前：`产品形态`、`应用场景` 各占一整行（`vspan:3`）。
- 改后：一行两格 —— 左「产品形态」下拉（标准库 `prod.form`，带「⧉ 标准库维护」）、右「应用场景」文本。
  产品基本信息区由 6 行回到 5 行。
- 证据：`prodinfo-row-merged.png` / `round-41.mjs`（按 `<tr>` 读出的标签序列：
  `产品形态 | 滤芯⧉ 标准库维护 | 应用场景 | `）。
- 连带补的两处配置断言（因上一步加字段/加封面行而变红）：
  - `prodInfoBomSheet.test.js`：第一节字段序列（含客户编码行）、封面 10 行（设计 9 + 客户编码）；
  - `specCarryMap.test.js`：`RD_SPEC_DOC.prodPick.map` 显式加 `客户编码`/`客户名称` 两条来源，
    并加两条断言「引用产品信息表时客户编码/名称一起带回」「空值不回填」。

## 生产部署实况（2026-11-06 15:00）

- `deploy_src.py --ref 07f4e1730`：`BUILD-OK` → 备份 `pre-deploy-20261106-145852.bak` →
  `JAR-SWAPPED sha=DDCEAED7…` → 登录验证通过；
  验收 `jar DDCEAED7… / chunk assets/index-CfhSneVf.js / ledger 746 → 749`。
- 三条迁移在**两个账套**手工直连执行后补登 `yj_schema_log`（正式 →749，测试 →629）。
- 服务器实测：产品信息表纸面 `客户编码` 参照格 + `产品形态 | 应用场景` 同排（`prod-8090-prodinfo.png` / `round-42.mjs`）；
  检验项目标准库弹窗 **27 个组头**、1..26 = Excel 序、第 27 = 抗堵性能（`prod-8090-testlib.png` / `round-43.mjs`）。
- 测试库 `HSDZ_MES_TEST` 是旧快照（`RD_PROD_INFO` 只有 29 字段、无「客户名称」），迁移里对该步做了
  「字段不存在则 SKIP」分流；正式库守卫不受影响（`[FAIL] … 命中 0 行` 是先报出来才改的，见提交说明）。
