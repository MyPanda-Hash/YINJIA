using System;
using System.Text.RegularExpressions;
class T {
  static void Main() {
    string n1 = "生产领料·组装工艺清单 AP-REAL-016(用量 1 × 工单 600 = 需求 600)";
    string n2 = "生产领料·组装工艺清单 AP-REAL-016(用量 1 × 工单 600 = 需求 600); 领料批次:无批次=600.0";
    var p = new Regex("\\(需求\\s*([0-9]+(?:\\.[0-9]+)?)\\s*\\)");
    var p2 = new Regex("需求\\s*([0-9]+(?:\\.[0-9]+)?)\\s*\\)");
    Console.WriteLine("严格 n1: " + p.IsMatch(n1));
    Console.WriteLine("严格 n2: " + p.IsMatch(n2));
    Console.WriteLine("放宽 n1: " + p2.IsMatch(n1) + " -> " + (p2.IsMatch(n1) ? p2.Match(n1).Groups[1].Value : "-"));
    Console.WriteLine("放宽 n2: " + p2.IsMatch(n2) + " -> " + (p2.IsMatch(n2) ? p2.Match(n2).Groups[1].Value : "-"));
  }
}
