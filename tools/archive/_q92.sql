SET NOCOUNT ON;
SELECT 单据编号, 单据状态, ISNULL(asp_user1,'') AS push_flag, asp_time1, asp_time2 FROM bd_purchase_in;
SELECT 单据编号, 单据状态, ISNULL(asp_user1,'') AS push_flag, asp_time1, asp_time2 FROM bd_sale_out;
