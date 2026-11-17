SET NOCOUNT ON;
SELECT COUNT(*) AS 打印任务总数, MAX(id) AS 最大id FROM yj_print_task;
