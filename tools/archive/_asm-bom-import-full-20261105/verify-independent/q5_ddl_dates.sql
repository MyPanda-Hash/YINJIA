SET NOCOUNT ON;
-- 表最后修改时间(用于证明本任务未做 DDL)
SELECT OBJECT_NAME(object_id) AS obj, type_desc, create_date, modify_date
  FROM sys.objects WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');
GO
SELECT COUNT(*) AS msdesc_cnt FROM sys.extended_properties
 WHERE class = 1 AND major_id = OBJECT_ID('dbo.bs_asm_bom') AND name = 'MS_Description';
GO
SELECT panel_code, ISNULL(config, N'<NULL>') AS config FROM yj_panel WHERE panel_code = 'ASM_BOM';
GO
SELECT COUNT(*) AS trigger_cnt FROM sys.triggers WHERE parent_id = OBJECT_ID('dbo.bs_asm_bom');
GO
-- 其它来源行(面板手工草稿)的完整值:用于确认未被本任务修改
SELECT 单据编号, 产品编码, 产品名称, 工序, 版本号, 状态, 行序, 子件编码, 标准用量,
       asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel
  FROM dbo.bs_asm_bom WHERE 来源 IS NULL ORDER BY 单据编号, 行序;
GO
