SET NOCOUNT ON;
SELECT h.单据编号, ISNULL(h.产品编号,N'') AS 产品编号, ISNULL(h.产品名称,N'') AS 名称,
       (SELECT COUNT(*) FROM rd_mold_proc_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细,
       ISNULL(s.saved,'-') AS saved, ISNULL(s.archived,'-') AS arch, ISNULL(s.pending,'-') AS pend, ISNULL(h.asp_user1,'-') AS 制单
  FROM rd_mold_proc_head h LEFT JOIN yj_doc_status s ON s.panel_code=N'RD_MOLD_PROC' AND s.doc_no=h.单据编号
 ORDER BY h.id;
GO
SELECT panel_code, doc_no, ISNULL(saved,'-') AS saved, ISNULL(archived,'-') AS arch, ISNULL(pending,'-') AS pend FROM yj_doc_status ORDER BY panel_code, doc_no;
GO
