-- _q-schema-probe.sql — 采购链 E2E 前置侦查:两账套关键列/面板/按钮是否齐备
SET NOCOUNT ON;
PRINT N'==== 数据库: ' + DB_NAME() + N' ====';

PRINT N'-- 1. 关键列存在性(qc_return_detail.特采 / bl_purchase_in.特采 / 批次键/批次号)';
SELECT N'qc_return_detail.特采' AS 对象, CASE WHEN COL_LENGTH('dbo.qc_return_detail', N'特采') IS NULL THEN N'❌缺' ELSE N'✅有' END AS 状态
UNION ALL SELECT N'bl_purchase_in.特采', CASE WHEN COL_LENGTH('dbo.bl_purchase_in', N'特采') IS NULL THEN N'❌缺' ELSE N'✅有' END
UNION ALL SELECT N'qc_return_detail.送检数量', CASE WHEN COL_LENGTH('dbo.qc_return_detail', N'送检数量') IS NULL THEN N'❌缺' ELSE N'✅有' END
UNION ALL SELECT N'qc_tc_in 表', CASE WHEN OBJECT_ID('dbo.qc_tc_in') IS NULL THEN N'❌缺' ELSE N'✅有' END
UNION ALL SELECT N'sl_recv.批次键', CASE WHEN COL_LENGTH('dbo.sl_recv', N'批次键') IS NULL THEN N'❌缺' ELSE N'✅有' END
UNION ALL SELECT N'qc_insp.批次键', CASE WHEN COL_LENGTH('dbo.qc_insp', N'批次键') IS NULL THEN N'❌缺' ELSE N'✅有' END;

PRINT N'-- 2. 关键面板字段登记(采购链)';
SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field
 WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN', N'QC_TC_IN', N'PU_ORDER')
 GROUP BY panel_code ORDER BY panel_code;

PRINT N'-- 3. QC_RETURN 明细「特采」字段登记';
SELECT panel_code, col_name, label, data_type, place, seq, editable, hidden, visible
  FROM yj_field WHERE panel_code = N'QC_RETURN' AND col_name = N'特采';

PRINT N'-- 4. PURCHASE_IN 明细「特采」字段登记';
SELECT panel_code, col_name, label, data_type, place, seq, editable, hidden, visible
  FROM yj_field WHERE panel_code = N'PURCHASE_IN' AND col_name = N'特采';

PRINT N'-- 5. 现有链上单据量(摸底,判断测试库是否陈旧)';
SELECT N'sl_recv' AS t, COUNT(*) AS n FROM sl_recv
UNION ALL SELECT N'qc_insp', COUNT(*) FROM qc_insp
UNION ALL SELECT N'qc_return', COUNT(*) FROM qc_return
UNION ALL SELECT N'qc_tc_in', COUNT(*) FROM qc_tc_in
UNION ALL SELECT N'bd_purchase_in', COUNT(*) FROM bd_purchase_in;

PRINT N'-- 6. 用户/角色(真实登录用)';
SELECT username, real_name, is_admin FROM yj_user;
