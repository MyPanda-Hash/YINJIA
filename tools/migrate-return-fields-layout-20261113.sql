/* ============================================================
   migrate-return-fields-layout-20261113.sql — 2026-11-13
   销售退货单 SALE_IN / 生产退料单 MATERIAL_RET 的**字段排序 + 显示/隐藏**定稿
   (用户口径:「对照着销售出库单的字段,还有金蝶有数据的字段,做好排序和隐藏;生产退料则根据
     生产领料单的字段和金蝶的数据字段,做好排序和隐藏」+「生产退料要有工单号和工单行号」)

   判据:① 参照面板可见的业务字段保留;② 金蝶真实账套有数据的键放开(非空率见
   tools/archive/_ret-docs-20261113/ret-fieldfill.json,30 单/逐键);③ MES 业务必需保留;
   ④ 技术族(id/是否多单位/仓位/辅助属性/换算/基本单位/开票/财务分摊)一律隐藏。

   幂等:先「全隐藏 + 收掉 query 前缀」,再按清单逐条放开并写 seq,可重复执行。
   生成器:tools/archive/_gen-return-fields-layout-20261113.mjs(改布局请改生成器后重跑)。
   ============================================================ */
SET NOCOUNT ON;
GO

-- ========== 销售退货单(SALE_IN,金蝶 sal_in_bound)· 布局定稿 ==========
-- 补字段 备注
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'备注')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)
VALUES (N'SALE_IN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 999, 240, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
-- ② 全隐藏并归位(可重复执行)
UPDATE yj_field SET hidden = 1, visible = 0,
       place = CASE
           WHEN place LIKE N'%header%' AND place LIKE N'%detail%' THEN N'header,detail'
           WHEN place LIKE N'%header%' THEN N'header'
           WHEN place LIKE N'%detail%' THEN N'detail'
           ELSE N'detail' END
WHERE panel_code = N'SALE_IN';
-- ③ 按清单放开并写顺序(42 个字段)
UPDATE yj_field SET place = N'query,header', seq = 10, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'单据编号';
UPDATE yj_field SET place = N'query,header', seq = 20, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'单据日期';
UPDATE yj_field SET place = N'query,header', seq = 30, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'客户';
UPDATE yj_field SET place = N'header', seq = 40, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'客户编码';
UPDATE yj_field SET place = N'header', seq = 50, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'出库类别';
UPDATE yj_field SET place = N'query,header', seq = 60, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'销售订单号';
UPDATE yj_field SET place = N'query,header', seq = 70, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'经手人';
UPDATE yj_field SET place = N'header', seq = 80, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'部门';
UPDATE yj_field SET place = N'header', seq = 90, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'联系人';
UPDATE yj_field SET place = N'header', seq = 100, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'联系人电话';
UPDATE yj_field SET place = N'header', seq = 110, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'退货原因';
UPDATE yj_field SET place = N'header', seq = 120, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'备注';
UPDATE yj_field SET place = N'header', seq = 130, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'附件';
UPDATE yj_field SET place = N'header', seq = 140, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'附件1';
UPDATE yj_field SET place = N'header', seq = 150, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'附件2';
UPDATE yj_field SET place = N'header', seq = 160, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'附件3';
UPDATE yj_field SET place = N'header', seq = 170, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'附件4';
UPDATE yj_field SET place = N'header', seq = 180, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'附件5';
UPDATE yj_field SET place = N'header', seq = 190, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'附件6';
UPDATE yj_field SET place = N'header', seq = 200, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'ERP单号';
UPDATE yj_field SET place = N'header', seq = 210, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'是否已转ERP';
UPDATE yj_field SET place = N'header', seq = 220, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'转ERP操作人';
UPDATE yj_field SET place = N'header', seq = 230, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'转ERP时间';
UPDATE yj_field SET place = N'header', seq = 240, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'创建时间';
UPDATE yj_field SET place = N'query,detail', seq = 250, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'存货编码';
UPDATE yj_field SET place = N'detail', seq = 260, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'存货名称';
UPDATE yj_field SET place = N'detail', seq = 270, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'规格型号';
UPDATE yj_field SET place = N'detail', seq = 280, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'计量单位';
UPDATE yj_field SET place = N'detail', seq = 290, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'数量';
UPDATE yj_field SET place = N'detail', seq = 300, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'售价';
UPDATE yj_field SET place = N'detail', seq = 310, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'含税售价';
UPDATE yj_field SET place = N'detail', seq = 320, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'销售金额';
UPDATE yj_field SET place = N'detail', seq = 330, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'税率%';
UPDATE yj_field SET place = N'detail', seq = 340, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'税额';
UPDATE yj_field SET place = N'detail', seq = 350, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'含税销售金额';
UPDATE yj_field SET place = N'detail', seq = 360, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'折扣金额';
UPDATE yj_field SET place = N'detail', seq = 370, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'成本价';
UPDATE yj_field SET place = N'query,detail', seq = 380, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'批号';
UPDATE yj_field SET place = N'query,detail', seq = 390, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'仓库';
UPDATE yj_field SET place = N'detail', seq = 400, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'退货数量';
UPDATE yj_field SET place = N'detail', seq = 410, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'源单行号';
UPDATE yj_field SET place = N'detail', seq = 420, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'现存量';

-- ========== 生产退料单(MATERIAL_RET,金蝶 inv_pick_ret)· 布局定稿 ==========
-- ② 全隐藏并归位(可重复执行)
UPDATE yj_field SET hidden = 1, visible = 0,
       place = CASE
           WHEN place LIKE N'%header%' AND place LIKE N'%detail%' THEN N'header,detail'
           WHEN place LIKE N'%header%' THEN N'header'
           WHEN place LIKE N'%detail%' THEN N'detail'
           ELSE N'detail' END
WHERE panel_code = N'MATERIAL_RET';
-- ③ 按清单放开并写顺序(34 个字段)
UPDATE yj_field SET place = N'query,header', seq = 10, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据编号';
UPDATE yj_field SET place = N'query,header', seq = 20, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据日期';
UPDATE yj_field SET place = N'query,header', seq = 30, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'业务类型';
UPDATE yj_field SET place = N'query,header,detail', seq = 40, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'加工单号';
UPDATE yj_field SET place = N'query,header,detail', seq = 50, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'工单行号';
UPDATE yj_field SET place = N'query,header', seq = 60, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'生产车间';
UPDATE yj_field SET place = N'header', seq = 70, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'部门编码';
UPDATE yj_field SET place = N'query,header', seq = 80, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'领用人';
UPDATE yj_field SET place = N'header', seq = 90, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'经手人编码';
UPDATE yj_field SET place = N'query,header', seq = 100, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'出库类别';
UPDATE yj_field SET place = N'query,header', seq = 110, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'来源单据';
UPDATE yj_field SET place = N'header', seq = 120, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'来源单号';
UPDATE yj_field SET place = N'header', seq = 130, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'备注';
UPDATE yj_field SET place = N'header', seq = 140, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'ERP单号';
UPDATE yj_field SET place = N'header', seq = 150, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'是否已转ERP';
UPDATE yj_field SET place = N'header', seq = 160, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'转ERP操作人';
UPDATE yj_field SET place = N'header', seq = 170, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'转ERP时间';
UPDATE yj_field SET place = N'header', seq = 180, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'创建时间';
UPDATE yj_field SET place = N'header', seq = 190, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'金蝶单据状态';
UPDATE yj_field SET place = N'query,detail', seq = 200, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'材料编码';
UPDATE yj_field SET place = N'detail', seq = 210, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'材料名称';
UPDATE yj_field SET place = N'detail', seq = 220, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'规格型号';
UPDATE yj_field SET place = N'detail', seq = 230, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'计量单位';
UPDATE yj_field SET place = N'detail', seq = 240, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'数量';
UPDATE yj_field SET place = N'detail', seq = 250, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单价';
UPDATE yj_field SET place = N'detail', seq = 260, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'金额';
UPDATE yj_field SET place = N'query,detail', seq = 270, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'批号';
UPDATE yj_field SET place = N'query,detail', seq = 280, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库';
UPDATE yj_field SET place = N'detail', seq = 290, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库编码';
UPDATE yj_field SET place = N'detail', seq = 300, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'行号';
UPDATE yj_field SET place = N'detail', seq = 310, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'成本';
UPDATE yj_field SET place = N'detail', seq = 320, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单位成本';
UPDATE yj_field SET place = N'detail', seq = 330, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'现存量';
UPDATE yj_field SET place = N'detail', seq = 340, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'明细备注';
-- ④ 显示名调整(用户口径)
UPDATE yj_field SET label = N'工单号' WHERE panel_code = N'MATERIAL_RET' AND col_name = N'加工单号';
-- ⑤ 改名后的译名(9 语;en/ja 已存在)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'zh-TW', N'工單號', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'de', N'Arbeitsauftragsnummer', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'es', N'Número de orden de trabajo', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'fr', N'Numéro d’ordre de fabrication', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'ko', N'작업 지시 번호', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'ru', N'Номер производственного заказа', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'th', N'หมายเลขใบสั่งผลิต', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单号' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'工单号', N'vi', N'Số lệnh sản xuất', N'manual');

-- ⑥ 自检(全 PASS 才算布局定稿)
DECLARE @chk TABLE(项 nvarchar(70), 期望 int, 实际 int);
INSERT @chk SELECT N'SALE_IN 可见表头 24', 24, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND hidden = 0 AND visible = 1 AND place LIKE N'%header%');
INSERT @chk SELECT N'SALE_IN 可见明细 18', 18, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND hidden = 0 AND visible = 1 AND place LIKE N'%detail%');
INSERT @chk SELECT N'SALE_IN 隐藏字段残留 query 前缀 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND hidden = 1 AND place LIKE N'%query%');
INSERT @chk SELECT N'SALE_IN 可见字段 seq 为 0/空 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND visible = 1 AND ISNULL(seq, 0) = 0);
INSERT @chk SELECT N'MATERIAL_RET 可见表头 19', 19, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND hidden = 0 AND visible = 1 AND place LIKE N'%header%');
INSERT @chk SELECT N'MATERIAL_RET 可见明细 17', 17, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND hidden = 0 AND visible = 1 AND place LIKE N'%detail%');
INSERT @chk SELECT N'MATERIAL_RET 隐藏字段残留 query 前缀 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND hidden = 1 AND place LIKE N'%query%');
INSERT @chk SELECT N'MATERIAL_RET 可见字段 seq 为 0/空 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND visible = 1 AND ISNULL(seq, 0) = 0);
INSERT @chk SELECT N'生产退料单 工单号 可见', 1, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'加工单号' AND label = N'工单号' AND visible = 1 AND hidden = 0);
INSERT @chk SELECT N'生产退料单 工单行号 可见', 1, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'工单行号' AND visible = 1 AND hidden = 0);
SELECT 项, 期望, 实际, CASE WHEN 期望 = 实际 THEN N'PASS' ELSE N'FAIL' END AS 结果 FROM @chk;
SELECT CASE WHEN EXISTS (SELECT 1 FROM @chk WHERE 期望 <> 实际) THEN N'RESULT: FAIL' ELSE N'RESULT: ALL-PASS' END AS 结论;
GO