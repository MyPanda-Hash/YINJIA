/**
 * add-i18n.mjs — 把「生产退料」两个页面(列表页 + 明细页)的文案译名补进 en.js / ja.js。
 *
 * 为什么单独一个脚本:本批 32 条(en)/ 35 条(ja)词条,手工往 6000 行词典里插容易插错位置、
 * 也容易漏;脚本按「插在最后一个已有词条之后、biz 块的收尾 `  },` 之前」定位,幂等可重跑
 * (已存在的键跳过)。用法(仓库根):node tools/archive/_return-doc-20261118/add-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const EN = [
  ['不可退', 'Not returnable'],
  ['可退料', 'Returnable'],
  ['退料单据', 'Return document'],
  ['本次退料', 'This return'],
  ['本次退', 'This return'],
  ['可退合计', 'Returnable total'],
  ['可退项数', 'Returnable items'],
  ['已退', 'Returned'],
  ['这次可退', 'Returnable now'],
  ['领料类型', 'Picking type'],
  ['领料单号 / 工单号 / 产品名称', 'Picking no. / work order / product name'],
  ['查询单据 → 进单据明细 → 扫物料码退料 → 提交', 'Find note → open detail → scan material → submit'],
  ['只列已领料且材料出库单已审核的单据,点一行进单据明细里扫物料码退料', 'Only fully picked documents whose material issue note is approved are listed; tap a line to scan materials in the document detail'],
  ['没有可退的领料单（需要先领料、且材料出库单被仓管审核）', 'No returnable picking note (pick first, and the material issue note must be approved by the warehouse keeper)'],
  ['查询可退单据失败', 'Failed to load returnable documents'],
  ['查询可退数量失败', 'Failed to check the returnable quantity'],
  ['没有找到这个工单/单据', 'Work order / document not found'],
  ['没有找到这张领料单', 'Picking note not found'],
  ['这张单据已作废,不能再打开', 'This document is void and cannot be opened'],
  ['没有识别到二维码,请重试;也可以直接用扫码枪扫进下面的输入框', 'No code recognised, please retry; you can also scan into the input box with a scanner'],
  ['没有指定单据:请从「生产退料」列表点进来', 'No document specified: open it from the "Production Return" list'],
  ['这张领料单还没完成:请先把料领完并提交,提交之后才能对已领的料退料', 'This picking note is not completed yet: finish picking and submit first, then you can return picked materials'],
  ['材料出库单还没审批,暂时不能退料:请先让仓管在「材料出库单」里审核通过(审核才扣库存)', 'The material issue note is not approved yet, so returning is not possible: ask the warehouse keeper to approve it under "Material Issue Note" (stock is deducted on approval)'],
  ['这张单的料已经全部退完了,没有可退的物料', 'All materials on this document have been returned; nothing left to return'],
  ['扫物料码解锁:只有这张领料单里的物料才能退;数量默认填可退数量,可改', 'Scan a material code to unlock it: only materials on this picking note can be returned; the quantity defaults to the returnable amount and can be edited'],
  ['确认后重新锁回扫码状态,再扫下一个物料;没打算退的料不用扫', 'After confirming, the field locks again for the next material; skip materials you are not returning'],
  ['超过可退数量', 'Exceeds the returnable quantity'],
  ['退料数量必须大于 0', 'Return quantity must be greater than 0'],
  ['已清空本次退料', 'This return has been cleared'],
  ['清空本次', 'Clear'],
  ['提交后生成一张生产退料单并入库,库存会增加。确定提交?', 'Submitting creates a production return note and stocks it in, which increases inventory. Submit now?'],
  ['这张单还没有退料单号', 'This document has no return note number yet'],
]

const JA = [
  ['不可退', '返却不可'],
  ['可退料', '返却可能'],
  ['可退单据', '返却可能な伝票'],
  ['退料单据', '返却伝票'],
  ['本次退料', '今回の返却'],
  ['本次退', '今回返却'],
  ['可退合计', '返却可能合計'],
  ['可退项数', '返却可能品目数'],
  ['已退', '返却済'],
  ['这次可退', '今回返却可能'],
  ['领料类型', '出庫種別'],
  ['领料单号 / 工单号 / 产品名称', '出庫伝票番号 / 指図番号 / 製品名'],
  ['查询单据 → 进单据明细 → 扫物料码退料 → 提交', '伝票検索 → 明細へ → 材料読取 → 返却登録'],
  ['扫领料单码 / 工单号,或输入后点打开', '出庫伝票コード読取 / 指図番号を入力して開く'],
  ['扫领料单纸面二维码 → 直接打开对应那张(混料/组装);扫工单码 → 弹窗选混料还是组装;', '出庫伝票の紙面QRを読取ると該当伝票(混料/組立)を直接開きます。指図コードの場合はダイアログで選択します'],
  ['只列已领料且材料出库单已审核的单据,点一行进单据明细里扫物料码退料', '出庫済みで材料出庫伝票が承認済みの伝票のみ表示。行をタップすると明細で材料コードを読み取って返却できます'],
  ['没有可退的领料单（需要先领料、且材料出库单被仓管审核）', '返却可能な出庫伝票がありません(出庫済みで材料出庫伝票が承認済みである必要があります)'],
  ['查询可退单据失败', '返却可能伝票の取得に失敗しました'],
  ['查询可退数量失败', '返却可能数量の取得に失敗しました'],
  ['没有找到这个工单/单据', '指図/伝票が見つかりません'],
  ['没有找到这张领料单', 'この出庫伝票が見つかりません'],
  ['这张单据已作废,不能再打开', 'この伝票は取消済みのため開けません'],
  ['没有识别到二维码,请重试;也可以直接用扫码枪扫进下面的输入框', 'コードを認識できませんでした。再試行するか、バーコードリーダーで入力欄へ読み取ってください'],
  ['没有指定单据:请从「生产退料」列表点进来', '伝票が指定されていません。「生産返却」一覧から開いてください'],
  ['这张领料单还没完成:请先把料领完并提交,提交之后才能对已领的料退料', 'この出庫伝票は未完了です。出庫を完了して登録した後に返却できます'],
  ['材料出库单还没审批,暂时不能退料:请先让仓管在「材料出库单」里审核通过(审核才扣库存)', '材料出庫伝票が未承認のため返却できません。「材料出庫伝票」で倉庫担当の承認後に可能です(承認で在庫が減ります)'],
  ['这张单的料已经全部退完了,没有可退的物料', 'この伝票の材料はすべて返却済みです'],
  ['扫物料码解锁:只有这张领料单里的物料才能退;数量默认填可退数量,可改', '材料コードを読み取ると入力可:この出庫伝票の材料のみ返却できます。数量は返却可能数の初期値(修正可)'],
  ['确认后重新锁回扫码状态,再扫下一个物料;没打算退的料不用扫', '確認すると再び読み取り待ちに戻ります。次の材料を読み取ってください。返却しない材料は読み取らなくて構いません'],
  ['超过可退数量', '返却可能数量を超えています'],
  ['退料数量必须大于 0', '返却数量は 0 より大きい必要があります'],
  ['已清空本次退料', '今回の返却をクリアしました'],
  ['清空本次', 'クリア'],
  ['提交后生成一张生产退料单并入库,库存会增加。确定提交?', '登録すると生産返却伝票が作成され入庫され、在庫が増えます。登録しますか?'],
  ['这张单还没有退料单号', 'この伝票には返却伝票番号がありません'],
]

/**
 * 在语言包的 biz 块收尾(`  },` 紧跟空行与 `}`)之前插入词条。
 * 幂等:已存在的键跳过;返回补了多少条。
 *
 * ⚠ 值一律用**单引号**包(与词典里绝大多数词条一致),只转义单引号与反斜杠 ——
 *   双引号不转义(单引号串里无需);**绝不能**把 `\"` 写进双引号串里(那里必须有反斜杠)。
 *   2026-11-18 第一版用 JSON.stringify 拼值、又全局把 `\"` 归一会把**别人已有的**双引号串
 *   (如 en.js 的 `"expected \"item code|batch\""`)改成语法错误 —— 已回滚重做。
 */
function quote(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

function insert(file, pairs, marker) {
  let src = readFileSync(file, 'utf8')
  const tail = '\n  },\n\n}\n'
  if (!src.endsWith(tail)) throw new Error(`${file} 结尾不是预期的 biz 收尾,请人工核对`)
  const added = []
  for (const [zh, tr] of pairs) {
    if (src.includes(`    '${zh}':`)) continue
    added.push([zh, tr])
  }
  if (!added.length) return 0
  const block = added.map(([zh, tr]) => `    '${zh}': ${quote(tr)},`).join('\n')
  src = src.slice(0, -tail.length)
    + `\n    // ${marker}\n`
    + block
    + tail
  writeFileSync(file, src, 'utf8')
  return added.length
}

const enAdded = insert('frontend/src/i18n/locales/en.js', EN, '── 生产退料 · 列表页 + 退料单明细页(2026-11-18 第四轮)──')
const jaAdded = insert('frontend/src/i18n/locales/ja.js', JA, '── 生産返却 · 一覧画面 + 返却伝票明細画面(2026-11-18 第4弾)──')
console.log(`en 补 ${enAdded} 条,ja 补 ${jaAdded} 条`)
