-- 一次性探针:定位"新增生产工单数据不可见"问题,取证 plang/plang_pc/bd_manu_order/bl_manu_order/scjl 最近数据
SET NOCOUNT ON;
SELECT CONVERT(varchar(19), GETDATE(), 120) AS utc_now;

SELECT TOP 12 id, comm, pl_no, pl_xc, CONVERT(varchar(19), pl_date, 120) AS pl_date,
       scx, ja, asp_cancel, asp_user1, CONVERT(varchar(19), asp_time1, 120) AS t1
FROM dbo.plang ORDER BY id DESC;
SELECT COUNT(*) AS plang_cnt FROM dbo.plang;

SELECT TOP 12 id, comm, pl_no, pl_xc, plang_id, scx, ja, asp_cancel,
       CONVERT(varchar(19), asp_time1, 120) AS t1
FROM dbo.plang_pc ORDER BY id DESC;
SELECT COUNT(*) AS plangpc_cnt FROM dbo.plang_pc;

SELECT TOP 8 id, CONVERT(varchar(19), asp_time1, 120) AS t1, asp_cancel
FROM dbo.bd_manu_order ORDER BY id DESC;
SELECT COUNT(*) AS bd_cnt FROM dbo.bd_manu_order;

SELECT TOP 8 id, CONVERT(varchar(19), asp_time1, 120) AS t1
FROM dbo.bl_manu_order ORDER BY id DESC;
SELECT COUNT(*) AS bl_cnt FROM dbo.bl_manu_order;

SELECT TOP 8 id, sc_no, gldh, gd_id, CONVERT(varchar(19), asp_time1, 120) AS t1
FROM dbo.scjl ORDER BY id DESC;
