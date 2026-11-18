印代理 · Windows 7 兼容改造(2026-11-10)

现场:客户那台 **Windows 7 旗舰版 SP1 / i5-4590 / 12GB** 双击 `安装.bat`,窗口停在

```
The system cannot write to the specified device.
Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F
             occurred when writing console output buffer at current cursor position.
Press any key to continue . . .
```

## 病根(三条,缺一都会挂)

| # | 问题 | 为什么 Win7 才炸 |
|---|---|---|
| 1 | `安装.bat` 里 `chcp 65001` | Win7 控制台 + UTF-8 代码页下,`Write-Host` 写控制台输出缓冲区会抛 0x1F;脚本又是 `$ErrorActionPreference='Stop'`,第一行输出就把安装打断(环境检查根本没跑) |
| 2 | `Get-Printer` | 属于 PrintManagement 模块,**Windows 8/2012 才有**,Win7 上没有这个命令 |
| 3 | `Get-CimInstance Win32_Printer` / `Win32_Process` | CIM 在 Win7 依赖服务/PS3+,不如 `Get-WmiObject` 稳 |

## 改法(已落到 `deploy/print-agent/`)

1. **输出不再致命**:所有 `Write-Host` → `Say`(带颜色的也走它)。
   `Say` 先试带颜色 `Write-Host`,失败退 `[Console]::Out`,再失败只追加日志 —— 任何情况下都不会中断安装。
   日志:安装 `install.log` / 卸载 `uninstall.log` / 代理 `agent.log`(同目录)。
2. **打印机改用 .NET**:`[System.Drawing.Printing.PrinterSettings]::InstalledPrinters`(PS2/.NET2 就有);
   默认打印机优先 `Get-WmiObject Win32_Printer`(Win7 原生),失败再看 .NET 第一台。
3. **`.bat` 改 GBK + `chcp 936`**:中文与中文文件名在 Win7 正常;`.ps1` 仍是 **UTF-8 with BOM**
   (PS5.1 读脚本的硬要求,见 `说明.md` 第六节)。
4. **TLS 1.2 / 版本闸门**:Win7 默认没有 TLS1.2,安装前显式打开;PowerShell < 3 直接给 WMF 5.1 下载链接。
5. **新增 `-DryRun`**:只体检(环境/账号/打印机),不写配置、不设自启、不起代理 —— 现场排障第一步。

## 验证记录

- 安装脚本 DryRun(本机,真实 8090 登录 + 打印机枚举):

```
[OK] .NET 绘图组件可用(System.Drawing)
[OK] 检测到打印机:Kyocera ECOSYS M8124cidn / AiYin AT341 (direct) / AiYin AT341
[OK] 登录成功(http://127.0.0.1:8090)
[DryRun] 环境与账号检查通过;本次不写配置、不设开机自启、不启动代理。
```

- 代理空跑(`-Port 18799 -Mode Pdf`):`GET /health` → `200 {"ok":true,"printer":"Kyocera ECOSYS M8124cidn(系统默认)","mode":"Pdf"}`。
- 三个脚本语法解析:见 `parse-check.ps1`(`[OK] 安装.ps1 / 卸载.ps1 / print-agent.ps1`)。
- 分发 zip 重新打包后**解压再跑 DryRun** 通过(中文文件名/BOM 均正常)。

## 复跑改造

```bat
node tools/archive/_print-agent-win7-20261110/patch-win7.mjs
```

脚本幂等(已含 `function Say {` 的文件自动跳过)。注意:
- `.bat` 的 `chcp` 是**字节级**替换(原文件 GBK,按 UTF-8 读会把中文变成 `?`);
- `.ps1` 落盘必须是 **UTF-8 BOM**;用其它编辑器改完要检查前 3 字节是 `239,187,191`。

## 客户现场怎么排查

1. 确认用的是 **2026-11-10 之后**的文件夹/zip;
2. 先跑 DryRun(命令见 `说明.md` 第八节),不行就把 `install.log` 发回来;
3. 报 PowerShell 版本低 → 装 WMF 5.1 后重启;
4. 还不行再看 `agent.log`(代理)与 `uninstall.log`(卸载)。
## 追加:PowerShell 2.0 兼容(2026-11-10 第二轮)

第一轮改完现场又报:

```
[FAIL] 这台电脑的 PowerShell 版本太低(需要 3.0 及以上)。
       Win7 请先装 WMF 5.1:...
```

客户那台 Win7 **没装 WMF**,`powershell.exe` 就是 2.0 —— 没有 `ConvertFrom-Json` / `ConvertTo-Json` /
`Invoke-WebRequest`。用户口径「要兼容,能够一键完成,不要多余操作」⇒ **不再要求装 WMF**,改为自带兼容层:

- 新增 `compat-ps2.ps1`:PS<3 时由三个脚本自动 dot-source;
  - JSON 用 `System.Web.Extensions` 的 `JavaScriptSerializer`(.NET 3.5,Win7 自带),
    把 Dictionary/数组递归转成 PSObject,保证 `$obj.data.token`、`$task.'二维码内容'` 这种属性访问在 PS2 下可用;
  - `Invoke-WebRequest` 用 `HttpWebRequest` 实现(只覆盖脚本用到的参数),返回 `StatusCode/RawContentStream/Content`;
  - 只在命令**真的缺失**时才占位(PS3+ 用系统自带命令,不覆盖)。
- 清掉 PS3+ 语法:`-in` → `-contains`;`[pscustomobject]` → `New-Object PSObject -Property`;`$PSCommandPath` → `$MyInvocation.MyCommand.Path`。
- 代理的轮询跑在 `Start-Job` 子进程里:把兼容层路径作为第一个参数传进去,job 内 `PS<3` 时先 dot-source。

验证(本机 PS5.1):

- `test-compat.ps1`(强制加载兼容层):JSON 序列化、登录 POST(token 172 字符)、GET 返回对象、
  **中文键 JSON** 解析(`qr=0@A@1 wo=WO-1 rows=1 物料=折叠棉`)全部通过;
- `安装.ps1 -DryRun`:枚举打印机 + 登录 8090 成功;
- `print-agent.ps1 -Port 18799 -Mode Pdf -Server ...`:`/health=200`,`mode=Pdf`,打印机识别正常;
- zip 解压后再跑 DryRun 通过。
## 第三轮:PS2 下 `Serialize` 循环引用(2026-11-10 现场截图)

报错:

```
[FAIL] 连不上服务器或账号密码不对:使用 "1" 个参数调用 "Serialize" 时发生异常:
       "序列化类型为 System.Management.Automation.PSParameterizedProperty 的对象时检测到循环引用。"
```

不是网络问题(账号/网址都对):PS2 把 `@{...}` 包成 PSObject,`JavaScriptSerializer` 顺着适配属性
(Keys/Values/…)一路递归 → 循环引用。

**改法**:`ConvertTo-Json` 不再用序列化器,改成**手写 JSON 拼接**(`ConvertTo-JsonLiteral`,
自带转义、InvariantCulture 数字、PSObject 仅剥"底层是集合/值类型"的壳),PS2/PS5 行为一致;
反序列化仍用 `JavaScriptSerializer`(输入是纯文本,不受影响)。

回归:`test-json.ps1` 五组全过 —— 普通哈希表 / PSObject 包裹的哈希表 / 嵌套数组+布尔+数字 /
引号反斜杠换行制表转义 / PSCustomObject(中文键)。

顺带:现场打印机列表里第一台是「导出为WPS PDF」,安装脚本原来只排除了微软那几个虚拟打印机 ⇒
默认打印机选成了 WPS PDF。现在按名字 `PDF|XPS|OneNote|Fax|WPS` 一律当虚拟打印机跳过
(安装脚本与代理的 Auto 模式同步改)。
## 第四轮:现场日志 `UseBasicParsing` 找不到参数(2026-11-10)

客户发来的 `install.log`:

```
[OK] 检测到打印机:EPSON LQ-635KII ESC/P2 (副本 1) / EPSON LQ-635KII ESC/P2
[..] 正在验证服务器与账号 ...
[FAIL] 连不上服务器或账号密码不对:找不到与参数名称"UseBasicParsing"匹配的参数。
```

不是网络问题:地址与账号都还没发出去 —— 调用方带 `-UseBasicParsing`(PS3+ 的 cmdlet 参数),
PS2 上走的是我们的替身 `Invoke-WebRequest` 函数,参数表里没有它,绑定阶段就报错。

修法:替身补齐 `-UseBasicParsing` / `-DisableKeepAlive` / `-MaximumRedirection`(接收即可),
并加 `[CmdletBinding()]`(**必须写在函数体内、紧贴 `param`** —— 写在 `function` 外面会报
`Unexpected attribute 'CmdletBinding'`,这个坑也踩了)。

顺带:密码错时服务器返 401/409,现在给一句人话「账号或密码不对(服务器返回 409)」,
不再笼统说"连不上"。

回归:`test-http.ps1`(登录 200/token 172、首页 200、错误路径返回对象)、`test-json.ps1` 五组、
安装 DryRun 成功与错密码两条路都过。
## 第五轮:[WARN] 代理启动后 12 秒内没响应(2026-11-10)

客户 `print-agent.config.json`:

```json
{"station":"仓库","port":18777,"mode":"Auto","printer":"EPSON LQ-635KII ESC/P2 (副本 1)","server":"http://36.140.66.163:8090"}
```

配置写出来了(登录成功),但代理没起来。**原因**:安装脚本用
`Start-Process -ArgumentList @(...,'-Printer',$Printer,'-Station',$Station)` 传参,
PowerShell 会用空格把参数**拼成一条命令行**,打印机名 `EPSON LQ-635KII ESC/P2 (副本 1)` 被拆成
`EPSON` + `LQ-635KII` + …(本机实测 `/health` 里打印机只剩 `EPSON`);PS2 下多余的位置参数还会
直接报「找不到接受参数的位置」→ 代理进程退出 → 12 秒等不到 /health。

**改法**:

1. 代理支持读同目录 `print-agent.config.json`(命令行显式给的仍然优先);
2. 安装脚本的**自启项与首次启动都只传 `-File`**,不再拼参数 —— 中文站点名/带空格打印机名都不会被拆;
3. 启动失败时不再只说"手动跑一次":现在会打印**进程退出码 + `agent.log` 最后 15 行**,
   客户直接截图就能定位;
4. 等待时间 12s → 20s(Win7 冷启动慢一点)。

验证:临时目录放一份 config(打印机名带空格、站点"仓库"),只 `-File` 启动 →
`/health = 200 {"printer":"EPSON LQ-635KII ESC/P2 (副本 1)","mode":"Auto"}`,不再被截断。
## 第六轮:回归收口 + 把适配变成闸门(2026-11-18)

起因:用户问「print-agent 改了很多,有没有做 PS2/Win7 适配」。复查发现**第一轮的适配主体都还在**
(7 个 `.ps1` 全 UTF-8 BOM、`.bat` 全 GBK+`chcp 936`、compat 层被 7 个脚本在首次使用前 dot-source、
`Get-Printer`/`Get-CimInstance` 已换 .NET/WMI),但**这五轮之后的两次改动又把 PS3+ 写法带回来了**:

| # | 位置 | 问题 | PS2 现场后果 |
|---|---|---|---|
| ① | `diagnose.ps1` 第 9/10 段(11-16 新增诊断包) | `Get-Content -Tail 30/20` | 报「找不到与参数名称 Tail 匹配的参数」⇒ `诊断.txt` 里 **agent.log / watchdog.log 两段整段空掉**,而那正是判断"代理掉没掉"的证据 |
| ② | `安装.ps1` 启动失败回显(第五轮加的) | `Get-Content -Tail 15` | 在 try 里被吞 ⇒ 客户看不到那 15 行,又回到"只能截图" |
| ③ | `print-agent.ps1:1182` 站点名转 URL | `[uri]::EscapeDataString`(Win7 CLR 2.0 上不一定有,且**没包 try**) | 轮询 URL 拼不出来 ⇒ 直接不领任务 |
| ④ | `deploy/yinjia-print-agent.zip` | 停在 11-16 的 **v1.1.0**;仓库已是 **v1.2.0** | 客户按包装到的还是老代理 ⇒「其他领料/其他退料/混料单 提交即打印」照样全失败 |

**改法(功能零变化,输出逐字等价)**:

- ①② `-Tail N` → 整读 `Get-Content -LiteralPath … -Encoding UTF8` 后截尾;顺带修掉"PS2 默认按 ANSI
  读 UTF-8 日志会乱码"的隐患。`diagnose.ps1` 抽成 `Out-LogTail` 函数,`安装.ps1` 内联。
- ③ 新增 `Url-Encode`:先 `try { [uri]::EscapeDataString }`,失败按 RFC3986 手工百分号转义
  (仅对不使用 `EscapeDataString` 的老 CLR 生效,PS3+ 行为一字不变)。
- ④ 新增 `tools/printing/make-print-agent-zip.ps1`:先跑闸门 → 按固定 13 文件清单打包 →
  **回读 zip 内 `$AgentVersion` 与源目录核对**;已重打为 v1.2.0(69.3 KB)。

**新增闸门 `tools/printing/check-ps2-compat.ps1`**(13 条规则 + 结构性检查,退出码可进 CI):

- 语法/参数:`-Tail`/`-Raw`/`-File`/`-Directory`/`[pscustomobject]`/`-in`/`$using:`/`Get-CimInstance`/
  `Get-Printer`/`ScheduledTask*`/`Get-FileHash` 等 PS2 没有的、`::new()`/`.ForEach{}`/`-NoNewline`;
- 结构:`.ps1` 必须 **UTF-8 BOM**(没 BOM = 39 个解析错误,commit 62210a153);用了
  `ConvertFrom/To-Json`、`Invoke-WebRequest` 就必须引用 compat 且**先加载后用**;
  `::Tls12` 与 `EscapeDataString` 必须包在 `try` 里;`.bat` 出现 `chcp 65001` 直接判 FAIL。
- 已核实**不**误报:`Read-Host -AsSecureString`(客户 PS2 实测可用 —— 11-10 的 install.log 已经跑到
  「正在验证服务器与账号」,说明密码那步绑参成功)。

**验证证据(本机 Windows PowerShell 5.1;真机 PS2 仍需现场复验)**:

| 项 | 结果 |
|---|---|
| 闸门(改前/改后) | 改前 `FAIL 4 处`,改后 **PASS 0 处 / WARN 0** |
| 语法解析(7 个 .ps1 + 2 个新脚本) | 0 错误;BOM 全 True;行尾统一 CRLF |
| tail 逻辑等价性 | 20 行 UTF-8 BOM 中文日志:我的实现 15 行 vs 原生 `-Tail 15`,**逐行完全一致**;空文件不报错 |
| `Url-Encode` 等价性 | `仓库`/`打印机-01`/`一车间 打印点`/`站点/1#2`/`A_b.c~d`/空串,原生与兜底**输出全等** |
| 代理冒烟(副本目录、无 config、`-Port 18799 -Mode Pdf`) | `/health=200 {"version":"1.2.0","mode":"Pdf",...}` |
| `安装.ps1 -DryRun` | 打印机枚举 + 登录 8090 成功,退出码 0 |
| `诊断.bat` 同款 `diagnose.ps1` | 第 9/10 段真的打出日志(走新 helper),中文正常 |
| 兼容层回归(archive 三件套) | `test-json` 五组 / `test-http` / `test-compat` 全 PASS |
| 分发包 | 重打 13 文件 v1.2.0 → 解压后再跑闸门 **PASS**,7/7 BOM+解析 0 错误 |

**以后动打印代理的规矩**:改完跑
`powershell -NoProfile -ExecutionPolicy Bypass -File tools\printing\check-ps2-compat.ps1`,
再 `tools\printing\make-print-agent-zip.ps1` 出包(它自带闸门 + 版本回读)。

⚠ 一个已知的小脆弱(本次未改,与 PS2 无关):`安装.ps1` 在**没有控制台**的方式下跑
(如 `powershell -File 安装.ps1` 且 stdin 被重定向)时,`Read-Host` 返回 `$null` ⇒ `(Read-Host …).Trim()`
抛「不能对 Null 值表达式调用方法」。客户双击「安装.bat」有控制台,不受影响;自动化调用请显式传
`-Server/-Pass/-Station`。
