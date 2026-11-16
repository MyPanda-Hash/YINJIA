SET NOCOUNT ON;
SELECT 'S|' + doc_no + '|pending=' + ISNULL(pending,'-') + '|shr=' + ISNULL(shr,'-') + '|saved=' + ISNULL(saved,'-') + '|archived=' + ISNULL(archived,'-') + '|canceled=' + ISNULL(canceled,'-') + '|modify_state=' + ISNULL(modify_state,'-')
FROM yj_doc_status WHERE doc_no IN ('OO-2026-11-0005','OO-2026-11-0006','TL-2026-11-0007','TL-2026-11-0008');
SELECT 'CNT|' + CAST(COUNT(*) AS VARCHAR(10)) FROM yj_doc_status WHERE doc_no IN ('OO-2026-11-0005','OO-2026-11-0006','TL-2026-11-0007','TL-2026-11-0008');
