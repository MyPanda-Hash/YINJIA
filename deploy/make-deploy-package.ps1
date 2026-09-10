<#
  make-deploy-package.ps1 — 一键凑齐"要导到服务器的所有文件"
  ==========================================================
  产出: C:\INCER\YINJIA-MES\deploy\pkg-<日期>\  (RDP 整目录粘贴到服务器即可)

  内容:
    app.jar                     热更新包(前端+后端,含 static)
    server-scripts\             服务器侧脚本(已装过的可跳过)
    db-tools\                   数据库迁移工具 + 清单 + 全部 SQL + 自查脚本 + JDBC 驱动 + 还原脚本
    <库备份>.bak                与当前代码同版的库快照(全量还原路线用;用 -SkipBackup 可跳过)
    部署步骤.md                 逐步操作说明(含两条路线与验证点)
    FILES.txt                   本包文件清单(含大小与 SHA256)

  用法:
    powershell -ExecutionPolicy Bypass -File deploy\make-deploy-package.ps1
    powershell -ExecutionPolicy Bypass -File deploy\make-deploy-package.ps1 -SkipBackup
#>
[CmdletBinding()]
param(
  [switch]$SkipBackup
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # C:\INCER\YINJIA-MES
$deploy = Join-Path $root 'deploy'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$pkg = Join-Path $deploy "pkg-$stamp"
$bakName = "HSDZ_MES_$(Get-Date -Format 'yyyyMMdd').bak"
$utf8bom = New-Object System.Text.UTF8Encoding($true)

Write-Host "[1/5] 校验构建产物 ..." -ForegroundColor Cyan
$jar = Join-Path $root 'backend\target\app.jar'
if (-not (Test-Path $jar)) { throw "未找到 $jar,请先跑 build-appjar.ps1" }
$jarTime = (Get-Item $jar).LastWriteTime
Write-Host ("      app.jar {0:N1} MB, 构建于 {1}" -f ((Get-Item $jar).Length / 1MB), $jarTime)

Write-Host "[2/5] 建包目录 ..." -ForegroundColor Cyan
New-Item -ItemType Directory "$pkg\server-scripts", "$pkg\db-tools\lib" -Force | Out-Null

Write-Host "[3/5] 复制 app.jar 与服务器脚本 ..." -ForegroundColor Cyan
Copy-Item $jar "$pkg\app.jar" -Force
if (Test-Path (Join-Path $deploy 'deploy-server.bat')) { Copy-Item (Join-Path $deploy 'deploy-server.bat') "$pkg\deploy.bat" -Force } else { Write-Warning '未找到 deploy\deploy-server.bat' }
foreach ($f in 'update.bat', 'start.bat', 'start-service.bat', '部署说明.md') {
  $src = Join-Path $deploy $f
  if (Test-Path $src) { Copy-Item $src (Join-Path "$pkg\server-scripts" $f) -Force }
}

Write-Host "[4/5] 复制数据库工具链(工具+清单+SQL+驱动)..." -ForegroundColor Cyan
$tools = Join-Path $root 'tools'
foreach ($f in 'DbSync.java', 'DbInit.java', 'db-migrations.txt', 'check-migrations.sql', 'pull-sync.bat', 'push-sync.bat') {
  $src = Join-Path $tools $f
  if (Test-Path $src) { Copy-Item $src (Join-Path "$pkg\db-tools" $f) -Force }
}
$jdbc = Join-Path $tools 'lib\mssql-jdbc.jar'
if (Test-Path $jdbc) { Copy-Item $jdbc "$pkg\db-tools\lib\mssql-jdbc.jar" -Force } else { Write-Warning '未找到 tools\lib\mssql-jdbc.jar' }
$sqlFiles = Get-ChildItem $tools -Filter '*.sql' -File
foreach ($s in $sqlFiles) { Copy-Item $s.FullName "$pkg\db-tools\" -Force }
Write-Host ("      SQL 脚本 {0} 个(含清单内历史脚本,勿手工逐个跑), 共 {1:N1} MB" -f $sqlFiles.Count, (($sqlFiles | Measure-Object Length -Sum).Sum / 1MB))
# 预编译 DbSync:服务器只装 JRE 也能跑(迁移执行器)
if (Get-Command javac -ErrorAction SilentlyContinue) {
  & javac --release 11 -encoding UTF-8 -d "$pkg\db-tools\lib" "$tools\DbSync.java" 2>&1 | Out-Null
  if ((Test-Path "$pkg\db-tools\lib\DbSync.class") -and $LASTEXITCODE -eq 0) {
    Write-Host ("      DbSync.class {0:N0} B (Java 11 字节码:服务器无 JDK 时用这个)" -f (Get-Item "$pkg\db-tools\lib\DbSync.class").Length)
  } else { Write-Warning 'DbSync 预编译失败,服务器将回退到 java DbSync.java(需要 JDK)' }
} else { Write-Warning '本机没有 javac,跳过 DbSync 预编译' }

# db-tools 里的显眼警示(防止有人见 sql 就跑)
$warn = @"
!!! 先读我再动手 !!!
================================================================
本目录里的 .sql 大多不是"给你手跑的":只有 db-migrations.txt 清单里的才是迁移脚本,
而且大部分是历史脚本 —— 它们在当前库上重跑会清空重建数据
(翻译表 / 单据状态 / 库存台账 / 账号 / 价格本 / 审批历史)。

本目录只有三条正确用法:
  1) 查缺:sqlcmd -S localhost -d HSDZ_MES -E -f 65001 -i check-migrations.sql
  2) 补跑:java -cp lib\mssql-jdbc.jar DbSync.java run <某个脚本名>     (幂等,可重复)
  3) 兜底:全量还原用 restore-from-backup.sql(会覆盖服务器现有数据!)

[禁止] 不要执行:java -cp lib\mssql-jdbc.jar DbSync.java   (默认 sync 模式)
   —— 它会把清单里"未登记"的脚本全部执行一遍,在已有数据的库上等于灾难。
   正确顺序:baseline(只登记不执行) -> check-migrations -> 逐个 run -> 复验。

[禁止] migrate-rd-cleanup.sql / cleanup-base-panels.sql / _so_data.sql 等
   是一次性建库或测试数据脚本,生产库上永远不要手工执行。

DbSync 必须在 tools 目录下执行(按当前目录找 db-migrations.txt),
且它连的是 127.0.0.1:1433 —— 只能在本机跑。
"@
[System.IO.File]::WriteAllText("$pkg\db-tools\000-先读我-勿乱跑.txt", $warn, $utf8bom)

if (-not $SkipBackup) {
  Write-Host "[5/5] 备份当前库(与代码同版的快照)..." -ForegroundColor Cyan
  $bak = Join-Path $deploy $bakName
  $sql = "BACKUP DATABASE HSDZ_MES TO DISK = N'$bak' WITH INIT, COMPRESSION;"
  $tmp = Join-Path $env:TEMP 'yj-backup.sql'
  [System.IO.File]::WriteAllText($tmp, $sql, $utf8bom)
  & sqlcmd -S localhost -E -f 65001 -b -i $tmp | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Warning '备份失败(需要 sysadmin 权限),已跳过;可稍后手动备份' }
  elseif (Test-Path $bak) { Copy-Item $bak "$pkg\$bakName" -Force }
} else {
  Write-Host "[5/5] -SkipBackup:未生成库备份" -ForegroundColor Yellow
}

# ---- 步骤说明 ----
$today = Get-Date -Format 'yyyyMMdd'
$steps = @"
# YINJIA-MES 部署步骤(pkg-$stamp)

> **一句话**:① 备份服务器库 → ② 补库结构(路线 B,默认) → ③ 换 app.jar → ④ 冒烟 6 条。
> **路线怎么选**:服务器上有真实业务数据 → **路线 B(增量补迁移)**;
> 服务器是可以清空的测试机 → 路线 A(全量还原,省事但会覆盖服务器数据)。

## 一、包内有什么

``````
app.jar                            热更新包:前端 dist + 后端 jar 合并成单文件
deploy.bat                         服务器上一键部署(不带参数=只读自查;deploy.bat GO=真跑)
server-scripts\                    update.bat / start.bat / start-service.bat / 部署说明.md(服务器已装过就跳过)
db-tools\                          迁移工具链:DbSync.java + db-migrations.txt + check-migrations.sql + 全部 *.sql + lib\mssql-jdbc.jar
db-tools\restore-from-backup.sql   路线 A 的一键还原脚本(自动识别数据文件目录)
db-tools\000-先读我-勿乱跑.txt      哪三个命令能用、哪个绝对不能跑
$bakName       与当前代码同版的库快照(仅路线 A 需要)
FILES.txt                          清单(相对路径 + 字节数 + SHA256)
``````

## 二、路线 B:保留服务器现有数据(默认走这条)

> **最省事:直接跑包里的 `deploy.bat`**（在服务器上,在包目录里双击或在 cmd 里执行）
>
> | 命令 | 作用 |
> |---|---|
> | `deploy.bat` | **只读自查**：前置检查 + 库缺项自查。不写服务器任何文件,应用照常在跑 |
> | `deploy.bat GO` | **真跑**：停应用 → 备份库 → baseline 登记 → 补跑 14 个脚本 → 复验 → 换 app.jar → 起应用 → 健康检查 |
> | `deploy.bat GO DB` | 只做数据库部分,不动 app.jar / 不停服务 |
>
> 全程写 UTF-8 日志到 `logs\deploy-<时间>.log`；**备份失败会硬停**(不会在没有备份的情况下改库)；
> 复验仍有缺项时**不会换 app.jar**(避免"库落后但代码已更新"的故障重演)。
> 下面是它的手工等价流程,脚本跑不动时照着做。

**第 0 步 — 先备份(必做;用 sa 或 sysadmin,yinjia 应用账号没有 BACKUP 权限)**
``````sql
BACKUP DATABASE HSDZ_MES TO DISK = N'D:\bak\before_$today.bak' WITH INIT, COMPRESSION;
``````

**第 1 步 — 把 ``db-tools\`` 整个覆盖到服务器 ``C:\yinjia\tools\``**

**第 2 步 — 查缺**(在 tools 目录里执行)
``````bat
cd /d C:\yinjia\tools
sqlcmd -S localhost -d HSDZ_MES -E -f 65001 -i check-migrations.sql
``````
输出 15 行「✓ 到位 / ✗ 缺失」。**全绿就直接跳到第 4 步。**

**第 3 步 — 登记 + 逐个补跑**(漏了这步就是上次"实施计划阶段存不进"的坑)

3.1 先把清单里的历史脚本全部登记为"已完成" —— 只登记、不执行:
``````bat
java -cp lib\mssql-jdbc.jar DbSync.java baseline
``````
> 为什么要 baseline:默认 sync 会把清单里**未登记**的脚本全部执行一遍,
> 其中含清空重建类脚本(翻译表/单据状态/库存台账/账号/价格本/审批历史)。
> baseline 之后,只有我们**显式 run** 的脚本才会执行。

3.2 按第 2 步查出来的 ✗ 项逐条强制补跑(``run`` 无视登记直接执行,幂等、可重复):
``````bat
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-rd-plan-stages.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-rd-docno-ref.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-rd-plan-docno-ref.sql
java -cp lib\mssql-jdbc.jar DbSync.java run fix-proj-customer-ref.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-aux-stock.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-aux-line-wh.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-product-lot-dualout.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-dualout-label.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-prod-forms-fields2.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-prod-forms-fields3.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-prod-forms-fields4.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-prod-forms-fix.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-view-id.sql
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-view-ascancel.sql
``````
> 这 14 个是本机自查全绿时对应的补丁集,全部幂等(重复跑只重写同样的值)。
> 若第 2 步查出的缺失项与这份清单对不上,以 check-migrations.sql 每行的脚本提示为准。
> [禁止] ``migrate-rd-cleanup.sql`` 是一次性测试数据清理脚本,生产上永远不要执行。

**第 4 步 — 复验**
``````bat
sqlcmd -S localhost -d HSDZ_MES -E -f 65001 -i check-migrations.sql
java -cp lib\mssql-jdbc.jar DbSync.java
``````
第二条应输出「执行 0, 跳过 N, 失败 0」—— 说明清单与库已对齐,以后再部署可重复这套。

## 三、路线 A:全量还原(仅当服务器数据可以丢)

1. **先停服务**(否则连接占用会让还原失败):结束 java.exe 或停 Windows 服务。
2. 把 ``$bakName`` 传到服务器(如 ``D:\bak\``);打开 ``db-tools\restore-from-backup.sql``,
   把第一行 ``@bak`` 改成实际路径,然后:
   ````bat
   cd /d C:\yinjia\tools
   sqlcmd -S localhost -E -b -f 65001 -i restore-from-backup.sql
   ````
   脚本自动用 ``SERVERPROPERTY('InstanceDefaultDataPath')`` 定位数据目录,
   不用手写 MOVE 路径(备份内逻辑文件名固定为 ``ASPSMT`` / ``ASPSMT_log``)。
3. 换 app.jar(见第四节),再跑 ``check-migrations.sql`` 应「全部到位」。

## 四、换 app.jar(两条路线都要做)

1. 把 ``app.jar`` 粘贴到服务器 ``C:\yinjia\update\app.jar``(覆盖)。
2. 双击 ``C:\yinjia\update.bat`` → 自动 停 → 备份 app.jar.bak → 换 → 启;
   窗口出现 ``Started MesApplication`` 即成功。
3. **回滚**:``copy /Y C:\yinjia\app.jar.bak C:\yinjia\app.jar`` 后重启。
4. 浏览器 **Ctrl+F5 强刷**(前端静态资源打在 jar 里,不刷缓存会看到旧页面)。

## 五、上线冒烟(逐条点一遍,6 条)

1. 登录 → 左侧「研发管理」下应是 项目管理 / 测试记录 / 产品文件 三组;
   鼠标悬停一级菜单,浮层 4 列(项目管理 · 数据记录表 · 实验室使用记录表 · 产品文件),无空列。
2. 任意表格面板点列头角标:升序 → 降序 → 取消,三态循环。
3. 文书面板右侧「模糊搜索」:选字段 + 填内容 → 查找(命中 1 条直接跳转,多条出清单可点选)。
4. **项目实施计划**(上次出问题的点):填 阶段1「计划内容 / 计划完成」→ 保存 → 重开单据内容仍在;
   归档后阶段框底部出现绿色「完成」按钮,点它写入实际完成日期。
5. 项目进度查询:状态列显示阶段进度标签(如"进行中 2/5 · 逾期 1")→ 点标签弹出阶段计划。
6. 功能性滤效 → 「3.数据记录表」右上「✎ 字段编辑」可改列名 / 显隐,保存后表头随之变化。

## 六、环境硬约束(踩过的坑)

- 库兼容级别 100(SQL 2008 语义):迁移脚本禁用 2016+ 语法(STRING_AGG / DROP IF EXISTS 等)。
- sqlcmd 跑中文脚本必须 ``-f 65001``,脚本存 UTF-8 **带 BOM**。
- 涉及筛选索引 / 索引视图 / 计算列的写操作要 ``SET QUOTED_IDENTIFIER ON``(与语句同批次)。
- DbSync 必须在 ``tools`` 目录执行(按当前目录找 db-migrations.txt),且连 ``127.0.0.1:1433`` → 只能在本机跑。
- 备份 / 还原需要 sa 或 sysadmin;应用账号 ``yinjia`` 无此权限。
"@
[System.IO.File]::WriteAllText("$pkg\部署步骤.md", $steps, $utf8bom)

# ---- 文件清单 ----
$lines = @("YINJIA-MES 部署包 $stamp", ('app.jar 构建时间: ' + $jarTime), '')
foreach ($f in Get-ChildItem $pkg -Recurse -File | Sort-Object FullName) {
  $rel = $f.FullName.Substring($pkg.Length + 1)
  $hash = if ($f.Length -lt 60MB) { (Get-FileHash $f.FullName -Algorithm SHA256).Hash } else { '(跳过)' }
  $lines += ('{0,-46} {1,12:N0} B  {2}' -f $rel, $f.Length, $hash)
}
[System.IO.File]::WriteAllLines("$pkg\FILES.txt", $lines, $utf8bom)

Write-Host ''
Write-Host "===== 部署包就绪 =====" -ForegroundColor Yellow
Write-Host "  $pkg"
Get-ChildItem $pkg | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 2) } } | Format-Table -AutoSize
Write-Host "下一步:整个目录 RDP 粘贴到服务器;按 部署步骤.md 走(有数据走路线 B)" -ForegroundColor Green
