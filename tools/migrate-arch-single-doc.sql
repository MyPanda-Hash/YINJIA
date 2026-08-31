/* 基础资料面板迁移:多单据痕迹 -> light-mes §八 严格单单据结构
   1) yj_panel 增加 detail_key(单单据明细键)
   2) 档案面板 category -> 基础档案
   3) 档案字段 place 全部归入 detail(取消 query/header) */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF COL_LENGTH('yj_panel', 'detail_key') IS NULL
    ALTER TABLE yj_panel ADD detail_key nvarchar(30) NULL;
GO
UPDATE yj_panel SET category = N'基础档案', detail_key = LOWER(panel_code)
WHERE mode = 'archive';
-- 单据面板沿用 items 键(与现有数据契约一致)
UPDATE yj_panel SET detail_key = 'items' WHERE mode <> 'archive';
UPDATE yj_field SET place = 'detail' WHERE panel_code IN ('KHDA','GFDA','YWYDA','CKDA','ZDGL');
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_panel TO yinjia;
DECLARE @c int = (SELECT COUNT(*) FROM yj_panel WHERE mode='archive');
PRINT N'基础档案单单据迁移完成: ' + CAST(@c AS nvarchar(10)) + N' 个档案面板';
GO
