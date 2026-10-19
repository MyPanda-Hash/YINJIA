# -*- coding: utf-8 -*-
"""
从《副本副本生产设备列表统计(2026)(1).xls》生成数采设备台账导入脚本。

口径(用户 2026-10-19):
  "根据这里面的数据，把是否联网是的设备的数据整理出来，加入系统的测试账套里面的数采平台的设备数据里面"
  ⇒ 只取「是否联网 = 是」的行；**按台数展开**（数量列 17 台 = 17 条设备台账，
    因为数采台账是一台设备一条，将来每台各自挂网关/采集点），合计 129 台。

输入:xls 第 2 张表? 实际只有 1 张「生产设备列表」，表头 7 列:
  序号 | 设备名称 | 设备采购合同编号 | 生产厂家 | 数量 | 是否为数字化设备 | 是否联网
输出:tools/migrate-dc-device-import-20261019.sql（幂等 + 仅测试账套执行）
"""
import io
import os
import re
import xlrd

XLS = r'C:\Users\x1787\OneDrive\Desktop\副本副本生产设备列表统计(2026)(1).xls'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..',
                   'migrate-dc-device-import-20261019.sql')

# 设备类型归类:按顺序命中第一条(长词优先,避免「产线隔音室」被归成产线)
RULES = [
    ('注塑机', '注塑机'),
    ('机械手', '机械手'),
    ('干燥机', '干燥机'),
    ('拌料机', '加工设备'),
    ('内绕机', '加工设备'),
    ('高周波', '加工设备'),
    ('移印机', '加工设备'),
    ('超声波', '加工设备'),
    ('灌胶机', '加工设备'),
    ('锁螺丝机', '加工设备'),
    ('压铸机', '加工设备'),
    ('液压式高度调节板', '公用设备'),
    ('空压机', '公用设备'),
    ('冷水', '公用设备'),
    ('冻水', '公用设备'),
    ('风机', '公用设备'),
    ('喷油线', '产线'),
    ('煲机线', '产线'),
    ('流水线', '产线'),
    ('拉线', '产线'),
    ('组装线', '产线'),
    ('生产线', '产线'),
    ('老化', '产线'),
    ('隔音', '隔音设施'),
    ('静音', '隔音设施'),
    ('包装机', '包装设备'),
    ('测试', '检测设备'),
    ('检测', '检测设备'),
    ('仪器', '检测设备'),
    ('电脑', '办公终端'),
    ('平板', '办公终端'),
]


def dev_type(name):
    for key, val in RULES:
        if key in name:
            return val
    return '其他'


def s(v):
    if v is None:
        return ''
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v).strip()


def main():
    book = xlrd.open_workbook(XLS)
    sheet = book.sheet_by_index(0)
    rows = []
    for r in range(1, sheet.nrows):
        cells = [s(sheet.cell_value(r, c)) for c in range(7)]
        if not cells[1] or cells[0] in ('合计', ''):
            continue
        no, name, contract, maker, qty, digital, networked = cells
        if networked != '是':
            continue
        rows.append({
            'no': no, 'name': name, 'contract': contract, 'maker': maker,
            'qty': int(float(qty or 0)), 'digital': digital, 'networked': networked,
        })

    # 按台数展开,同名设备跨行连续编号(五轴伺服横走式机械手在 62/63 两行,合计 3 台)
    base_count = {}
    for row in rows:
        base_count[row['name']] = base_count.get(row['name'], 0) + row['qty']
    seen = {}
    devices = []
    for row in rows:
        for i in range(row['qty']):
            base = row['name']
            if base_count[base] > 1:
                seen[base] = seen.get(base, 0) + 1
                name = f"{base} {seen[base]:02d}"
            else:
                name = base
            devices.append({
                'code': 'LW-%03d' % (len(devices) + 1),
                'name': name,
                'type': dev_type(base),
                'base': base,
                'maker': row['maker'],
                'no': row['no'],
                'qty': row['qty'],
                'digital': row['digital'],
            })

    lines = []
    for d in devices:
        remark = '来源:生产设备列表统计(2026) 序号%s' % d['no']
        if d['qty'] > 1:
            remark += '(该行共 %d 台)' % d['qty']
        if d['maker']:
            remark += ';生产厂家:%s' % d['maker']
        if d['digital'] != '是':
            remark += ';表内「是否为数字化设备」=%s,按「是否联网=是」口径纳入' % (d['digital'] or '空')
        remark += ';按「是否联网」导入,未接硬件前显示离线'
        lines.append((d, remark))

    # 统计
    from collections import Counter
    by_type = Counter(d['type'] for d, _ in lines)
    by_maker = Counter(d['maker'] or '(未填)' for d, _ in lines)

    head = f"""/* ============================================================
   migrate-dc-device-import-20261019.sql
   数采设备台账导入 —— 《副本副本生产设备列表统计(2026)(1).xls》中「是否联网 = 是」的设备

   来源与口径(用户 2026-10-19）:
     "根据这里面的数据，把是否联网是的设备的数据整理出来，加入系统的测试账套里面的
      数采平台的设备数据里面"
   - 只取「是否联网 = 是」的 {len(rows)} 行;
   - **按台数展开**:数量列合计 {sum(r['qty'] for r in rows)} 台 ⇒ 生成 {len(devices)} 条设备台账。
     理由:数采台账是一台设备一条(将来每台各自绑网关/采集点/规则),数量写在一条里会丢信息;
     原行的序号/数量/生产厂家全部保留在 remark 里可回溯。
   - 设备编码 LW-001..LW-{len(devices):03d}(LW = 联网),状态 offline、启停 Y、未绑网关 —— 
     这是**台账登记**,不造任何采样值;接硬件后由 /api/dc/ingest 写入真实数据
     (沿用「看板的数据要是系统里面的真实的数据」口径)。

   按类型:{'; '.join(f'{k} {v} 台' for k, v in by_type.most_common())}
   按厂家:{'; '.join(f'{k} {v} 台' for k, v in by_maker.most_common())}

   ⚠ 只导测试账套(用户明确"加入系统的测试账套"):本脚本在其它库上下文里只打印一行提示、不写任何行,
     所以进 db-migrations.txt 由 DbSync 串跑时,正式库 HSDZ_MES 上是 no-op;要导正式库需显式去掉闸门。
     ⚠ 闸门和 INSERT 必须写在**同一批**里 —— T-SQL 的 RETURN 只结束当前批,中间插 GO 的话
       后面的 INSERT 照样执行(2026-10-19 首次执行就因此在正式库灌了 129 行,已清),
       故本脚本全篇只有结尾一个 GO。
   ⚠ 幂等:按 code 判重(已存在则不覆盖人工改过的台账);不删任何已有设备。
   生成器:tools/archive/_dc-device-import-20261019/gen_import.py(改了口径重跑它,别手改本文件)
   ============================================================ */
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.bs_dc_device','U') IS NULL
BEGIN
  PRINT N'[SKIP] 本库没有 bs_dc_device(数采平台未建表),先执行 migrate-dc-platform-20261018.sql';
  RETURN;
END
IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
  PRINT N'[SKIP] 联网设备台账导入只针对测试账套 HSDZ_MES_TEST,当前库 = ' + DB_NAME();
  RETURN;
END
"""
    body = []
    body.append('/* ---------- 联网设备台账(按台展开;同批内完成自检,批中间不许 GO) ---------- */')
    for d, remark in lines:
        r = remark.replace("'", "''")
        n = d['name'].replace("'", "''")
        body.append(
            "IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'%s')\n"
            "INSERT INTO dbo.bs_dc_device (code, name, device_type, workshop, heartbeat_seconds, status, enabled, remark, asp_user1, asp_time1)\n"
            "VALUES (N'%s', N'%s', N'%s', NULL, 60, N'offline', 'Y', N'%s', N'migration', SYSDATETIME());"
            % (d['code'], d['code'], n, d['type'], r)
        )

    tail = f"""
/* ---------- 自检 ---------- */
DECLARE @total int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @imported int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE code LIKE N'LW-[0-9][0-9][0-9]' AND ISNULL(asp_cancel,'N') <> 'Y');
IF @imported <> {len(devices)}
  RAISERROR(N'[FAIL] 联网设备台账应为 {len(devices)} 条,实际 %d 条', 16, 1, @imported);
DECLARE @noType int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE code LIKE N'LW-%' AND ISNULL(device_type,'') = '');
IF @noType <> 0 RAISERROR(N'[FAIL] 有 %d 条联网设备缺设备类型', 16, 1, @noType);
RAISERROR(N'[OK] 联网设备台账导入 {len(devices)}/{len(devices)} 条(总数 %d 条:含电子秤/扫码枪/看板等既有设备)', 10, 1, @total) WITH NOWAIT;
GO
"""
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(head)
        f.write('\n')
        f.write('\n'.join(body))
        f.write(tail)
    print('wrote', os.path.abspath(OUT), 'devices', len(devices), 'rows', len(rows))
    for k, v in by_type.most_common():
        print(' type', k, v)
    for k, v in by_maker.most_common():
        print(' maker', k, v)


if __name__ == '__main__':
    main()
