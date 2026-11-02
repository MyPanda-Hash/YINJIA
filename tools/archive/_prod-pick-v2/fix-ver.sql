SET NOCOUNT ON;
UPDATE rd_asm_proc_head
   SET 版本号 = N'V2026-11-01-01'
 WHERE 单据编号 = N'AP-2026-11-0001' AND 产品编号 = N'B-70-04';
SELECT 单据编号, 产品编号, 版本号 FROM rd_asm_proc_head WHERE 产品编号=N'B-70-04';
