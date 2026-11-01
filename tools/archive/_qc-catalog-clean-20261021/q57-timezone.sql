SET NOCOUNT ON;
SELECT GETDATE() db_now, SYSDATETIMEOFFSET() db_offset,
       CONVERT(varchar(19), SYSDATETIMEOFFSET() AT TIME ZONE 'China Standard Time', 120) cn_now;
