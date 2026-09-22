# 一次性:补比例提示新键 A(锚点=刚替换好的页脚提示键行,插在其后)
$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\..\..\frontend\src\i18n\locales"
$map = @{
  'en.js'    = '(0 = none; max 50%, allowance based on ordered qty)'
  'ja.js'    = '(0=不許可、最高50%、上限は注文数量ベース)'
  'ko.js'    = '(0 = 허용 안 함; 최대 50%, 한도는 주문수량 기준)'
  'zh-TW.js' = '(0 = 不允許;最高 50%,額度按訂單數量算)'
  'es.js'    = '(0 = no permitido; máx. 50 %, cupo según cantidad pedida)'
  'fr.js'    = '(0 = interdit ; max 50 %, quota basé sur la quantité commandée)'
  'de.js'    = '(0 = nicht erlaubt; max. 50 %, Spielraum nach Bestellmenge)'
  'ru.js'    = '(0 = запрещено; макс. 50 %, лимит от заказанного количества)'
  'vi.js'    = '(0 = không cho phép; tối đa 50%, hạn mức theo số lượng đặt)'
  'th.js'    = '(0 = ไม่อนุญาต สูงสุด 50% โควตาคิดจากจำนวนที่สั่ง)'
}
foreach ($f in $map.Keys) {
  $p = (Resolve-Path $f).Path
  $t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
  if ($t.Contains([char]0x989D + [string][char]0x5EA6)) { Write-Host " : skip"; continue }
  $anchor = [regex]::Match($t, "(?m)^(\s*)'只生成已勾选的行；可送上限 = 订单数量 ×（1 \+ 超送比例）− 已送 \+ 已退回（超送最高 50%）'.*$")
  if (-not $anchor.Success) { Write-Host "$f : 锚点未找到!"; continue }
  $indent = $anchor.Groups[1].Value
  $newline = "`n"
  if ($t -match "`r`n") { $newline = "`r`n" }
  $ins = $anchor.Value + $newline + $indent + "'（0 = 不允许；最高 50%，额度按订单数量算）': '" + $map[$f] + "',"
  $t2 = $t.Substring(0, $anchor.Index) + $ins + $t.Substring($anchor.Index + $anchor.Length)
  [System.IO.File]::WriteAllText($p, $t2, (New-Object System.Text.UTF8Encoding($false)))
  $cA = ([regex]::Matches($t2, '额度按订单数量算')).Count
  $cR = ([regex]::Matches($t2, "'超送比例'")).Count
  Write-Host "$f : 键A=$cA 超送比例键=$cR"
}
