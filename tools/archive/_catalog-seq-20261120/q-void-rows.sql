SET NOCOUNT ON;
SELECT 'CANCELVAL [' + ISNULL(asp_cancel,'NULL') + '] x' + CAST(COUNT(*) AS varchar(10)) FROM qc_sample_reg GROUP BY asp_cancel;
SELECT 'VOID: id=' + CAST(id AS varchar(10)) + ' seq=' + ISNULL(CAST(序号 AS varchar(10)),'null') + ' elem=' + ISNULL(检测元素,'') + ' fee=' + ISNULL(CAST(收费 AS varchar(20)),'') + ' cancel=' + ISNULL(asp_cancel,'NULL') + ' u2=' + ISNULL(asp_user2,'') + ' t2=' + ISNULL(CONVERT(varchar(30),asp_time2,120),'')
FROM qc_sample_reg WHERE ISNULL(asp_cancel,'N')='Y';
