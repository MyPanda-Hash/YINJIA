param([Parameter(Mandatory=$true)][string]$Path)
# PDF 证据解析(字节级,不依赖外部库):
#   /BaseFont 名单(断言含 NotoSansSC)、/FontFile2(TTF 嵌入)>0、/FontFile3(CFF 子集=嵌入失败)=0、页数
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\_pdf-evidence.ps1 -Path <pdf>
$full = (Resolve-Path -LiteralPath $Path).Path
$bytes = [System.IO.File]::ReadAllBytes($full)
$sb = New-Object System.Text.StringBuilder
foreach ($b in $bytes) { [void]$sb.Append([char]$b) }
$txt = $sb.ToString()

$bf = [regex]::Matches($txt, '/BaseFont\s*/([A-Za-z0-9\+\-]+)') | ForEach-Object { $_.Groups[1].Value }
$ff2 = ([regex]::Matches($txt, '/FontFile2')).Count
$ff3 = ([regex]::Matches($txt, '/FontFile3')).Count
$pages = ([regex]::Matches($txt, '/Type\s*/Page[^s]')).Count
$count = [regex]::Match($txt, '/Count\s+(\d+)')
$noto = ([regex]::Matches($txt, 'NotoSansSC')).Count

Write-Output ("FILE      : " + (Split-Path $full -Leaf))
Write-Output ("BYTES     : " + $bytes.Length)
Write-Output ("PAGES     : " + $pages + "   /Count=" + $(if ($count.Success) { $count.Groups[1].Value } else { '-' }))
Write-Output ("FontFile2 : " + $ff2 + "   FontFile3 : " + $ff3)
Write-Output ("BaseFont  : " + (($bf | Group-Object | ForEach-Object { "$($_.Name)x$($_.Count)" }) -join ', '))
Write-Output ("NotoSansSC hits : " + $noto)
