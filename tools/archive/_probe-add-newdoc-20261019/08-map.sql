SET NOCOUNT ON;
SELECT 单据编号, COUNT(*) n, MIN(单据日期) min_d, MAX(单据日期) max_d, MIN(id) min_id, MAX(id) max_id FROM sl_recv GROUP BY 单据编号 ORDER BY 单据编号 DESC OFFSET 0 ROWS FETCH NEXT 30 ROWS ONLY;
SELECT dh, lb, ny, asp_time1 FROM s_allno WHERE lb='SL' ORDER BY dh DESC OFFSET 0 ROWS FETCH NEXT 40 ROWS ONLY;
