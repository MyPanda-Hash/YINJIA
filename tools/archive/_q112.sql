SET NOCOUNT ON;
-- 直接试 INSERT 看报什么错
INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)
VALUES ('YJ-XWR-003', 'CK00006', 'PC0000', GETDATE(), 10000, 10000, 0.39, 'test', GETDATE(), 'N');
SELECT 'INSERT成功' AS r;
SELECT wzdm, ckdm, lot_no, rkl, yl FROM kucun WHERE wzdm = 'YJ-XWR-003';
