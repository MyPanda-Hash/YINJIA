打印代理 · Windows 7 兼容改造(2026-11-10)

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