SET NOCOUNT ON;
SELECT ISNULL(检验状态,N'(空)') AS st, COUNT(*) n FROM v_qc_insp_rec_detail GROUP BY 检验状态 ORDER BY 2 DESC;
