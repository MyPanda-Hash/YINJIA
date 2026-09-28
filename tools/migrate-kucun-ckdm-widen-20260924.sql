-- migrate-kucun-ckdm-widen-20260924.sql — kucun.ckdm 扩宽(2026-09-24 截断报错修复)
-- 根因:kucun.ckdm 为 nvarchar(6),而 bs_wh.仓库编码 实际有 7 位(CK00003/CK00005/CK00006)——
--   7 位仓库入库审核时 INSERT kucun 报 'String or binary data would be truncated'(库兼容级别 100 无明细列名)。
-- 修法:对齐 bs_wh 宽度扩到 nvarchar(200);存量 31 行码均 <=6 无脏数据。
SET NOCOUNT ON;
IF COL_LENGTH('kucun','ckdm') < 400 ALTER TABLE kucun ALTER COLUMN ckdm nvarchar(200) NOT NULL;
GO
SELECT N'kucun.ckdm 宽='+CAST(c.max_length/2 AS varchar)+N' 字符' FROM sys.columns c WHERE c.object_id=OBJECT_ID('kucun') AND c.name='ckdm';
-- 同族 7 表(质检/入库/盘点/历史)同宽同坑,一并扩宽
IF COL_LENGTH('chsq','ckdm') < 400 ALTER TABLE chsq ALTER COLUMN ckdm nvarchar(200) NULL;
IF COL_LENGTH('inh','ckdm') < 400 ALTER TABLE inh ALTER COLUMN ckdm nvarchar(200) NULL;
IF COL_LENGTH('jyd','ckdm') < 400 ALTER TABLE jyd ALTER COLUMN ckdm nvarchar(200) NULL;
IF COL_LENGTH('pandian','ckdm') < 400 ALTER TABLE pandian ALTER COLUMN ckdm nvarchar(200) NULL;
IF COL_LENGTH('pd_history','ckdm') < 400 ALTER TABLE pd_history ALTER COLUMN ckdm nvarchar(200) NULL;
IF COL_LENGTH('pd_zzp','ckdm') < 400 ALTER TABLE pd_zzp ALTER COLUMN ckdm nvarchar(200) NULL;
IF COL_LENGTH('pd_zzphistory','ckdm') < 400 ALTER TABLE pd_zzphistory ALTER COLUMN ckdm nvarchar(200) NULL;
GO
PRINT N'migrate-kucun-ckdm-widen-20260924 完成'
GO
