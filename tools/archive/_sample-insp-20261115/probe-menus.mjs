import { menuTree } from '../../../frontend/src/business/menus.js'
const qc = menuTree.find((n) => n.code === 'qc')
const g = (qc.children || []).find((c) => c.code === 'qcSample')
console.log(JSON.stringify({ groups: (qc.children || []).map((c) => c.code), sampleGroup: g }, null, 1))
