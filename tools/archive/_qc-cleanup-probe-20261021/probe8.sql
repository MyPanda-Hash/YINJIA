SET NOCOUNT ON;
SELECT '=== qc_return columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('qc_return') ORDER BY c.column_id;
GO
SELECT '=== qc_return_detail columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('qc_return_detail') ORDER BY c.column_id;
GO
SELECT '=== sl_recv columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('sl_recv') ORDER BY c.column_id;
GO
SELECT '=== sl_recv_detail columns ===' AS x;
SELECT c.name, ty.name typ, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('sl_recv_detail') ORDER BY c.column_id;
GO
SELECT '=== batch tables ===' AS x;
SELECT t.name FROM sys.tables t WHERE t.name LIKE '%batch%' ORDER BY t.name;
GO
SELECT '=== batch row sample ===' AS x;
SELECT * FROM batch WHERE id IN (308,309,310,311,312,313,314,315,316,317,61,62,63,67,68);
GO
SELECT '=== source heads ===' AS x;
SELECT * FROM sl_recv WHERE 单据编号 IN ('SL-2026-10-0121','SL-2026-10-0124','SL-2026-10-0125','SL-2026-10-0127','SL-2026-10-0128','SL-2026-10-0085','SL-2026-10-0129','SL-2026-10-0130','SL-2026-10-0009','SL-2026-10-0010','SL-2026-10-0011','SL-2026-10-0012','SL-2026-10-0015','SL-2026-10-0131') ORDER BY 单据日期,单据编号;
GO
SELECT '=== source lines ===' AS x;
SELECT * FROM sl_recv_detail WHERE 单据编号 IN ('SL-2026-10-0121','SL-2026-10-0124','SL-2026-10-0125','SL-2026-10-0127','SL-2026-10-0128','SL-2026-10-0085','SL-2026-10-0129','SL-2026-10-0130','SL-2026-10-0009','SL-2026-10-0010','SL-2026-10-0011','SL-2026-10-0012','SL-2026-10-0015','SL-2026-10-0131') ORDER BY 单据编号,id;
GO
SELECT '=== inv info ===' AS x;
SELECT 存货编码,存货名称,规格型号,所属类别,来料检验,默认仓位 FROM bs_inv WHERE 存货编码 IN ('YJ-XH-001','YJ-XH-002','YJ-YKRS-014','YJ-YKRS-009','YJ-HSM-004','YJ-YPS-002','Y-S-N','Y-S-Z') ORDER BY 存货编码;
GO
SELECT '=== batch no formula params ===' AS x;
SELECT * FROM s_allno WHERE lb IN ('IJ','JYML','JYSJ','TH') ORDER BY lb, ny, dh;
GO
