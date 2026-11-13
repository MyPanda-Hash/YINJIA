/* ============================================================
   migrate-return-fields-layout-20261113.sql — 2026-11-13
   销售退货单 SALE_IN / 生产退料单 MATERIAL_RET 的**字段排序 + 显示/隐藏**定稿
   (用户口径 2026-11-13:「对照着销售出库单的字段,还有金蝶有数据的字段,做好排序和隐藏;
     生产退料则根据生产领料单的字段和金蝶的数据字段,做好排序和隐藏」)

   判据(全部可复核,不靠印象):
     ① 参照面板可见的业务字段保留 → 销售退货=销售出库单,生产退料=材料出库单(生产领料单);
     ② 金蝶真实账套**有数据**的键放开显示 → 非空率见 tools/archive/_ret-docs-20261113/ret-fieldfill.json
        (销售退货 30 单/45 行、生产退料 30 单/113 行,逐键统计);
     ③ MES 业务必需(单号/日期/状态/ERP 留痕/备注/附件/退货原因)保留;
     ④ 技术族(id / 是否多单位 / 仓位 / 辅助属性 / 换算 / 基本单位 / 开票 / 财务分摊)一律隐藏,即使金蝶有值。

   幂等:先「全隐藏 + 把 query 前缀收掉」,再按清单逐条放开并写 seq,可重复执行。
   生成器:tools/archive/_gen-return-fields-layout-20261113.mjs(改布局请改生成器后重跑)。
   ============================================================ */
SET NOCOUNT ON;
GO

-- ========== 销售退货单(SALE_IN)· 布局定稿 ==========
-- 补字段 备注(金蝶 sal_in_bound 有该键,参照面板未登记)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'备注')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)
VALUES (N'SALE_IN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 999, 240, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
-- ② 全隐藏并归位(可重复执行):查询区前缀一律收掉,只保留 header/detail 归属
UPDATE yj_field SET hidden = 1, visible = 0,
       place = CASE
           WHEN place LIKE N'%header%' AND place LIKE N'%detail%' THEN N'header,detail'
           WHEN place LIKE N'%header%' THEN N'header'
           WHEN place LIKE N'%detail%' THEN N'detail'
           ELSE N'detail' END
WHERE panel_code = N'SALE_IN';
-- ③ 按清单放开并写顺序(表头 10/20/…,明细 10/20/… 各自编号)
-- 表头 24 个字段
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
-- 明细 18 个字段
UPDATE yj_field SET place = N'query,detail', seq = 10, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'存货编码';
UPDATE yj_field SET place = N'detail', seq = 20, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'存货名称';
UPDATE yj_field SET place = N'detail', seq = 30, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'规格型号';
UPDATE yj_field SET place = N'detail', seq = 40, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'计量单位';
UPDATE yj_field SET place = N'detail', seq = 50, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'数量';
UPDATE yj_field SET place = N'detail', seq = 60, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'售价';
UPDATE yj_field SET place = N'detail', seq = 70, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'含税售价';
UPDATE yj_field SET place = N'detail', seq = 80, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'销售金额';
UPDATE yj_field SET place = N'detail', seq = 90, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'税率%';
UPDATE yj_field SET place = N'detail', seq = 100, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'税额';
UPDATE yj_field SET place = N'detail', seq = 110, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'含税销售金额';
UPDATE yj_field SET place = N'detail', seq = 120, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'折扣金额';
UPDATE yj_field SET place = N'detail', seq = 130, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'成本价';
UPDATE yj_field SET place = N'query,detail', seq = 140, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'批号';
UPDATE yj_field SET place = N'query,detail', seq = 150, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'仓库';
UPDATE yj_field SET place = N'detail', seq = 160, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'退货数量';
UPDATE yj_field SET place = N'detail', seq = 170, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'源单行号';
UPDATE yj_field SET place = N'detail', seq = 180, hidden = 0, visible = 1
 WHERE panel_code = N'SALE_IN' AND col_name = N'现存量';

-- ========== 生产退料单(MATERIAL_RET)· 布局定稿 ==========
-- ② 全隐藏并归位(可重复执行):查询区前缀一律收掉,只保留 header/detail 归属
UPDATE yj_field SET hidden = 1, visible = 0,
       place = CASE
           WHEN place LIKE N'%header%' AND place LIKE N'%detail%' THEN N'header,detail'
           WHEN place LIKE N'%header%' THEN N'header'
           WHEN place LIKE N'%detail%' THEN N'detail'
           ELSE N'detail' END
WHERE panel_code = N'MATERIAL_RET';
-- ③ 按清单放开并写顺序(表头 10/20/…,明细 10/20/… 各自编号)
-- 表头 19 个字段
UPDATE yj_field SET place = N'query,header', seq = 10, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据编号';
UPDATE yj_field SET place = N'query,header', seq = 20, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据日期';
UPDATE yj_field SET place = N'query,header', seq = 30, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'业务类型';
UPDATE yj_field SET place = N'query,header', seq = 40, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'生产车间';
UPDATE yj_field SET place = N'header', seq = 50, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'部门编码';
UPDATE yj_field SET place = N'query,header', seq = 60, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'领用人';
UPDATE yj_field SET place = N'header', seq = 70, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'经手人编码';
UPDATE yj_field SET place = N'query,header', seq = 80, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'出库类别';
UPDATE yj_field SET place = N'header', seq = 90, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'加工单号';
UPDATE yj_field SET place = N'query,header', seq = 100, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'工单行号';
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
-- 明细 15 个字段
UPDATE yj_field SET place = N'query,detail', seq = 10, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'材料编码';
UPDATE yj_field SET place = N'detail', seq = 20, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'材料名称';
UPDATE yj_field SET place = N'detail', seq = 30, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'规格型号';
UPDATE yj_field SET place = N'detail', seq = 40, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'计量单位';
UPDATE yj_field SET place = N'detail', seq = 50, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'数量';
UPDATE yj_field SET place = N'detail', seq = 60, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单价';
UPDATE yj_field SET place = N'detail', seq = 70, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'金额';
UPDATE yj_field SET place = N'query,detail', seq = 80, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'批号';
UPDATE yj_field SET place = N'query,detail', seq = 90, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库';
UPDATE yj_field SET place = N'detail', seq = 100, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库编码';
UPDATE yj_field SET place = N'detail', seq = 110, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'行号';
UPDATE yj_field SET place = N'detail', seq = 120, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'成本';
UPDATE yj_field SET place = N'detail', seq = 130, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单位成本';
UPDATE yj_field SET place = N'detail', seq = 140, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'现存量';
UPDATE yj_field SET place = N'detail', seq = 150, hidden = 0, visible = 1
 WHERE panel_code = N'MATERIAL_RET' AND col_name = N'明细备注';

-- ④ 自检(全 PASS 才算布局定稿)
DECLARE @chk TABLE(项 nvarchar(60), 期望 int, 实际 int);
INSERT @chk SELECT N'SALE_IN 可见表头 24', 24, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND hidden = 0 AND visible = 1 AND place LIKE N'%header%');
INSERT @chk SELECT N'SALE_IN 可见明细 18', 18, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND hidden = 0 AND visible = 1 AND place LIKE N'%detail%');
INSERT @chk SELECT N'SALE_IN 仍带 query 前缀的隐藏字段 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND hidden = 1 AND place LIKE N'%query%');
INSERT @chk SELECT N'SALE_IN seq 为 0/空 的可见字段 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'SALE_IN' AND visible = 1 AND ISNULL(seq, 0) = 0);
INSERT @chk SELECT N'MATERIAL_RET 可见表头 19', 19, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND hidden = 0 AND visible = 1 AND place LIKE N'%header%');
INSERT @chk SELECT N'MATERIAL_RET 可见明细 15', 15, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND hidden = 0 AND visible = 1 AND place LIKE N'%detail%');
INSERT @chk SELECT N'MATERIAL_RET 仍带 query 前缀的隐藏字段 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND hidden = 1 AND place LIKE N'%query%');
INSERT @chk SELECT N'MATERIAL_RET seq 为 0/空 的可见字段 0', 0, (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND visible = 1 AND ISNULL(seq, 0) = 0);
SELECT 项, 期望, 实际, CASE WHEN 期望 = 实际 THEN N'PASS' ELSE N'FAIL' END AS 结果 FROM @chk;
SELECT CASE WHEN EXISTS (SELECT 1 FROM @chk WHERE 期望 <> 实际) THEN N'RESULT: FAIL' ELSE N'RESULT: ALL-PASS' END AS 结论;
GO