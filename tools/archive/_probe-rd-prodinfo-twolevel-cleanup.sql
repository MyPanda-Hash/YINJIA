/* 清理:_probe-rd-prodinfo-twolevel.cjs 造出的产品信息表单据
   TAG=PROBE2LMV6DMHNI  单号=PI-2026-10-0017
   ⚠ 只对测试账套跑:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -C -f 65001 -i <本文件> */
SET NOCOUNT ON;
DECLARE @no nvarchar(120) = N'PI-2026-10-0017';
SELECT N'[删除前] rd_prod_info_head' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_prod_info_head WHERE 单据编号 = @no
UNION ALL SELECT N'[删除前] yj_doc_status', CAST(COUNT(*) AS nvarchar(10)) FROM yj_doc_status WHERE panel_code = N'RD_PROD_INFO' AND doc_no = @no
UNION ALL SELECT N'[删除前] yj_form_approval', CAST(COUNT(*) AS nvarchar(10)) FROM yj_form_approval WHERE panel_code = N'RD_PROD_INFO' AND form_no = @no
UNION ALL SELECT N'[删除前] yj_message', CAST(COUNT(*) AS nvarchar(10)) FROM yj_message WHERE 单据编号 = @no;
DELETE FROM yj_message       WHERE 单据编号 = @no;
DELETE FROM yj_form_approval WHERE panel_code = N'RD_PROD_INFO' AND form_no = @no;
IF OBJECT_ID('yj_doc_modify_log') IS NOT NULL DELETE FROM yj_doc_modify_log WHERE doc_no = @no;
DELETE FROM yj_doc_status    WHERE panel_code = N'RD_PROD_INFO' AND doc_no = @no;
IF OBJECT_ID('rd_prod_info_detail') IS NOT NULL DELETE FROM rd_prod_info_detail WHERE 单据编号 = @no;
DELETE FROM rd_prod_info_head WHERE 单据编号 = @no;
SELECT N'[删除后] 残留' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_prod_info_head WHERE 单据编号 = @no;
