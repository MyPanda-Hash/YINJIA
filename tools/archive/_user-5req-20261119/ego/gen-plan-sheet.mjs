import { schedPlanSheetHtml } from '../../frontend/src/business/print-formats.js'
import { writeFile } from 'node:fs/promises'

const rows = [{
  客户等级: '甲', 客户: '张莉', 加工单号: 'GD-2026-10-0228', 工单行号: 3, 公司代码: '0',
  物料编码: '5011', 规格型号: "34*16*180", 生产线: '3号车间', 订单数量: 50, 需求数量: 50,
  当前工序计划量: 50, 当前工序完工量: 0, 排产数量: 50,
  交期: '2026-10-21', 交期紧迫度: -29, '7天已排': 50, '15天已排': 0, '大于15天已排': 0,
  日计划: { '2026-11-19': 50 },
}]
const html = await schedPlanSheetHtml(rows, ['2026-11-19'], { today: '2026-11-19', shop: '成型' })
await writeFile('D:/workspace/yinjia/_scratch/ego-plan-board-20261119/plan-sheet.html', html)
console.log('written', html.length)
