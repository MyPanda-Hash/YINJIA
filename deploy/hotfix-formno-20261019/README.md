# 单号重发热修复包(2026-10-19)

给**服务器 36.140.66.163** 用的最小部署包:修"送料暂收单 / 来料检验单 / 生产工单 点新增出来一张已审核单"。

> 本机(127.0.0.1:8090)已经修好并验证过;服务器跑的还是旧版本 + 旧号池,所以那边仍然能看到。
> 判定依据:服务器首页 chunk = `index-CzoFkXQv.js`,本机新包 = `index-LZyk8afg.js`;
> 服务器 `QC_RECV` 列表里仍有 20 行「无供应商 + 已审核」(SL-2026-10-0030~0036 等)。

## 一、包里有什么

| 文件 | 用途 |
|---|---|
| `migrate-formno-pool-sync-20261019.sql` | 数据修复:①删事故留下的空白占位头行(不碰明细、不删有内容的行)②号池回登(只增不删)③自检不通过就报错 |
| `apply-migration.bat` | 在服务器上跑上面那个 SQL(自动找 `sqlcmd`,日志写 `migrate-log.txt`) |
| `app.jar`(单独给) | 本机 `backend\target\app.jar`,21:15 由仓库 HEAD(e0489c61)打包,含代码修复 |

## 二、服务器上按这个顺序做(约 3 分钟)

### ① 先修数据(应用不用停)

RDP 进服务器,把 `migrate-formno-pool-sync-20261019.sql` 和 `apply-migration.bat` 放到同一个目录
(例如 `C:\yinjia\hotfix\`),**双击 `apply-migration.bat`**。

脚本末尾自检通过会打 `[OK] HSDZ_MES:无重号、号池无缺号`,退出码 0;不通过会 `RAISERROR 16`
(sqlcmd 返回非 0),日志在 `migrate-log.txt`。

预期输出(服务器上会删掉约 20 行空白重号头行、回登 300+ 个单号):

```
[清理] sl_recv : 20 行空白重号头行
[回登] SL (sl_recv) : 253 个号
...
[OK] HSDZ_MES:无重号、号池无缺号(新增不会再重发库里的号)
```

### ② 再换代码

1. 把本机 `backend\target\app.jar`(99MB,21:15 打的)**粘贴到**服务器的 `C:\yinjia\update\app.jar`(覆盖);
2. **双击 `C:\yinjia\update.bat`** —— 它会 `停 → 备份 app.jar.bak → 换包 → 起`;
3. 新窗口出现 `Started MesApplication` + `HikariPool ... Start completed` = 完成。

> ⚠ 这个 app.jar 是**整包**(仓库 HEAD 全量),不只是今晚这一个修复:服务器上一次部署之后的
> 所有已提交改动都会一起上去。要"只换这一个类"的最小改法见 §四。

### ③ 验收(在开发机上跑,不用连服务器)

```powershell
cd D:\workspace\yinjia
node tools\archive\_probe-add-newdoc-20261019\_remote-check.mjs 36.140.66.163:8090
```

期望:`QC_RECV ... 空白且已审核=0`;再逐个点一次三个面板的「新增」,表头单号应是**新号**、徽标是**草稿**。

## 三、回滚

```cmd
copy /Y C:\yinjia\app.jar.bak C:\yinjia\app.jar
```
然后 `taskkill /IM java.exe /F` + `C:\yinjia\start.bat`。

数据修复不用回滚:它只删了"同一个单号下全字段为空"的占位头行(明细行一行没动),
并往 `s_allno` 里补登了本来就存在的单号。真要回退也没有回退目标(那些空白行本来就是垃圾)。

## 四、(可选)只换这一个类,不换整包

如果不想把整包带上去,可以只替换 `FormNoService.class`:

1. 本机从新包里取出这一个类(`jar xf` 没有 `-C` 参数,必须先 `cd` 进目标目录):
   ```powershell
   cd D:\workspace\yinjia
   mkdir hotfix-class -Force
   cd hotfix-class
   & "$env:USERPROFILE\.jdks\ms-25.0.4\bin\jar.exe" xf ..\backend\target\app.jar BOOT-INF/classes/com/yinjia/mes/service/FormNoService.class
   ```
   把 `hotfix-class\BOOT-INF` 整个目录拷到服务器 `C:\yinjia\hotfix-class\`;
2. 服务器上(管理员 cmd):
   ```cmd
   taskkill /IM java.exe /F
   copy /Y C:\yinjia\app.jar C:\yinjia\app.jar.bak-20261019
   cd /d C:\yinjia
   "C:\Program Files\Eclipse Adoptium\jdk-25.0.4.101-hotspot\bin\jar.exe" uf app.jar -C C:\yinjia\hotfix-class BOOT-INF
   C:\yinjia\start.bat
   ```
3. 起不来就按 §三 回滚。

> 该类的依赖(`PanelRegistry.all()` / `PanelDef.prefix()` 等)在本仓已存在很久,旧包一般都有;
> 但**整包**才是自洽的版本,除非你确定服务器那版与 HEAD 只差今天这些提交,否则优先走 §二。

## 五、为什么本机好了、服务器没好

- 号池 `s_allno` 与业务表脱节是**数据**问题:9 月导库那批单没回登号池(库里 SL 到 0130、池只到 0006),
  旧代码取号只看号池 ⇒ 新增把库里已有的号又发一次 ⇒ 新草稿与旧单同号、共用 `yj_doc_status`
  (`shr=admin`)⇒ 一出生就是已审核。
- 修复是**代码 + 数据**两半:代码改成「取号基准 = max(号池末号, 各业务表同前缀同月最大号)」并把
  本前缀业务表纳入比对;数据靠上面那个 SQL 把号池补齐、把空白重号行清掉。
- 本机两半都已经做完(验证:新增 `SL-2026-10-0134`、`IJ-2026-10-0191`、`GD-2026-10-0014` 全是草稿);
  服务器两半都还是旧的,所以三个面板都会复现。
