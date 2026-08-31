-- 修复 v5:DETAIL 用 h.* + l.* 但排除重复 id/asp 列;逐个 EXEC
USE HSDZ_MES;
SET NOCOUNT ON;
EXEC('CREATE VIEW v_purchase_in_detail AS SELECT h.*, l.id AS line_id, ' +
    (SELECT STRING_AGG('l.' + QUOTENAME(c.name), ', ') FROM sys.columns c WHERE c.object_id=OBJECT_ID('bl_purchase_in') AND c.name NOT IN ('id','asp_user1','asp_time1','asp_cancel')) +
    ', h.asp_cancel AS v_cancel FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号] = l.[单据编号]');
