SET NOCOUNT ON;
SELECT wzdm, ckdm, lot_no, rkl, ckl, yl, update_date FROM kucun WHERE wzdm IN ('YJ-ZZ-001','YJ-KBL-012') ORDER BY wzdm, update_date;
