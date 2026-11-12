SET NOCOUNT ON;
DECLARE @wo nvarchar(60)=N'GD-TEST-FIRST-261112';
PRINT N'== 首件检验单(期望: 昨天1张 + 今天1张;今天那张报工数量=1、批次/生产日期留空) ==';
SELECT 单据编号, ISNULL(工单行号,0) xc, 工序, 单据日期, 检验日期, 报工数量,
       ISNULL(生产日期,N'') AS prod_date, ISNULL(批次号,N'') AS lot, ISNULL(报工单号,N'') AS rep,
       CONVERT(varchar(19),asp_time1,120) AS created
FROM qc_first_insp_head WHERE 工单号=@wo ORDER BY 单据日期, id;
PRINT N'== 制程检验单(期望: 累计达标后才出,1 张) ==';
SELECT 单据编号, 工序, 单据日期, 报工数量 FROM qc_proc_insp_head WHERE 工单号=@wo ORDER BY id;
PRINT N'== 出货检验表观(期望: 切炭流入组装后出,1 张) ==';
SELECT 单据编号, 工序, 单据日期, 报工数量 FROM qc_asm_insp_head WHERE 工单号=@wo ORDER BY id;
PRINT N'== 占用链 ==';
SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, link_status
FROM form_flow_link WHERE target_form_no IN (
  SELECT 单据编号 FROM qc_first_insp_head WHERE 工单号=@wo
  UNION SELECT 单据编号 FROM qc_proc_insp_head WHERE 工单号=@wo
  UNION SELECT 单据编号 FROM qc_asm_insp_head WHERE 工单号=@wo) ORDER BY target_panel_code, target_form_no;
PRINT N'== 计数断言 ==';
SELECT (SELECT COUNT(*) FROM qc_first_insp_head WHERE 工单号=@wo) AS first_total,
       (SELECT COUNT(*) FROM qc_first_insp_head WHERE 工单号=@wo AND 单据日期=CAST(GETDATE() AS date)) AS first_today,
       (SELECT COUNT(*) FROM qc_first_insp_head WHERE 工单号=@wo AND 单据日期=DATEADD(day,-1,CAST(GETDATE() AS date))) AS first_yesterday,
       (SELECT COUNT(*) FROM qc_proc_insp_head WHERE 工单号=@wo) AS proc_total,
       (SELECT COUNT(*) FROM qc_asm_insp_head WHERE 工单号=@wo) AS asm_total,
       (SELECT ISNULL(SUM(sl),0) FROM scjl WHERE gldh=@wo AND gxdm=N'成型' AND ISNULL(asp_cancel,'N')<>'Y') AS mold_reported;
