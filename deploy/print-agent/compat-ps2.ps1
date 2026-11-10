# compat-ps2.ps1 —— Windows 7 自带 PowerShell 2.0 的兼容层(2026-11-10)
#
# 客户那台 Win7 没装 WMF,`powershell.exe` 就是 2.0:没有 ConvertFrom-Json / ConvertTo-Json /
# Invoke-WebRequest(全是 3.0+ 才有)。原来安装脚本直接退出"请先装 WMF 5.1" ——
# 用户口径「要兼容,能够一键完成,不要多余操作」⇒ 这里把缺的三样补上,脚本一行不用改。
#
# 用法:脚本里在 PS<3 时 `. $compat`;PS3+ 不加载(用系统自带命令,避免行为差异)。
# 测试:可 `-Force` 加载不会覆盖系统命令,只是多出 *Compat 函数供直接调用。
param([switch]$Force)

$script:IsPs2 = ($PSVersionTable.PSVersion.Major -lt 3)
if (-not $Force -and -not $script:IsPs2) { return }

try { Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop }
catch {
    Write-Host '[FAIL] 这台电脑缺少 .NET 3.5(System.Web.Extensions),PowerShell 2.0 下无法解析 JSON。' -ForegroundColor Red
    throw
}

$global:YjCompatJsonSer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
try { $global:YjCompatJsonSer.MaxJsonLength = [int]::MaxValue } catch { }
try { $global:YjCompatJsonSer.RecursionLimit = 100 } catch { }

# ── Dictionary/数组 → PSObject(PS2 下 `$obj.data.token` 这种属性访问才好用)──────
function ConvertTo-CompatObject {
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.Collections.IDictionary]) {
        $o = New-Object PSObject
        foreach ($k in @($Value.Keys)) {
            Add-Member -InputObject $o -MemberType NoteProperty -Name ([string]$k) -Value (ConvertTo-CompatObject $Value[$k])
        }
        return $o
    }
    if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
        $arr = @()
        foreach ($i in $Value) { $arr += ,(ConvertTo-CompatObject $i) }
        return ,$arr
    }
    return $Value
}

# ── JSON:pipeline 文本 → PSObject / 对象 → 紧凑 JSON ─────────────────────────
function ConvertFrom-JsonCompat {
    param([Parameter(ValueFromPipeline = $true, Mandatory = $true)]$InputObject)
    process {
        $text = [string]$InputObject
        if (-not $text -or $text.Trim() -eq '') { return $null }
        return (ConvertTo-CompatObject $global:YjCompatJsonSer.DeserializeObject($text))
    }
}

function ConvertTo-CompatHashtable {
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.Collections.IDictionary]) {
        $h = @{}
        foreach ($k in @($Value.Keys)) { $h[[string]$k] = ConvertTo-CompatHashtable $Value[$k] }
        return $h
    }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        $h = @{}
        foreach ($p in $Value.PSObject.Properties) { $h[$p.Name] = ConvertTo-CompatHashtable $p.Value }
        return $h
    }
    if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
        $arr = @()
        foreach ($i in $Value) { $arr += ,(ConvertTo-CompatHashtable $i) }
        return ,$arr
    }
    return $Value
}

# ── 手写 JSON 序列化(2026-11-10 第二轮)──────────────────────────────────────
# 现场 PS2 报:`Serialize` 时 `System.Management.Automation.PSParameterizedProperty` 循环引用 ——
# PS2 会把 `@{...}` 包成 PSObject,JavaScriptSerializer 顺着适配属性(Keys/Values/…)
# 一路追下去就炸。与其跟序列化器较劲,不如自己拼 JSON(类型/转义都自己控,PS2/PS5 行为一致)。
function ConvertTo-JsonEscaped {
    param([string]$Text)
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    foreach ($ch in $Text.ToCharArray()) {
        $code = [int]$ch
        if ($code -eq 34) { [void]$sb.Append('\"') }          # "
        elseif ($code -eq 92) { [void]$sb.Append('\\') }      # \
        elseif ($code -eq 8) { [void]$sb.Append('\b') }
        elseif ($code -eq 12) { [void]$sb.Append('\f') }
        elseif ($code -eq 10) { [void]$sb.Append('\n') }
        elseif ($code -eq 13) { [void]$sb.Append('\r') }
        elseif ($code -eq 9) { [void]$sb.Append('\t') }
        elseif ($code -lt 32) { [void]$sb.Append(('\u{0:x4}' -f $code)) }
        else { [void]$sb.Append($ch) }
    }
    [void]$sb.Append('"')
    return $sb.ToString()
}

function ConvertTo-JsonLiteral {
    param($Value, [int]$Level = 0)
    # PS2 的哈希表/数组常被包成 PSObject:只把「底层是集合/值类型」的壳剥掉;
    # 真正的 PSCustomObject(NoteProperty 挂在 PSObject 上)不能剥,否则属性全丢。
    if (($null -ne $Value) -and ($Value -is [System.Management.Automation.PSObject])) {
        $base = $Value.PSObject.BaseObject
        if (($base -is [System.Collections.IDictionary]) -or
            (($base -is [System.Collections.IEnumerable]) -and -not ($base -is [string])) -or
            ($base -is [ValueType]) -or ($base -is [string])) {
            $Value = $base
        }
    }
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [bool]) { if ($Value) { return 'true' } return 'false' }
    if ($Value -is [string]) { return (ConvertTo-JsonEscaped $Value) }
    if ($Value -is [char]) { return (ConvertTo-JsonEscaped ([string]$Value)) }
    if (($Value -is [ValueType]) -and -not ($Value -is [System.Management.Automation.PSObject])) {
        return ([System.Convert]::ToString($Value, [System.Globalization.CultureInfo]::InvariantCulture))
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $parts = @()
        foreach ($k in @($Value.Keys)) {
            $parts += ((ConvertTo-JsonEscaped ([string]$k)) + ':' + (ConvertTo-JsonLiteral $Value[$k] ($Level + 1)))
        }
        return ('{' + ($parts -join ',') + '}')
    }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        $parts = @()
        foreach ($p in $Value.PSObject.Properties) {
            $parts += ((ConvertTo-JsonEscaped $p.Name) + ':' + (ConvertTo-JsonLiteral $p.Value ($Level + 1)))
        }
        return ('{' + ($parts -join ',') + '}')
    }
    if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
        $parts = @()
        foreach ($i in $Value) { $parts += (ConvertTo-JsonLiteral $i ($Level + 1)) }
        return ('[' + ($parts -join ',') + ']')
    }
    return (ConvertTo-JsonEscaped ([string]$Value))
}

function ConvertTo-JsonCompat {
    param(
        [Parameter(ValueFromPipeline = $true)]$InputObject,
        [int]$Depth = 10,
        [switch]$Compress
    )
    process {
        if ($null -eq $InputObject) { return 'null' }
        return (ConvertTo-JsonLiteral $InputObject 0)
    }
}

# ── HTTP:只实现脚本用到的那一小撮参数 ───────────────────────────────────────
#   返回对象带 .StatusCode / .RawContentStream.ToArray() / .Content / .Headers
function Invoke-WebRequestCompat {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [string]$Method = 'Get',
        [hashtable]$Headers = @{},
        $Body = $null,
        [string]$ContentType = $null,
        [int]$TimeoutSec = 30
    )
    $req = [System.Net.HttpWebRequest]::Create($Uri)
    $req.Method = $Method.ToUpper()
    $req.Timeout = $TimeoutSec * 1000
    $req.ReadWriteTimeout = $TimeoutSec * 1000
    $req.UserAgent = 'YinjiaMesPrintAgent/1.1'
    foreach ($k in $Headers.Keys) { $req.Headers.Add([string]$k, [string]$Headers[$k]) }
    if ($null -ne $Body) {
        if ($Body -is [byte[]]) { $bytes = $Body } else { $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Body) }
        if (-not $ContentType) { $ContentType = 'application/json; charset=utf-8' }
        $req.ContentType = $ContentType
        $req.ContentLength = $bytes.Length
        $rs = $req.GetRequestStream()
        $rs.Write($bytes, 0, $bytes.Length)
        $rs.Close()
    }
    try {
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        # 4xx/5xx 也把响应体带回来(调用方要读 error 文本),连接级失败才抛
        if ($_.Exception.Response) { $resp = $_.Exception.Response } else { throw }
    }
    $stream = $resp.GetResponseStream()
    $ms = New-Object System.IO.MemoryStream
    $buf = New-Object 'byte[]' 8192
    while (($n = $stream.Read($buf, 0, $buf.Length)) -gt 0) { $ms.Write($buf, 0, $n) }
    $stream.Close()
    return (New-Object PSObject -Property @{
        StatusCode       = [int]$resp.StatusCode
        RawContentStream = $ms
        Content          = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
        Headers          = $resp.Headers
    })
}

# ── 真的缺命令时才占位(PS3+ 有原生 cmdlet,不要覆盖)──────────────────────────
if (-not (Get-Command ConvertFrom-Json -ErrorAction SilentlyContinue)) {
    Set-Item -Path function:global:ConvertFrom-Json -Value ${function:ConvertFrom-JsonCompat}
}
if (-not (Get-Command ConvertTo-Json -ErrorAction SilentlyContinue)) {
    Set-Item -Path function:global:ConvertTo-Json -Value ${function:ConvertTo-JsonCompat}
}
if (-not (Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue)) {
    Set-Item -Path function:global:Invoke-WebRequest -Value ${function:Invoke-WebRequestCompat}
}

if ($script:IsPs2) { Write-Host '[compat] 已启用 PowerShell 2.0 兼容层(JSON / HTTP)' -ForegroundColor DarkGray }
