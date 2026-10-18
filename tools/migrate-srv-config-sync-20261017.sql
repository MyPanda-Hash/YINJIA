/* migrate-srv-config-sync-20261017.sql — 服务器端「配置改动」反向同步到本地(由生成器产出,勿手改)
 *
 * 来源:生产服务器 ECS-38508784 的手工完整备份 db\HSDZ_MES-manual-20261015-231541.bak
 *   (2026-10-15 23:15;还原成临时库 HSDZ_MES_SRV1015 后逐项比对出来的差异)。
 * 口径(用户 2026-10-17 拍板):**只同步服务器端的配置改动,不动任何业务数据**。
 *
 * ① yj_field 33 行:服务器上把「备用列」登记成了有意义的自定义标签
 *    (col_name LIKE '备用%' 而 label 不是备用名),而本地该面板还在、也没有同 label 的行 ⇒ 本地缺。
 *    分布:QC_INSP_REQ(1) QC_INSP_REQ_SERIES(30) RD_ALKALINE(2)
 *    自动排除(本地有意为之,不属缺口):
 *      - RD_ALKALINE · 已经同步过(本地同列同行) × 1
 *      - RD_ANTIBACT · 已经同步过(本地同列同行) × 1
 *      - RD_APPROVAL · 已经同步过(本地同列同行) × 2
 *      - RD_ASM_PROC · 已经同步过(本地同列同行) × 2
 *      - RD_CHANGE · 已经同步过(本地同列同行) × 1
 *      - RD_DROP_PREC · 已经同步过(本地同列同行) × 1
 *      - RD_FILTER_EFF · 已经同步过(本地同列同行) × 1
 *      - RD_INSP_PLAN · 已经同步过(本地同列同行) × 2
 *      - RD_MINERAL · 已经同步过(本地同列同行) × 1
 *      - RD_MOLD_PROC · 已经同步过(本地同列同行) × 2
 *      - RD_RO_PROTECT · 已经同步过(本地同列同行) × 1
 *      - RD_SCALE · 已经同步过(本地同列同行) × 1
 *      - RD_SOAK · 已经同步过(本地同列同行) × 1
 *      - RD_SPEC_DOC · 已经同步过(本地同列同行) × 2
 * ② yj_translation 37 行:服务器独有的译名里,ref_key 在本地**还有引用**的
 *    (field: 本地仍有该 label 的字段行;panel: 本地仍有该面板)。
 *    分布:field(35) panel(2)
 *    排除 47 行:对应字段/面板本地已不存在(下架或改名后的孤儿译名)。
 *
 * 幂等:两条 INSERT 都带 NOT EXISTS 守卫(按业务键判重),重复执行 = 0 行;两账套均执行。
 * 自检:末尾核对 33/20 行到位,不符即 RAISERROR 16(脚本不登记,下次重跑)。
 * 生成器:tools/archive/_gen-srv-config-sync-20261017.mjs(改口径重跑生成,勿手改本文件)。
 */
SET NOCOUNT ON;
GO

/* ═══ ① yj_field:33 行(备用列 → 自定义标签) ═══ */
DECLARE @f TABLE (
  panel_code varchar(40), col_name nvarchar(256), label nvarchar(120), data_type nvarchar(40), dict_sql nvarchar(1000),
  ref_panel varchar(40), ref_field nvarchar(256), display_field nvarchar(256), place varchar(60), seq int, width int,
  editable bit, required bit, hidden bit, alias nvarchar(120), visible bit, label_en nvarchar(400),
  col_group nvarchar(100), ref_filter nvarchar(400), tab_key nvarchar(100));
INSERT INTO @f VALUES
  ('QC_INSP_REQ', N'备用101', N'外径3', N'文本', NULL, NULL, NULL, NULL, 'detail', 340, 120, 1, 0, 0, NULL, 1, NULL, N'规格', NULL, N'端盖'),
  ('QC_INSP_REQ_SERIES', N'备用8', N'检验标准4', N'文本', NULL, NULL, NULL, NULL, 'detail', 108, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目4', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用9', N'检验方法5', N'文本', NULL, NULL, NULL, NULL, 'detail', 118, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目5', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用10', N'检验标准5', N'文本', NULL, NULL, NULL, NULL, 'detail', 128, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目5', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用11', N'检验方法6', N'文本', NULL, NULL, NULL, NULL, 'detail', 138, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目6', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用12', N'检验标准6', N'文本', NULL, NULL, NULL, NULL, 'detail', 148, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目6', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用163', N'检验方法1', N'文本', NULL, NULL, NULL, NULL, 'detail', 178, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目1', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用162', N'检验标准1', N'文本', NULL, NULL, NULL, NULL, 'detail', 198, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目1', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用161', N'检验方法2', N'文本', NULL, NULL, NULL, NULL, 'detail', 208, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目2', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用164', N'检验标准2', N'文本', NULL, NULL, NULL, NULL, 'detail', 218, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目2', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用165', N'检验方法3', N'文本', NULL, NULL, NULL, NULL, 'detail', 228, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目3', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用166', N'检验标准3', N'文本', NULL, NULL, NULL, NULL, 'detail', 238, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目3', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用167', N'检验方法4', N'文本', NULL, NULL, NULL, NULL, 'detail', 248, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目4', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用168', N'检验标准4', N'文本', NULL, NULL, NULL, NULL, 'detail', 258, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目4', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用169', N'检验方法5', N'文本', NULL, NULL, NULL, NULL, 'detail', 268, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目5', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用170', N'检验标准5', N'文本', NULL, NULL, NULL, NULL, 'detail', 278, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目5', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用171', N'检验方法6', N'文本', NULL, NULL, NULL, NULL, 'detail', 288, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目6', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用172', N'检验标准6', N'文本', NULL, NULL, NULL, NULL, 'detail', 298, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目6', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用173', N'检验方法7', N'文本', NULL, NULL, NULL, NULL, 'detail', 308, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目7', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用174', N'检验标准7', N'文本', NULL, NULL, NULL, NULL, 'detail', 318, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目7', NULL, N'矿化料'),
  ('QC_INSP_REQ_SERIES', N'备用121', N'检验方法1', N'文本', NULL, NULL, NULL, NULL, 'detail', 328, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目1', NULL, N'炭粉'),
  ('QC_INSP_REQ_SERIES', N'备用122', N'检验标准1', N'文本', NULL, NULL, NULL, NULL, 'detail', 338, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目1', NULL, N'炭粉'),
  ('QC_INSP_REQ_SERIES', N'备用123', N'检验方法2', N'文本', NULL, NULL, NULL, NULL, 'detail', 348, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目2', NULL, N'炭粉'),
  ('QC_INSP_REQ_SERIES', N'备用124', N'检验标准2', N'文本', NULL, NULL, NULL, NULL, 'detail', 358, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目2', NULL, N'炭粉'),
  ('QC_INSP_REQ_SERIES', N'备用1', N'检验方法1', N'文本', NULL, NULL, NULL, NULL, 'detail', 38, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目1', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用2', N'检验标准1', N'文本', NULL, NULL, NULL, NULL, 'detail', 48, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目1', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用3', N'检验方法2', N'文本', NULL, NULL, NULL, NULL, 'detail', 58, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目2', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用4', N'检验标准2', N'文本', NULL, NULL, NULL, NULL, 'detail', 68, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目2', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用5', N'检验方法3', N'文本', NULL, NULL, NULL, NULL, 'detail', 78, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目3', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用6', N'检验标准3', N'文本', NULL, NULL, NULL, NULL, 'detail', 88, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目3', NULL, N'阻垢系列'),
  ('QC_INSP_REQ_SERIES', N'备用7', N'检验方法4', N'文本', NULL, NULL, NULL, NULL, 'detail', 98, 120, 1, 0, 0, NULL, 1, NULL, N'检验项目4', NULL, N'阻垢系列'),
  ('RD_ALKALINE', N'备用2', N'累积流量', N'文本', NULL, NULL, NULL, NULL, 'detail', 140, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL),
  ('RD_ALKALINE', N'备用3', N'累积流量（L）', N'文本', NULL, NULL, NULL, NULL, 'detail', 150, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                       place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
       place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key
  FROM @f s
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x
                    WHERE RTRIM(x.panel_code) = RTRIM(s.panel_code) AND RTRIM(x.col_name) = RTRIM(s.col_name));
GO

/* ═══ ② yj_translation:37 行(服务器独有、本地仍有引用的译名) ═══ */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(400), locale varchar(10), text nvarchar(1000), source varchar(10));
INSERT INTO @t VALUES
  ('field', N'供应商名称', 'en', N'Vendor Name', 'manual'),
  ('panel', N'产品变更申请单', 'en', N'Product Change Request', 'manual'),
  ('field', N'生产订单数量', 'en', N'Production Order Qty', 'manual'),
  ('field', N'计划开工日', 'en', N'Planned Start Date', 'manual'),
  ('field', N'混料计划', 'en', N'Mixing Plan', 'manual'),
  ('field', N'混料未完成', 'en', N'Mixing Outstanding', 'manual'),
  ('field', N'成型计划', 'en', N'Forming Plan', 'manual'),
  ('field', N'成型未完成', 'en', N'Forming Outstanding', 'manual'),
  ('field', N'切炭计划', 'en', N'Carbon Cutting Plan', 'manual'),
  ('field', N'切炭未完成', 'en', N'Carbon Cutting Outstanding', 'manual'),
  ('field', N'组装计划', 'en', N'Assembly Plan', 'manual'),
  ('field', N'组装未完成', 'en', N'Assembly Outstanding', 'manual'),
  ('field', N'装箱计划', 'en', N'Packing Plan', 'manual'),
  ('field', N'装箱未完成', 'en', N'Packing Outstanding', 'manual'),
  ('field', N'开产量', 'en', N'Started Qty', 'manual'),
  ('field', N'生产状态', 'en', N'Production Status', 'manual'),
  ('field', N'日产能', 'en', N'Daily Capacity', 'manual'),
  ('field', N'小时产能', 'en', N'Hourly Capacity', 'manual'),
  ('panel', N'生产线', 'en', N'Production Lines', 'manual'),
  ('field', N'排产班组', 'en', N'Schedule Team', 'manual'),
  ('field', N'外径3', 'en', N'外径3', 'manual'),
  ('field', N'检验方法1', 'en', N'检验方法1', 'manual'),
  ('field', N'检验标准1', 'en', N'检验标准1', 'manual'),
  ('field', N'检验方法2', 'en', N'检验方法2', 'manual'),
  ('field', N'检验标准2', 'en', N'检验标准2', 'manual'),
  ('field', N'检验方法3', 'en', N'检验方法3', 'manual'),
  ('field', N'检验标准4', 'en', N'检验标准4', 'manual'),
  ('field', N'检验标准3', 'en', N'检验标准3', 'manual'),
  ('field', N'检验方法4', 'en', N'检验方法4', 'manual'),
  ('field', N'检验方法5', 'en', N'检验方法5', 'manual'),
  ('field', N'检验标准5', 'en', N'检验标准5', 'manual'),
  ('field', N'检验方法6', 'en', N'检验方法6', 'manual'),
  ('field', N'检验标准6', 'en', N'检验标准6', 'manual'),
  ('field', N'检验方法7', 'en', N'检验方法7', 'manual'),
  ('field', N'检验标准7', 'en', N'检验标准7', 'manual'),
  ('field', N'累积流量', 'en', N'累积流量', 'manual'),
  ('field', N'累积流量（L）', 'en', N'累积流量（L）', 'manual');
INSERT INTO yj_translation (scope, ref_key, locale, text, source, created_at, updated_at)
SELECT scope, ref_key, locale, text, source, GETDATE(), GETDATE() FROM @t s
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE RTRIM(x.scope) = RTRIM(s.scope) AND x.ref_key = s.ref_key AND RTRIM(x.locale) = RTRIM(s.locale));
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0, @dbn sysname = DB_NAME();
DECLARE @nf int = (SELECT COUNT(*) FROM yj_field WHERE col_name LIKE N'备用%' AND label NOT LIKE N'备用%' AND panel_code IN ('QC_INSP_REQ', 'QC_INSP_REQ_SERIES', 'RD_ALKALINE'));
IF @nf < 33 SET @bad = @bad + 1;
DECLARE @nt int = (SELECT COUNT(*) FROM yj_translation WHERE ((scope='field' AND ref_key=N'供应商名称' AND locale='en') OR (scope='panel' AND ref_key=N'产品变更申请单' AND locale='en') OR (scope='field' AND ref_key=N'生产订单数量' AND locale='en') OR (scope='field' AND ref_key=N'计划开工日' AND locale='en') OR (scope='field' AND ref_key=N'混料计划' AND locale='en') OR (scope='field' AND ref_key=N'混料未完成' AND locale='en') OR (scope='field' AND ref_key=N'成型计划' AND locale='en') OR (scope='field' AND ref_key=N'成型未完成' AND locale='en') OR (scope='field' AND ref_key=N'切炭计划' AND locale='en') OR (scope='field' AND ref_key=N'切炭未完成' AND locale='en') OR (scope='field' AND ref_key=N'组装计划' AND locale='en') OR (scope='field' AND ref_key=N'组装未完成' AND locale='en') OR (scope='field' AND ref_key=N'装箱计划' AND locale='en') OR (scope='field' AND ref_key=N'装箱未完成' AND locale='en') OR (scope='field' AND ref_key=N'开产量' AND locale='en') OR (scope='field' AND ref_key=N'生产状态' AND locale='en') OR (scope='field' AND ref_key=N'日产能' AND locale='en') OR (scope='field' AND ref_key=N'小时产能' AND locale='en') OR (scope='panel' AND ref_key=N'生产线' AND locale='en') OR (scope='field' AND ref_key=N'排产班组' AND locale='en') OR (scope='field' AND ref_key=N'外径3' AND locale='en') OR (scope='field' AND ref_key=N'检验方法1' AND locale='en') OR (scope='field' AND ref_key=N'检验标准1' AND locale='en') OR (scope='field' AND ref_key=N'检验方法2' AND locale='en') OR (scope='field' AND ref_key=N'检验标准2' AND locale='en') OR (scope='field' AND ref_key=N'检验方法3' AND locale='en') OR (scope='field' AND ref_key=N'检验标准4' AND locale='en') OR (scope='field' AND ref_key=N'检验标准3' AND locale='en') OR (scope='field' AND ref_key=N'检验方法4' AND locale='en') OR (scope='field' AND ref_key=N'检验方法5' AND locale='en') OR (scope='field' AND ref_key=N'检验标准5' AND locale='en') OR (scope='field' AND ref_key=N'检验方法6' AND locale='en') OR (scope='field' AND ref_key=N'检验标准6' AND locale='en') OR (scope='field' AND ref_key=N'检验方法7' AND locale='en') OR (scope='field' AND ref_key=N'检验标准7' AND locale='en') OR (scope='field' AND ref_key=N'累积流量' AND locale='en') OR (scope='field' AND ref_key=N'累积流量（L）' AND locale='en')));
IF @nt < 37 SET @bad = @bad + 1;
RAISERROR(N'[自检] %s:备用列自定义标签字段 %d 行(应 ≥ 33)、同步译名 %d 行(应 ≥ 37);不符 %d 条', 10, 1, @dbn, @nf, @nt, @bad);
IF @bad = 0 RAISERROR(N'[OK] 服务器端配置改动已同步(备用列自定义标签 + 译名)', 10, 1);
ELSE RAISERROR(N'[FAIL] 服务器端配置同步自检未过', 16, 1);
GO
