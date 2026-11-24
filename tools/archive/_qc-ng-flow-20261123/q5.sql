SET NOCOUNT ON;
SELECT d.[单据编号], d.[检验项目], d.[检验方法], d.[结果判断], ISNULL(h.[总结论],N'(空)') AS head_verdict,
       ISNULL(h.asp_cancel,'N') AS head_cancel, ISNULL(d.asp_cancel,'N') AS line_cancel
  FROM dbo.qc_asm_insp_detail d
  LEFT JOIN dbo.qc_asm_insp_head h ON h.[单据编号] = d.[单据编号]
 WHERE ISNULL(d.[结果判断],N'')=N'不合格' AND ISNULL(d.asp_cancel,'N')<>'Y';
