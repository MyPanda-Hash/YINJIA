# _qc-8fix-20261123 —— 品质单据 8 项修订(2026-11-23)

用户报障 8 条(附截图),逐条落地与取证如下。所有截图来自 ego-browser(5173 源码版 / 8090 打包版)。

## 1. 出货检验「新增批次后填写内容掉到下面」

- 根因:纸面矩阵的**数据格 `vertical-align: middle`**。检验方法/检验要求是多行文本，行高被撑到 80~120px，
  批次格里的单行输入/下拉被垂直居中 ⇒ 视觉上落在行的中下部(像掉到下一行);
  另外旧分组只并「数组里连续的同名行」，一旦行序是 `项目1-批1, 项目2-批1, 项目1-批2`,
  同一项目会被拆成两块。
- 修法:`QcProcInspSheet.vue` 数据格统一 `vertical-align: top`(表头仍居中);
  分组抽到 `qcProcInspGroups.js` 按身份**全局归并**，`normalizeRows` 同步重排。
- 取证:`round-14.mjs / round-14-top-align.png`(所有数据格 va=top、输入框距格顶 3px)、`round-22-oqc.png`。

## 2. 生产工序进度看板「未检验」筛选

- 新增第二个下拉「检验状态:全部检验 / 未检验 / 已检验」，独立于生产状态;
  后端 `WorkOrderProgressService` 按 `质检状态` 过滤并**重算汇总**(未检验=待检验/检验中，已检验=合格/不合格，无需检验两边都不算)。
- 取证:`round-21.mjs`(全部+已检验=263 行;全部+未检验=37 行)、`round-21-inspected.png / round-21-uninspected.png`。

## 3. 不合格品处理单(制程)五段责任人各自独立

- 迁移 `tools/migrate-qc-bhc-resp-per-section-20261123.sql`:qc_bhc 加 5 列 + yj_field + en/zh-TW 译名;
  纸面 5 个 section 的 `signKey` 各绑各的列(表头「责任人」保留原语义)。
- 取证:测试库 BHC-2026-09-0001 填 张三/李四/王五/赵六/钱七 → 保存 → 库里五列分别落值(已还原为空);
  页面 `round-18-bhc-owners.png`。

## 4. 右上「时间」取提交审批时间戳(含时分)

- `QueryService`:QC_BHC 派生只读 `提交时间` = `pending_at` → `shsj` → 首次保存 `asp_time1`，格式 `yyyy-MM-dd HH:mm`;
  DocSheet 新增 `kind:'head-static'` 只读信息格;纸面配置绑 `提交时间`。
- 取证:`round-20.mjs`(提交中 11-20 02:13 / 已审核 11-18 02:47 / 草稿 09-10 11:43)、`round-20-time.png`、`round-24-8090-bhc.png`。

## 5. 不合格品处理单左侧目录:客户名称 → 产品编码

- `PanelxList.DOC_RAIL_PANELS.QC_BHC` 改为 `['产品编码']`;8090 截图左栏 = 单号|日期|产品编码|审核状态。

## 6/8. 换行 / 字数居中 / 版式规整

- DocSheet:纸宽容器查询 + 标题按纸宽缩放(`clamp(18px,4.2cqw,30px)`)，窄纸不再把「（制程）」折成两行;
  标签/值/章节标题允许断行;QC_BHC 三行标签列按字数收窄(客户名称 88 / 生产量 64 / 责任人 64…),
  「系统管理员」不再一字一行;签名行允许折行。
- 出货检验纸面:抬头值/标签允许换行，长产品型号不冲出纸面。
- 取证:`round-17-bhc.png`、`round-24-8090-bhc.png`、`round-22-oqc.png`。

## 7. 出货检验两张只读明细表

- 迁移 `tools/migrate-qc-insp-detail-panels-20261123.sql`:
  视图 `v_qc_proc_insp_detail` / `v_qc_asm_insp_detail`(一行=一个检验项目×内部批次,头表摊平)
  + flat 报表面板 `QC_PROC_INSP_DETAIL` / `QC_ASM_INSP_DETAIL`(100 行/页) + 字段/只读授权/10 语言面板名。
- 菜单:品质管理 → 制程品质 → 两张单之后新增「出货检验（功能）明细表」「出货检验（表观）明细表」。
- 取证:`round-17.mjs`(2552 / 1039 条，19 列)、`round-17-QC_PROC_INSP_DETAIL.png`、`round-24-8090-*.png`。

## 复跑

```bash
# 数据(两账套)
cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java
# 单测
cd frontend && node --test src/core/qc/qcProcInspGroups.test.js src/core/qc/qcProcInspItemWrap.test.js \
  src/core/views/qcInspectionTasks.test.js src/core/views/qcDocsTwoLevel.test.js src/business/menus.test.js
# 页面取证
ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-8fix-20261123/round-24.mjs')"
```
