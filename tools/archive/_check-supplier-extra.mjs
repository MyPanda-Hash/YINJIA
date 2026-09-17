// 一次性排查:BD_SUPPLIER 的 EXTRA 字段清单 vs yj_field GFDA 现状差集
import { EXTRA } from './kingdee-extra-fields.mjs';
const list = EXTRA['BD_SUPPLIER'] || [];
console.log('EXTRA 字段数:', list.length);
console.log(list.map(f => f.c).join(', '));
// sync-core 基础映射(sync 手工维护,这里硬数)
const base = ['dm','mc','gysfl','供应商分类编码','addr','tel','联系人','ywman','sui_no','bank','bank_no','bz',
  '供应商联系人手机','供应商联系人座机','供应商联系人邮箱','供应商联系人地址','增值税税率','开票名称','开户地址','采购员部门','自动抵扣预收款','__cancel'];
console.log('基础 mapArchive 键数:', base.length);
const total = new Set([...base.filter(c => c !== '__cancel'), ...list.map(f => f.c)]);
console.log('基础+EXTRA 去重后应注册字段数:', total.size);
// 库中现状
const lib = ['gysfl','供应商分类编码','增值税税率','开票名称','开户地址','采购员部门','自动抵扣预收款','联系人','供应商联系人手机','供应商联系人座机','供应商联系人邮箱','供应商联系人地址','group_id','生日','QQ','国家-id','国家-名称','国家-编码','省-id','省-名称','省-编码','市-id','市-名称','市-编码','区-id','区-名称','区-编码','性别1-男2-女','微信','是否首要联系人','联系人序号','分类编码','税率'];
const libSet = new Set(lib);
const miss = [...total].filter(c => !libSet.has(c));
console.log('\n【应注册但库里缺】', miss.length, '个:', miss.join(', '));
