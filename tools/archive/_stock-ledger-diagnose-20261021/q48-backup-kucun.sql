SET NOCOUNT ON;
SELECT comm, wzdm, ckdm, lot_no = ISNULL(lot_no,'<NULL>'), in_date, rkl, ckl, yl, price, 预警数量,
       asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel
FROM kucun ORDER BY wzdm, ckdm, lot_no;
