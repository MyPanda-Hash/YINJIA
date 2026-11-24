-- 造数(仅测试账套):给 YJ-XWR-058 增加两个**真实批号**的库存,用于验证
-- 「同一物料多个批次号分开记明细」。批次号带 TESTB- 前缀,便于验完精准清理。
INSERT INTO dbo.kucun (comm, wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel, bz)
SELECT '0', N'YJ-XWR-058', N'YCL-01', v.lot, SYSDATETIME(), 600, 0, 600, 'qa-split', SYSDATETIME(), 'N', 'TESTB 造数(验证多批次拆行,验完即删)'
FROM (VALUES (N'TESTB-20261124-01'), (N'TESTB-20261124-02')) v(lot)
WHERE NOT EXISTS (SELECT 1 FROM dbo.kucun k WHERE k.wzdm = N'YJ-XWR-058' AND k.lot_no = v.lot);

SELECT lot_no, ckdm, yl FROM dbo.kucun WHERE wzdm = N'YJ-XWR-058' ORDER BY lot_no;
