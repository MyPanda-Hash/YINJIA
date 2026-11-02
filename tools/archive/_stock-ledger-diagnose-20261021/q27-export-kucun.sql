SET NOCOUNT ON;
SELECT wzdm, ckdm, lot_no = ISNULL(lot_no,'<NULL>'), yl FROM kucun ORDER BY wzdm, ckdm;
