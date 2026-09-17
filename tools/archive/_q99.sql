SET NOCOUNT ON;
-- 1. kucun 台账里有没有 YJ-XWR-003
SELECT wzdm, ckdm, lot_no, rkl, ckl, yl FROM kucun WHERE wzdm = 'YJ-XWR-003';
-- 2. MES 单据里的仓库是什么
SELECT l.单据编号, l.存货编码, l.仓库, l.仓库编码, l.批号, l.实收数量 FROM bl_purchase_in l WHERE l.存货编码 = 'YJ-XWR-003';
-- 3. 仓库编码对照
SELECT 仓库编码, 仓库名称 FROM bs_wh WHERE 仓库名称 IN ('华北工控仓','正品仓','原料仓','辅料仓','成品仓');
