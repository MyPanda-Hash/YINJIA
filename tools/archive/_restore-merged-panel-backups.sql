/* _restore-merged-panel-backups.sql — 一次性补救脚本(2026-09-11)
   背景:_cleanup-merged-panels-20260911.sql 第一版漏了「备份表非空才允许清空」的闸门,
        四张 <表>_bak_20260911 里的 12 行被清空过。本脚本从 2026-09-10 20:25 的完整备份
        (deploy\HSDZ_MES_local.bak)还原出的临时库 HSDZ_MES_0911_tmp 里,按原 id 回填备份表。
   执行前置:先 RESTORE 出临时库 HSDZ_MES_0911_tmp(见汇报里的命令行)。
   幂等:先清空备份表再插(只插 12 行原数据),可重复执行。 */
SET NOCOUNT ON;
BEGIN TRAN;
DELETE FROM rd_mold_formula_head_bak_20260911;
DELETE FROM rd_mold_formula_detail_bak_20260911;
DELETE FROM rd_asm_bom_head_bak_20260911;
DELETE FROM rd_asm_bom_detail_bak_20260911;

SET IDENTITY_INSERT rd_mold_formula_head_bak_20260911 ON;
INSERT INTO rd_mold_formula_head_bak_20260911 (id,单据编号,单据日期,表单管理人,密级,使用范围,版本号,产品编号,产品名称,炭棒规格1,炭棒规格2,炭棒规格3,产品管控类型,外观要求,生产车间,配料要求,备注,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel)
SELECT id,单据编号,单据日期,表单管理人,密级,使用范围,版本号,产品编号,产品名称,炭棒规格1,炭棒规格2,炭棒规格3,产品管控类型,外观要求,生产车间,配料要求,备注,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel FROM HSDZ_MES_0911_tmp.dbo.rd_mold_formula_head;
SET IDENTITY_INSERT rd_mold_formula_head_bak_20260911 OFF;

SET IDENTITY_INSERT rd_mold_formula_detail_bak_20260911 ON;
INSERT INTO rd_mold_formula_detail_bak_20260911 (id,单据编号,序号,物料种类,物料编号,物料名称,实际添加比例,单支物料含量,设计添加量,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel)
SELECT id,单据编号,序号,物料种类,物料编号,物料名称,实际添加比例,单支物料含量,设计添加量,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel FROM HSDZ_MES_0911_tmp.dbo.rd_mold_formula_detail;
SET IDENTITY_INSERT rd_mold_formula_detail_bak_20260911 OFF;

SET IDENTITY_INSERT rd_asm_bom_head_bak_20260911 ON;
INSERT INTO rd_asm_bom_head_bak_20260911 (id,单据编号,单据日期,备注,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel,产品编号,产品名称,产品种类,整体规格外径,整体规格长度,成品重量)
SELECT id,单据编号,单据日期,备注,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel,产品编号,产品名称,产品种类,整体规格外径,整体规格长度,成品重量 FROM HSDZ_MES_0911_tmp.dbo.rd_asm_bom_head;
SET IDENTITY_INSERT rd_asm_bom_head_bak_20260911 OFF;

SET IDENTITY_INSERT rd_asm_bom_detail_bak_20260911 ON;
INSERT INTO rd_asm_bom_detail_bak_20260911 (id,单据编号,物料名,物料编号,物料规格,外观要求,用量,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel,表区,序号,更改内容,更改原因,更改时间,责任人,备注)
SELECT id,单据编号,物料名,物料编号,物料规格,外观要求,用量,asp_user1,asp_time1,asp_user2,asp_time2,asp_cancel,表区,序号,更改内容,更改原因,更改时间,责任人,备注 FROM HSDZ_MES_0911_tmp.dbo.rd_asm_bom_detail;
SET IDENTITY_INSERT rd_asm_bom_detail_bak_20260911 OFF;

DECLARE @n int = (SELECT COUNT(*) FROM rd_mold_formula_head_bak_20260911)
               + (SELECT COUNT(*) FROM rd_mold_formula_detail_bak_20260911)
               + (SELECT COUNT(*) FROM rd_asm_bom_head_bak_20260911)
               + (SELECT COUNT(*) FROM rd_asm_bom_detail_bak_20260911);
IF @n <> 12
BEGIN ROLLBACK; PRINT '❌ 回滚:回填行数 ' + CAST(@n AS nvarchar) + ' <> 12(期望 3+2+3+4)'; END
ELSE
BEGIN COMMIT; PRINT '✅ 已提交:12 行原数据回填到四张 <表>_bak_20260911'; END

SELECT 'MF_head=' + CAST((SELECT COUNT(*) FROM rd_mold_formula_head_bak_20260911) AS nvarchar)
     + ' MF_detail=' + CAST((SELECT COUNT(*) FROM rd_mold_formula_detail_bak_20260911) AS nvarchar)
     + ' AB_head=' + CAST((SELECT COUNT(*) FROM rd_asm_bom_head_bak_20260911) AS nvarchar)
     + ' AB_detail=' + CAST((SELECT COUNT(*) FROM rd_asm_bom_detail_bak_20260911) AS nvarchar) AS 备份表行数;
