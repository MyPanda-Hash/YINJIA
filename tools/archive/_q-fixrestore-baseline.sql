/* fix-db-restore-20260915.sql 在本地库的适用性核验 + 补登记(收尾探针,只读+一条登记) */
SET NOCOUNT ON;
GO
PRINT '== ① 该脚本的核心效果是否已存在(22 报表视图 + DISPATCH_DETAIL 面板) ==';
SELECT
  (SELECT COUNT(*) FROM sys.objects o WHERE o.type='V' AND o.name IN (
     'v_dispatch_detail','v_dispatch_stats','v_finish_in_detail','v_finish_in_stats',
     'v_manu_order_detail','v_manu_order_stats','v_material_out_detail','v_material_out_stats',
     'v_other_in_detail','v_other_in_stats','v_other_out_detail','v_other_out_stats',
     'v_outsource_in_detail','v_outsource_in_stats','v_outsource_issue_detail','v_outsource_issue_stats',
     'v_purchase_in_detail','v_purchase_in_stats','v_sale_out_detail','v_sale_out_stats',
     'v_sales_order_detail','v_sales_order_stats')) AS 视图存在数,
  (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN ('DISPATCH_DETAIL','DISPATCH_STATS','PURCHASE_IN_DETAIL','SALE_OUT_DETAIL')) AS 面板注册数;
GO
PRINT '== ② 补登记(内容哈希由外部计算传入,与 DbSync.sha256(文件字节) 一致) ==';
DECLARE @h char(64) = N'317ea6c4d67ca45438b44539442a6818c0c75588e6366f4b746985acc5b08a6b';
IF OBJECT_ID('yj_schema_log') IS NOT NULL AND @h IS NOT NULL
  INSERT INTO yj_schema_log (script_name, content_hash)
  SELECT N'fix-db-restore-20260915.sql', @h
  WHERE NOT EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = N'fix-db-restore-20260915.sql');
SELECT script_name, LEFT(content_hash, 12) AS hash12, applied_at FROM yj_schema_log WHERE script_name = N'fix-db-restore-20260915.sql';
GO
