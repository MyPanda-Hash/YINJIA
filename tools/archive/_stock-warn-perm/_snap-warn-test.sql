SET NOCOUNT ON;
-- 快照:测试账套里「预警数量」非 0 的行(跑 setAllData 全量测试前先存好,跑完按此恢复)
SELECT ckdm, wzdm, ISNULL(RTRIM(lot_no), N'') AS lot, 预警数量
FROM kucun
WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND ISNULL(预警数量, 0) <> 0
ORDER BY ckdm, wzdm, lot;
