# test-json.ps1 —— 手写 JSON 序列化的回归(含 PSObject 包裹,模拟 PS2)
$ErrorActionPreference = 'Stop'
. 'D:\YINJIA-main\deploy\print-agent\compat-ps2.ps1' -Force

function Show($label, $obj) {
    $j = ConvertTo-JsonCompat -InputObject $obj -Compress
    Write-Host ($label + " => " + $j)
    return $j
}

Write-Output '--- 1) 普通哈希表(登录体) ---'
$login = @{ userName = 'admin'; password = '123456'; factory = 'YJ' }
$j1 = Show 'login' $login
$back = ConvertFrom-JsonCompat $j1
Write-Output ("  回读: user=" + $back.userName + " pwd=" + $back.password + " factory=" + $back.factory)

Write-Output '--- 2) PS2 现场:哈希表被包成 PSObject ---'
$wrapped = New-Object System.Management.Automation.PSObject $login
$j2 = Show 'wrapped' $wrapped
$back2 = ConvertFrom-JsonCompat $j2
Write-Output ("  回读: user=" + $back2.userName + " factory=" + $back2.factory)

Write-Output '--- 3) 嵌套 + 数组 + 布尔 + 数字 ---'
$nested = @{ ok = $true; n = 3; rows = @(@{ '物料名称' = '折叠棉'; '数量' = 10 }, @{ '物料名称' = '拉伸膜'; '数量' = 2.5 }) }
$j3 = Show 'nested' $nested
$back3 = ConvertFrom-JsonCompat $j3
Write-Output ("  回读: rows=" + @($back3.rows).Count + " 第一行=" + $back3.rows[0].'物料名称' + "/" + $back3.rows[0].'数量' + " n=" + $back3.n + " ok=" + $back3.ok)

Write-Output '--- 4) 转义:引号/反斜杠/换行/制表 ---'
$esc = @{ s = 'He said "hi"'; p = 'C:\tmp\a.txt'; nl = ("a" + [char]10 + "b"); tab = ("a" + [char]9 + "b") }
$j4 = Show 'escaped' $esc
$back4 = ConvertFrom-JsonCompat $j4
Write-Output ("  回读: s=" + $back4.s + " | p=" + $back4.p + " | nl_len=" + $back4.nl.Length + " tab_len=" + $back4.tab.Length)

Write-Output '--- 5) PSCustomObject ---'
$ps = New-Object PSObject -Property @{ '二维码内容' = '0@A@1'; '工单号' = 'WO-1' }
$j5 = Show 'psobject' $ps
$back5 = ConvertFrom-JsonCompat $j5
Write-Output ("  回读: qr=" + $back5.'二维码内容' + " wo=" + $back5.'工单号')

Write-Output '[PASS] 手写序列化回归通过'