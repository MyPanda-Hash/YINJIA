"""读取送检信息汇总表导出文件,核对表头/数据行/下拉数据验证/列宽/冻结。"""
import sys
import json
from openpyxl import load_workbook

path = sys.argv[1]
wb = load_workbook(path)
ws = wb[wb.sheetnames[0]]
rows = list(ws.iter_rows(values_only=True))
out = {
    "sheets": wb.sheetnames,
    "dims": ws.dimensions,
    "header": [str(v) if v is not None else "" for v in rows[0]],
    "dataRows": len(rows) - 1,
    "firstDataRow": [str(v) if v is not None else "" for v in rows[1]] if len(rows) > 1 else [],
    "validations": [
        {
            "sqref": str(dv.sqref),
            "type": dv.type,
            "formula1": str(dv.formula1),
            "allowBlank": dv.allow_blank,
            "showDropDown": dv.showDropDown,   # True = 隐藏箭头(OOXML 语义)
            "prompt": str(dv.prompt),
            "promptTitle": str(dv.promptTitle),
        }
        for dv in ws.data_validations.dataValidation
    ],
    "freeze": str(ws.freeze_panes),
    "autoFilter": str(ws.auto_filter.ref) if ws.auto_filter else None,
    "colWidths": {k: round(v.width, 1) for k, v in list(ws.column_dimensions.items())[:10]},
    "headFill": str(ws["A1"].fill.fgColor.rgb) if ws["A1"].fill and ws["A1"].fill.fgColor else None,
    "headBold": ws["A1"].font.bold,
}
print(json.dumps(out, ensure_ascii=False, indent=2))
