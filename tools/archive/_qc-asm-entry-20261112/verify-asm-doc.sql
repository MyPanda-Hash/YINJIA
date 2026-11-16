SET NOCOUNT ON;
PRINT N'== 新生成的表观单(工单=GD-TEST-ASM-20261112) ==';
SELECT 单据编号, ISNULL(工单号,N'') AS wo, ISNULL(工单行号,0) AS xc, ISNULL(工序,N'') AS op,
       ISNULL(批次号,N'') AS lot, ISNULL(生产线,N'') AS line, ISNULL(产品编码,N'') AS dm,
       ISNULL(CONVERT(varchar(30),报工数量),N'') AS qty_str, ISNULL(检验日期,N'') AS insp_date,
       ISNULL(单据日期,N'') AS doc_date, CONVERT(varchar(19),asp_time1,120) AS created
FROM dbo.qc_asm_insp_head WHERE 工单号=N'GD-TEST-ASM-20261112';
PRINT N'== 明细 ==';
SELECT 单据编号, ISNULL(检验类型,N'') AS type, ISNULL(检验项目,N'') AS item, ISNULL(检验要求,N'') AS req
FROM dbo.qc_asm_insp_detail WHERE 单据编号 IN (SELECT 单据编号 FROM dbo.qc_asm_insp_head WHERE 工单号=N'GD-TEST-ASM-20261112');
PRINT N'== 占用链 ==';
SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, link_status
FROM dbo.form_flow_link WHERE target_form_no IN (SELECT 单据编号 FROM dbo.qc_asm_insp_head WHERE 工单号=N'GD-TEST-ASM-20261112');
PRINT N'== 夹具行状态 ==';
SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.[当前工序],N'') AS cur_op, ISNULL(p.[完工状态],N'') AS done_state
FROM dbo.plang p WHERE p.pl_no=N'GD-TEST-ASM-20261112';
