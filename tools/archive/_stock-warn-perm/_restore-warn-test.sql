SET NOCOUNT ON;
-- 恢复:全量 setAllData 测试(warnQty 7 → 0)把测试账套里仅有的 3 行非 0 预警也刷成 0 了,
-- 按 _snap-warn-test_before.txt 的原值逐行写回(幂等:按 (ckdm,wzdm,lot) 精确定位)。
UPDATE kucun SET 预警数量 = 2223 WHERE ckdm = N'CP-02'  AND wzdm = N'A-32-09'   AND ISNULL(RTRIM(lot_no), N'') = N'PC0000';
UPDATE kucun SET 预警数量 = 9848 WHERE ckdm = N'CP-02'  AND wzdm = N'C-84-02'   AND ISNULL(RTRIM(lot_no), N'') = N'PC0000';
UPDATE kucun SET 预警数量 = 18   WHERE ckdm = N'YCL-01' AND wzdm = N'PMC-80325' AND ISNULL(RTRIM(lot_no), N'') = N'PC0000';
