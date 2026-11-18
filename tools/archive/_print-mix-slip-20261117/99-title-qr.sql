SET NOCOUNT ON;
SELECT id, title, slip_no,
       JSON_VALUE(payload_json, '$."二维码内容"') AS 二维码内容,
       JSON_VALUE(payload_json, '$."领料标记"') AS 领料标记,
       JSON_VALUE(payload_json, '$."领料类型"') AS 领料类型,
       state, done_at
FROM yj_print_task WHERE id >= 9 ORDER BY id;
