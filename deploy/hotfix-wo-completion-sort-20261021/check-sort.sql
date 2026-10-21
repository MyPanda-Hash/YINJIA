/*
  check-sort.sql -- 完工明细(WO_COMPLETION_LIST)排序自检(只读, 可重复执行)

  期望(全部满足才算 PASS):
    ① panel 行存在, 且 date_col = wgsj
    ② out_of_order_pairs = 0   (按 wgsj DESC, id DESC 逐行比对, 没有任何逆序对)
    ③ TOP 5 的完工时间从大到小(最新在最上面)

  失败处理: THROW 51000 => 带 -b 的 sqlcmd 返回非 0, apply-db.bat 会报 [FAIL]。
  用法(服务器): sqlcmd -S localhost -d HSDZ_MES -E -b -W -s "|" -f 65001 -i check-sort.sql
  也可在 SSMS 里直接打开执行。
*/
SET NOCOUNT ON;

SELECT N'panel' AS k, panel_code AS v
  FROM dbo.yj_panel WHERE panel_code = N'WO_COMPLETION_LIST';
SELECT N'date_col' AS k, ISNULL(date_col, N'(NULL)') AS v
  FROM dbo.yj_panel WHERE panel_code = N'WO_COMPLETION_LIST';
SELECT N'rows' AS k, CAST(COUNT_BIG(*) AS nvarchar(30)) AS v
  FROM dbo.v_wo_completion_detail;
SELECT N'newest' AS k, CONVERT(nvarchar(19), MAX(wgsj), 120) AS v
  FROM dbo.v_wo_completion_detail;
SELECT N'oldest' AS k, CONVERT(nvarchar(19), MIN(wgsj), 120) AS v
  FROM dbo.v_wo_completion_detail;

SELECT N'out_of_order_pairs' AS k, CAST(COUNT(*) AS nvarchar(30)) AS v
  FROM (SELECT wgsj,
               LAG(wgsj) OVER (ORDER BY wgsj DESC, id DESC) AS prev
          FROM dbo.v_wo_completion_detail) t
 WHERE t.prev < t.wgsj;

SELECT TOP (5) id,
       CONVERT(nvarchar(19), wgsj, 120) AS wgsj,
       gldh, gxdm
  FROM dbo.v_wo_completion_detail
 ORDER BY wgsj DESC, id DESC;

IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel
                WHERE panel_code = N'WO_COMPLETION_LIST' AND date_col = N'wgsj')
    THROW 51000, N'CHECK FAILED: date_col is not wgsj', 1;

IF EXISTS (SELECT 1 FROM (SELECT wgsj,
                                 LAG(wgsj) OVER (ORDER BY wgsj DESC, id DESC) AS prev
                            FROM dbo.v_wo_completion_detail) t
            WHERE t.prev < t.wgsj)
    THROW 51000, N'CHECK FAILED: completion rows are not newest-first', 1;

SELECT N'RESULT' AS k, N'PASS' AS v;
