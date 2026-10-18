// _WhoHolds.cs — 找出占着某端口/某文件的进程(本机 Get-CimInstance/Get-Process 在沙箱里看不见时用)
// 放 PowerShell 侧: Add-Type 编译后调用;参数: 端口号 [文件路径]
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class WhoHolds {
    [DllImport("iphlpapi.dll", SetLastError = true)]
    static extern int GetExtendedTcpTable(IntPtr pTcpTable, ref int dwSize, bool bOrder, int ulAf, int tableClass, uint reserved);

    public static List<int> PortOwners(int port) {
        var owners = new List<int>();
        int size = 0;
        GetExtendedTcpTable(IntPtr.Zero, ref size, false, 2 /*AF_INET*/, 3 /*OWNER_PID_LISTENER*/, 0);
        IntPtr buf = Marshal.AllocHGlobal(size);
        try {
            int r = GetExtendedTcpTable(buf, ref size, false, 2, 3, 0);
            if (r != 0) return owners;
            int n = Marshal.ReadInt32(buf);
            IntPtr row = IntPtr.Add(buf, 4);
            for (int i = 0; i < n; i++) {
                int lp = Marshal.ReadInt32(row, 8);       // dwLocalPort(网络序,低 16 位)
                int p = ((lp & 0xFF) << 8) + ((lp >> 8) & 0xFF);
                int pid = Marshal.ReadInt32(row, 20);
                if (p == port) owners.Add(pid);
                row = IntPtr.Add(row, 24);
            }
        } finally { Marshal.FreeHGlobal(buf); }
        return owners;
    }

    public static string Describe(int pid) {
        try {
            var p = Process.GetProcessById(pid);
            return p.Id + " " + p.ProcessName + " mem=" + (p.WorkingSet64 / 1048576) + "MB started=" +
                   (p.StartTime == DateTime.MinValue ? "?" : p.StartTime.ToString("s"));
        } catch (Exception e) { return pid + " (无法打开: " + e.GetType().Name + ")"; }
    }
}
