SET NOCOUNT ON;
DECLARE @wo nvarchar(60) = N'GD-TEST-ASM-20261112';
PRINT N'== 清理前的残留(应只有验证夹具) ==';
SELECT 单据编号, 工单号, ISNULL(工序,N'') AS op FROM dbo.qc_asm_insp_head WHERE 工单号=@wo;

/* 记下验证生成的单号(只清这几张,不动其它历史单据的 doc_status) */
DECLARE @nos TABLE (no nvarchar(60) PRIMARY KEY);
INSERT INTO @nos(no) SELECT 单据编号 FROM dbo.qc_asm_insp_head WHERE 工单号=@wo;

/* ① 先删报工行,避免定时吸收再把它当候选行重新出单 */
DELETE FROM dbo.scjl WHERE gldh=@wo;
/* ② 删自动/手工生成的表观单(头/行/占用链/单据状态) */
DELETE d FROM dbo.qc_asm_insp_detail d JOIN @nos n ON n.no=d.单据编号;
DELETE h FROM dbo.qc_asm_insp_head h JOIN @nos n ON n.no=h.单据编号;
DELETE fl FROM dbo.form_flow_link fl JOIN @nos n ON n.no=fl.target_form_no;
DELETE ds FROM dbo.yj_doc_status ds JOIN @nos n ON n.no=ds.doc_no WHERE ds.panel_code=N'QC_ASM_INSP';
/* ③ 删夹具工单行与其排产镜像 */
DELETE FROM dbo.plang_pc WHERE plang_id IN (SELECT id FROM dbo.plang WHERE pl_no=@wo);
DELETE FROM dbo.plang WHERE pl_no=@wo;

PRINT N'== 清理后自检(全部应为 0) ==';
SELECT (SELECT COUNT(*) FROM dbo.plang WHERE pl_no=@wo) AS plang_left,
       (SELECT COUNT(*) FROM dbo.scjl WHERE gldh=@wo) AS scjl_left,
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_head WHERE 工单号=@wo) AS asm_head_left,
       (SELECT COUNT(*) FROM dbo.form_flow_link WHERE source_form_no=@wo) AS link_left;
