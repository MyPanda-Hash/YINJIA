SET NOCOUNT ON;
SELECT '=== yj_doc_batch columns ===' AS x;
SELECT c.name, ty.name typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_doc_batch') ORDER BY c.column_id;
GO
SELECT '=== yj_doc_batch rows ===' AS x;
SELECT * FROM yj_doc_batch WHERE id IN (308,309,310,311,312,313,314,315,316,317,61,62,63,67,68);
GO
SELECT '=== source heads ===' AS x;
SELECT id,单据编号,单据日期,业务员,供应商代码,供应商,部门,部门名称,数量,备注,单据状态,审核人,审核时间,采购订单号,批次号,来料性质,仓库,金额,税额,总金额,批次键,asp_cancel
FROM sl_recv WHERE 单据编号 IN ('SL-2026-10-0121','SL-2026-10-0124','SL-2026-10-0125','SL-2026-10-0127','SL-2026-10-0128','SL-2026-10-0085','SL-2026-10-0129','SL-2026-10-0130','SL-2026-10-0009','SL-2026-10-0010','SL-2026-10-0011','SL-2026-10-0012','SL-2026-10-0015','SL-2026-10-0131') ORDER BY 单据日期,单据编号;
GO
SELECT '=== source lines ===' AS x;
SELECT id,单据编号,物料编码,物料名称,规格型号,物料描述,数量,日期,供应商,单价,折扣,金额,备注,采购单号,部门,部门名称,计量单位,采购订单行号,批次号,剩余数量,退料数量
FROM sl_recv_detail WHERE 单据编号 IN ('SL-2026-10-0121','SL-2026-10-0124','SL-2026-10-0125','SL-2026-10-0127','SL-2026-10-0128','SL-2026-10-0085','SL-2026-10-0129','SL-2026-10-0130','SL-2026-10-0009','SL-2026-10-0010','SL-2026-10-0011','SL-2026-10-0012','SL-2026-10-0015','SL-2026-10-0131') ORDER BY 单据编号,id;
GO
SELECT '=== inv info ===' AS x;
SELECT 存货编码,存货名称,规格型号,所属类别,来料检验,默认仓位 FROM bs_inv WHERE 存货编码 IN ('YJ-XH-001','YJ-XH-002','YJ-YKRS-014','YJ-YKRS-009','YJ-HSM-004','YJ-YPS-002','Y-S-N','Y-S-Z') ORDER BY 存货编码;
GO
SELECT '=== allno ===' AS x;
SELECT * FROM s_allno WHERE lb IN ('IJ','JYML','JYSJ','TH') ORDER BY lb, ny, dh;
GO
