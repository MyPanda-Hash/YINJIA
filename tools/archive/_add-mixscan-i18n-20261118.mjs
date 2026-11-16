/**
 * _add-mixscan-i18n-20261118.mjs — 扫码混料的新 UI 文案写入 en / ja 语言包(一次性工具)
 *
 * 为什么用脚本而不是手改:语言包是 40 万字符的大文件,手改容易把引号/逗号弄坏;
 * 这里按「行首  biz: {」定位,把新词条整块插进去,已存在的键跳过(幂等,可重复跑)。
 *
 * 用法:node tools/archive/_add-mixscan-i18n-20261118.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ENTRIES = {
  en: [
    ['扫码混料', 'Scan Material Mixing'],
    ['扫工单码 → 带出物料清单 → 逐项扫物料码取电子秤 → 逐笔保存 → 全部扫完整单保存并自动打印',
      'Scan the work order → load the material list → scan each material and read the scale → save entry by entry → save the whole order and print automatically'],
    ['扫描或输入工单二维码', 'Scan or enter the work order QR code'],
    ['相机扫码', 'Scan with camera'],
    ['换工单', 'Change work order'],
    ['工单行', 'Work order line'],
    ['台车电子秤', 'Cart scale'],
    ['手输数量', 'Manual qty'],
    ['读数稳定，可取值', 'Stable — value can be taken'],
    ['等待称重', 'Waiting for weight'],
    ['读数跳动中', 'Reading is fluctuating'],
    ['请先扫描或输入工单二维码', 'Please scan or enter the work order QR code first'],
    ['不是工单码（工单码格式：公司代码@工单号@行号）', 'Not a work order code (format: company@work order@line)'],
    ['工单码里的行号不是数字', 'The line number in the work order code is not numeric'],
    ['条码里没有存货编码', 'The barcode contains no item code'],
    ['条码格式不对（应为 存货编码|批号）', 'Wrong barcode format (should be item code|batch)'],
    ['该物料不在本工单的物料清单里', 'This material is not in the material list of this work order'],
    ['取不到数量：请确认电子秤已连接，或在「手输数量」填一个值',
      'No quantity: check that the scale is connected, or enter a value in "Manual qty"'],
    ['该产品在「物料清单」里还没有维护用料，请先在 数据建模 → 生产 → 物料清单 录入',
      'This product has no material list yet — maintain it in Data modeling → Production → Material list'],
    ['应投', 'Planned'],
    ['已记', 'Recorded'],
    ['待投', 'Remaining'],
    ['撤回本项', 'Undo this item'],
    ['扫描或输入物料码（存货编码|批号）', 'Scan or enter the material code (item code|batch)'],
    ['提交本笔', 'Save this entry'],
    ['取秤提交', 'Take scale & save'],
    ['项未扫', 'item(s) not scanned'],
    ['可以整单保存', 'Ready to save the whole order'],
    ['整单保存并打印', 'Save order & print'],
    ['该工单已保存的混料单', 'Saved mixing sheets of this work order'],
    ['还没有保存过混料单', 'No mixing sheet has been saved yet'],
    ['实际用量合计', 'Total actual qty'],
    ['没找到这张工单', 'Work order not found'],
    ['已恢复本工单未保存的记录', 'Restored unsaved records of this work order'],
    ['本笔保存失败', 'Failed to save this entry'],
    ['提交本笔失败', 'Failed to submit this entry'],
    ['已撤回', 'Undone'],
    ['项未扫，确定整单保存吗？', 'item(s) not scanned. Save the whole order anyway?'],
    ['整单保存', 'Save whole order'],
    ['确定保存', 'Save'],
    ['返回继续扫', 'Keep scanning'],
    ['保存后没有拿到混料单号', 'No mixing sheet number returned after saving'],
    ['整单保存成功', 'Order saved'],
    ['整单保存失败', 'Failed to save the order'],
    ['查询混料单失败', 'Failed to query mixing sheets'],
    ['未授予相机权限，请在系统设置里开启后重试',
      'Camera permission not granted — enable it in system settings and retry'],
    ['当前环境不支持相机扫码', 'Camera scanning is not supported in this environment'],
    ['没有扫到内容', 'Nothing was scanned'],
    ['扫码失败：', 'Scan failed: '],
    ['混料单', 'Mixing Sheet'],
    ['扫码混料（移动端）', 'Material mixing (mobile)'],
  ],
  ja: [
    ['扫码混料', 'スキャン混練'],
    ['扫工单码 → 带出物料清单 → 逐项扫物料码取电子秤 → 逐笔保存 → 全部扫完整单保存并自动打印',
      '指示書をスキャン → 部品表を取得 → 材料ごとにスキャンして秤の値を取得 → 1件ずつ保存 → 全て完了したら伝票ごと保存して自動印刷'],
    ['扫描或输入工单二维码', '作業指示書QRをスキャンまたは入力'],
    ['相机扫码', 'カメラでスキャン'],
    ['换工单', '指示書を変更'],
    ['工单行', '指示書行'],
    ['台车电子秤', '台車はかり'],
    ['手输数量', '数量を手入力'],
    ['读数稳定，可取值', '安定しています（取得可）'],
    ['等待称重', '計量待ち'],
    ['读数跳动中', '数値が変動中'],
    ['请先扫描或输入工单二维码', '先に作業指示書QRをスキャンまたは入力してください'],
    ['不是工单码（工单码格式：公司代码@工单号@行号）', '作業指示書コードではありません（形式：会社コード@指示書番号@行番号）'],
    ['工单码里的行号不是数字', '指示書コードの行番号が数値ではありません'],
    ['条码里没有存货编码', 'バーコードに品目コードがありません'],
    ['条码格式不对（应为 存货编码|批号）', 'バーコード形式が違います（品目コード|ロット）'],
    ['该物料不在本工单的物料清单里', 'この材料はこの指示書の部品表にありません'],
    ['取不到数量：请确认电子秤已连接，或在「手输数量」填一个值',
      '数量を取得できません：はかりの接続を確認するか「数量を手入力」に入力してください'],
    ['该产品在「物料清单」里还没有维护用料，请先在 数据建模 → 生产 → 物料清单 录入',
      'この製品の部品表が未登録です。データモデリング → 生産 → 部品表 で登録してください'],
    ['应投', '投入予定'],
    ['已记', '記録済'],
    ['待投', '未投入'],
    ['撤回本项', 'この項目を取り消す'],
    ['扫描或输入物料码（存货编码|批号）', '材料コードをスキャンまたは入力（品目コード|ロット）'],
    ['提交本笔', 'この明細を保存'],
    ['取秤提交', '秤の値を取得して保存'],
    ['项未扫', '件未スキャン'],
    ['可以整单保存', '伝票ごと保存できます'],
    ['整单保存并打印', '伝票保存して印刷'],
    ['该工单已保存的混料单', 'この指示書の保存済み混練伝票'],
    ['还没有保存过混料单', '保存済みの混練伝票はありません'],
    ['实际用量合计', '実使用量合計'],
    ['没找到这张工单', 'この指示書が見つかりません'],
    ['已恢复本工单未保存的记录', 'この指示書の未保存記録を復元しました'],
    ['本笔保存失败', 'この明細の保存に失敗しました'],
    ['提交本笔失败', 'この明細の保存に失敗しました'],
    ['已撤回', '取り消しました'],
    ['项未扫，确定整单保存吗？', '件未スキャンです。伝票ごと保存しますか？'],
    ['整单保存', '伝票ごと保存'],
    ['确定保存', '保存する'],
    ['返回继续扫', 'スキャンに戻る'],
    ['保存后没有拿到混料单号', '保存後に混練伝票番号を取得できませんでした'],
    ['整单保存成功', '伝票を保存しました'],
    ['整单保存失败', '伝票の保存に失敗しました'],
    ['查询混料单失败', '混練伝票の照会に失敗しました'],
    ['未授予相机权限，请在系统设置里开启后重试', 'カメラ権限がありません。システム設定で許可して再試行してください'],
    ['当前环境不支持相机扫码', 'この環境ではカメラスキャンに対応していません'],
    ['没有扫到内容', 'スキャン内容がありません'],
    ['扫码失败：', 'スキャン失敗：'],
    ['混料单', '混練伝票'],
    ['扫码混料（移动端）', '材料混練（モバイル）'],
  ],
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

for (const [locale, pairs] of Object.entries(ENTRIES)) {
  const file = new URL(`../../frontend/src/i18n/locales/${locale}.js`, import.meta.url)
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const at = lines.findIndex((l) => /^\s{2}biz:\s*\{/.test(l))
  if (at < 0) throw new Error(`没找到 ${locale}.js 的 biz 块`)
  const missing = pairs.filter(([zh]) => !new RegExp(`^\\s*'${esc(zh).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':`, 'm').test(src))
  if (!missing.length) {
    console.log(`${locale}: 无需新增(全部已存在)`)
    continue
  }
  const block = [
    '    // ---- 2026-11-18 手机扫码 · 扫码混料(新面板 MIX_SCAN:逐笔保存 + 整单保存 + 自动打印/补打印)----',
    ...missing.map(([zh, target]) => `    '${esc(zh)}': '${esc(target)}',`),
  ]
  lines.splice(at + 1, 0, ...block)
  writeFileSync(file, lines.join('\n'), 'utf8')
  console.log(`${locale}: 新增 ${missing.length} 条`)
}
