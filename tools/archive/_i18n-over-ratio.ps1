# 一次性:分批送料超送文案词条更新(10 语言)—— 换 2 个键、删 1 个废弃键
# 用法: pwsh -File tools/archive/_i18n-over-ratio.ps1(在仓库根执行)
$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\..\..\frontend\src\i18n\locales"

$map = @{
  'en.js'    = @('(0 = none; max 50%, allowance based on ordered qty)', 'Only checked lines are generated; max deliverable = ordered qty × (1 + over-delivery ratio) − sent + returned (over-delivery capped at 50%)')
  'ja.js'    = @('(0=不許可、最高50%、上限は注文数量ベース)', 'チェックした行のみ生成。納入上限=注文数量×(1+過納比率)−既納入+返品(過納は最高50%)')
  'ko.js'    = @('(0 = 허용 안 함; 최대 50%, 한도는 주문수량 기준)', '체크한 행만 생성합니다. 납품 상한 = 주문수량 ×(1+초과 비율)− 납품 + 반품(초과 최대 50%)')
  'zh-TW.js' = @('(0 = 不允許;最高 50%,額度按訂單數量算)', '只生成已勾選的行;可送上限 = 訂單數量 ×(1 + 超送比例)− 已送 + 已退回(超送最高 50%)')
  'es.js'    = @('(0 = no permitido; máx. 50 %, cupo según cantidad pedida)', 'Solo se generan las líneas marcadas; máximo = cantidad pedida × (1 + ratio) − entregado + devuelto (sobreentrega máx. 50 %)')
  'fr.js'    = @('(0 = interdit ; max 50 %, quota basé sur la quantité commandée)', 'Seules les lignes cochées sont générées ; max = qté commandée × (1 + taux) − livré + retourné (sur-livraison max 50 %)')
  'de.js'    = @('(0 = nicht erlaubt; max. 50 %, Spielraum nach Bestellmenge)', 'Nur angehakte Zeilen werden erzeugt; Maximum = Bestellmenge × (1 + Quote) − geliefert + retourniert (Überlieferung max. 50 %)')
  'ru.js'    = @('(0 = запрещено; макс. 50 %, лимит от заказанного количества)', 'Формируются только отмеченные строки; максимум = заказано × (1 + коэф.) − отгущено + возвраты (макс. 50 %)')
  'vi.js'    = @('(0 = không cho phép; tối đa 50%, hạn mức theo số lượng đặt)', 'Chỉ tạo các dòng đã chọn; mức tối đa = số lượng đặt × (1 + tỷ lệ) − đã giao + đã trả (tối đa 50%)')
  'th.js'    = @('(0 = ไม่อนุญาต สูงสุด 50% โควตาคิดจากจำนวนที่สั่ง)', 'สร้างเฉพาะบรรทัดที่เลือก เพดาน = จำนวนสั่ง × (1 + อัตรา) − ส่งแล้ว + คืนแล้ว (สูงสุด 50%)')
}
foreach ($f in $map.Keys) {
  $p = Resolve-Path $f
  $t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
  $a, $b = $map[$f]
  # ① 换比例提示键(整行替换,保留缩进与行尾)
  $t2 = [regex]::Replace($t, "(?m)^(\s*)'（0 = 不允许超送；本次生效）'.*$", "`${1}'（0 = 不允许；最高 50%，额度按订单数量算）': '$a',")
  # ② 换页脚提示键
  $t3 = [regex]::Replace($t2, "(?m)^(\s*)'只生成已勾选的行\(数量为 0 的行不送\),且不超过「可送上限」'.*$", "`${1}'只生成已勾选的行；可送上限 = 订单数量 ×（1 + 超送比例）− 已送 + 已退回（超送最高 50%）': '$b',")
  # ③ 删废弃键(整行含行尾)
  $t4 = [regex]::Replace($t3, "(?m)^\s*'每行留空或 0 = 本次不送;不超过「可送上限」\(剩余 ×（1\+超送比例）\)'.*\r?\n", '')
  if ($t4 -eq $t) { Write-Host "$f : 无变化(检查键名)" } else {
    [System.IO.File]::WriteAllText($p, $t4, (New-Object System.Text.UTF8Encoding($false)))
    $c1 = ([regex]::Matches($t4, '额度按订单数量算')).Count; $c2 = ([regex]::Matches($t4, '超送最高 50%）')).Count; $c3 = ([regex]::Matches($t4, '每行留空或 0')).Count
    Write-Host "$f : 新A=$c1 新B=$c2 旧残留=$c3"
  }
}
