SET NOCOUNT ON;
SELECT TOP 8 存货, LEN(存货) AS len_, DATALENGTH(存货) AS bytes, UNICODE(SUBSTRING(存货, LEN(存货), 1)) AS last_char
FROM v_stock_ledger WHERE 存货 LIKE N'A+%';
SELECT COUNT(*) AS eq_match FROM v_stock_ledger WHERE 存货 = N'A+级烧结炭棒';
SELECT DISTINCT 存货 FROM v_stock_ledger WHERE 存货 LIKE N'%烧结%' ORDER BY 1;
