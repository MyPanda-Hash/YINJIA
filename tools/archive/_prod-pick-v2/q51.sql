SET NOCOUNT ON;
SELECT label, col_name, place, visible, hidden FROM yj_field WHERE panel_code='OTHER_IN' AND (label LIKE '%退料%' OR col_name LIKE '%退料%');
GO
SELECT 'yj_field 是否有退料标志' k;
GO
SELECT COUNT(*) 已有字段数 FROM yj_field WHERE panel_code='OTHER_IN';
