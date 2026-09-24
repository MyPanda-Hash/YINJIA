# 合并 tools/db-migrations.txt 冲突:保本地全量 + 仅追加远端生产域新增条目(字节级手术,避免整文件重写/EOL 漂移)
# 用法: pwsh -File tools\archive\_resolve-migrations-conflict.ps1
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$path = Join-Path $root 'tools\db-migrations.txt'
$b = [System.IO.File]::ReadAllBytes($path)

function Find-Bytes([byte[]]$hay, [byte[]]$needle, [int]$from) {
    for ($i = $from; $i -le $hay.Length - $needle.Length; $i++) {
        $ok = $true
        for ($j = 0; $j -lt $needle.Length; $j++) { if ($hay[$i + $j] -ne $needle[$j]) { $ok = $false; break } }
        if ($ok) { return $i }
    }
    return -1
}
$ascii = [System.Text.Encoding]::ASCII
$mOurs = $ascii.GetBytes('<<<<<<< HEAD')
$mSep = $ascii.GetBytes('=======')
$mTheirs = $ascii.GetBytes('>>>>>>>')
$anchor = $ascii.GetBytes('migrate-material-inspection-field.sql')

$iOurs = Find-Bytes $b $mOurs 0
$iSep = Find-Bytes $b $mSep ($iOurs + $mOurs.Length)
$iTheirs = Find-Bytes $b $mTheirs ($iSep + $mSep.Length)
if ($iOurs -lt 0 -or $iSep -lt 0 -or $iTheirs -lt 0) { throw "冲突标记定位失败: $iOurs/$iSep/$iTheirs" }

# ours 段:标记行之后到 ======= 行之前(去掉标记行自身的 EOL 与 ======= 前的 EOL)
$oursStart = $iOurs + $mOurs.Length
while ($oursStart -lt $b.Length -and ($b[$oursStart] -eq 13 -or $b[$oursStart] -eq 10)) { $oursStart++ }
$oursEnd = $iSep
while ($oursEnd -gt $oursStart -and ($b[$oursEnd - 1] -eq 13 -or $b[$oursEnd - 1] -eq 10)) { $oursEnd-- }
$ours = $b[$oursStart..($oursEnd - 1)]

# theirs 段:======= 之后到 >>>>>>> 之前;再从中取「最后一个 migrate-material-inspection-field.sql 行之后」= 远端新增
$theirsStart = $iSep + $mSep.Length
while ($theirsStart -lt $b.Length -and ($b[$theirsStart] -eq 13 -or $b[$theirsStart] -eq 10)) { $theirsStart++ }
$theirsEnd = $iTheirs
while ($theirsEnd -gt $theirsStart -and ($b[$theirsEnd - 1] -eq 13 -or $b[$theirsEnd - 1] -eq 10)) { $theirsEnd-- }
$theirs = $b[$theirsStart..($theirsEnd - 1)]
$iAnchor = -1
$pos = 0
while ($true) { $f = Find-Bytes $theirs $anchor $pos; if ($f -lt 0) { break }; $iAnchor = $f; $pos = $f + 1 }
if ($iAnchor -lt 0) { throw '远端段未找到 migrate-material-inspection-field.sql 锚点' }
$addStart = $iAnchor + $anchor.Length
# 跳过该行余下内容到行尾(到下一个换行后)
while ($addStart -lt $theirs.Length -and $theirs[$addStart] -ne 10) { $addStart++ }
$addStart++
$additions = $theirs[$addStart..($theirs.Length - 1)]

# tail:>>>>>>> 行之后
$tailStart = $iTheirs + $mTheirs.Length
while ($tailStart -lt $b.Length -and $b[$tailStart] -ne 10) { $tailStart++ }
$tailStart++
$tail = if ($tailStart -lt $b.Length) { $b[$tailStart..($b.Length - 1)] } else { @() }

$nl = [byte[]]@(13, 10)
$out = New-Object System.Collections.Generic.List[byte]
$out.AddRange([byte[]]$b[0..($iOurs - 1)])
$out.AddRange([byte[]]$ours)
$out.AddRange($nl)
$out.AddRange([byte[]]$additions)
if ($tail.Length -gt 0) { $out.AddRange([byte[]]$tail) }
[System.IO.File]::WriteAllBytes($path, $out.ToArray())
Write-Host "冲突已按「本地全量 + 远端生产域追加」解析: ours=$($ours.Length)B additions=$($additions.Length)B tail=$($tail.Length)B total=$($out.Count)B"
