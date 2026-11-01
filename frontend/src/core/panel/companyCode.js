/**
 * companyCode.js — 全系统唯一的「公司代码」常量(2026-10-21 抽出,消灭三处各自写字面量 '0')
 *
 * 取值 = 旧系统 `plang.comm`,全库唯一 `'0'`(2026-09-28 用户口径:物料二维码按旧系统扫码形式带公司代码前缀)。
 * 现役三处二维码都以它为首段,扫码端因此共用同一套「首段=公司代码」的判定:
 *   ① 标识卡(INV / 采购订单 / 采购入库单) = 公司代码@物料编码[@批号](print-formats.productCardQrText);
 *   ② 生产任务单/工单码             = 公司代码@工单号@(1000+工单行号)(print-formats.woQrText);
 *   ③ 材料仓条码管理标签(2026-10-21)= 公司代码@存货编码@批号(barcodeLabel.barcodeQrText)。
 *
 * ⚠ 放 core/panel 而不是 business:core 层禁止 import business(见 docs/development/代码规范与防臃肿.md A1),
 *   而二维码映射 barcodeLabel.js 在 core、条码登记在 business —— 常量只能下沉到 core 供两边共用。
 * ⚠ 别在这里加可变状态:这是"事实常量",不是配置。真要改成多公司,应改成从登录上下文读取,
 *   而不是在此处维护一个可变值。
 */
export const COMPANY_CODE = '0'
