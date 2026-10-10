/**
 * 回写(2026-10-15):把重截的图**替换进两个 docx** 的 word/media/ 内。
 *
 * 原理:docx 就是 zip。图片在 word/media/imageN.png,由 word/_rels/document.xml.rels 把
 *   rId → media 文件名 关联,**文档正文只引用 rId** ⇒ 只要保持**文件名不变、内容换掉**,
 *   正文排版、图注、顺序一律不用动(比重新生成 docx 安全得多)。
 *
 * 映射(实测解析了 rels 得出的固定事实):
 *   MES:MES管理系统-界面截图.docx  rId5..rId22 → image1..image18(与文档 18 张一一对应)
 *   WMS:WMS管理系统-界面截图.docx  rId901..rId908 → wms1..wms8
 *
 * 注意:旧图实际是 PNG 字节(即便有些内嵌为 image/jpeg 签名),扩展名一律 media/*.png;
 *   这里**按原文件名 + 原扩展名**写入 PNG 字节,Word 按内容嗅探,不受扩展名影响(实测旧件亦如此)。
 *   若原 media 项是 jpeg 扩展名,则写 jpeg 字节 —— 由脚本按原扩展名选择编码。
 *
 * 用法: node tools/archive/_writeback-shots-1015.mjs           # 干跑(只校验,不写)
 *       node tools/archive/_writeback-shots-1015.mjs --apply   # 实际写入(会先备份 .bak)
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const APPLY = process.argv.includes('--apply')
const MES_DOC = 'MES管理系统-界面截图.docx'
const WMS_DOC = 'WMS管理系统-界面截图.docx'
const MES_DIR = 'tools/archive/_shots-mes-1015'
const WMS_DIR = 'tools/archive/_shots-wms-1015'

// —— 已解析确认的 rId → media 映射(与文档图片顺序一一对应)——
const MES_MAP = [
  '01-组织架构.png', '02-使用权限查看.png', '03-数据字典.png', '04-工艺路线.png', '05-商品档案.png',
  '06-生产工单.png', '07-快速排产.png', '08-快速排产-2.png', '09-工单排产.png', '10-报工记录.png',
  '11-生产异常处理单.png', '12-来料检验单.png', '13-来料检验单-2.png', '14-检验数据记录.png',
  '15-检验数据记录-2.png', '16-我的桌面.png', '17-我的桌面-生产管理.png', '18-我的桌面-研发管理.png',
]
const WMS_MAP = [
  'wms1-材料仓库条码管理-采购入库单.png', 'wms2-材料仓库条码管理-商品.png',
  'wms3-半成品仓库条码管理-库存状况表.png', 'wms4-成品仓库条码管理-产成品入库单.png',
  'wms5-成品仓库条码管理-销售出库单.png', 'wms6-库内管理-库存状况表.png',
  'wms7-库内管理-库存台账.png', 'wms8-ERP系统集成模块-ERP导入日志.png',
]

const work = join(process.env.TEMP || '/tmp', 'docx-writeback')
execFileSync('powershell', ['-NoProfile', '-Command', `Remove-Item -Recurse -Force '${work}' -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path '${work}' -Force | Out-Null`])

function run(cmd) { return execFileSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8' }) }

/** 把一个 docx 解开 → 替换 media → 重新打包 */
function processDoc(doc, dir, files, label) {
  console.log(`\n=== ${label} : ${doc} ===`)
  if (!existsSync(doc)) { console.log('  [SKIP] 文档不存在'); return false }
  if (!existsSync(dir)) { console.log('  [SKIP] 截图目录不存在'); return false }

  const ex = join(work, label)
  run(`Copy-Item '${doc}' '${join(work, label + '.zip')}' -Force; Expand-Archive '${join(work, label + '.zip')}' -DestinationPath '${ex}' -Force`)

  const mediaDir = join(ex, 'word', 'media')
  if (!existsSync(mediaDir)) { console.log('  [FAIL] 无 word/media'); return false }

  // 按文件名数字序取原 media(它们是 image1..image18 / wms1..wms8)
  const mediaFiles = readdirSync(mediaDir).sort((a, b) => {
    const na = parseInt(a.replace(/\D+/g, ''), 10) || 0
    const nb = parseInt(b.replace(/\D+/g, ''), 10) || 0
    return na - nb
  })
  console.log(`  media 共 ${mediaFiles.length} 个;待替换 ${files.length} 张`)
  if (mediaFiles.length !== files.length) {
    console.log(`  [WARN] 数量不一致(media=${mediaFiles.length} vs 新图=${files.length})—— 仍按序替换前 min 个`)
  }

  let n = 0
  for (let i = 0; i < Math.min(mediaFiles.length, files.length); i++) {
    const target = join(mediaDir, mediaFiles[i])
    const src = join(dir, files[i])
    if (!existsSync(src)) { console.log(`  [FAIL] 缺新图 ${files[i]}`); continue }
    const bytes = readFileSync(src)
    if (APPLY) writeFileSync(target, bytes)
    console.log(`  ${mediaFiles[i]}  <-  ${files[i]}  (${Math.round(bytes.length / 1024)}KB)`)
    n++
  }

  if (APPLY) {
    // 备份原件后覆盖
    copyFileSync(doc, doc + '.bak-1015')
    run(`Compress-Archive -Path '${join(ex, '*')}' -DestinationPath '${join(work, label + '-out.zip')}' -Force`)
    copyFileSync(join(work, label + '-out.zip'), doc)
    console.log(`  [OK] 已写入(原件备份为 ${doc}.bak-1015)`)
  } else {
    console.log('  (干跑:未写盘)')
  }
  return true
}

processDoc(MES_DOC, MES_DIR, MES_MAP, 'MES')
processDoc(WMS_DOC, WMS_DIR, WMS_MAP, 'WMS')

console.log(APPLY ? '\n完成(已写入)' : '\n干跑结束;加 --apply 才实际写入')
process.exit(0)
