/**
 * 人员批量导入脚本
 *
 * 数据来源（三个 CSV 均位于项目根目录）：
 *   - 员工信息管理.csv   — 自有人员基础信息
 *   - 合作单位信息管理.csv — 设计/施工/监理外协人员
 *   - 处理组配置.csv     — 各受理区域的角色分工（用于确定 GRID_MANAGER / NETWORK_MANAGER 等）
 *
 * 角色映射规则：
 *   受理区域负责人 → GRID_MANAGER
 *   网络负责人     → NETWORK_MANAGER
 *   设计人员       → DESIGN
 *   施工人员       → CONSTRUCTION
 *   监理人员       → SUPERVISOR
 *   其余自有人员   → FRONTLINE
 *
 * 运行方式（在 server 目录下）：
 *   node scripts/import-staff.js
 *
 * 已存在手机号的记录将更新（upsert），不会重复插入。
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../src/models/user.model');

// CSV 文件路径（相对于项目根目录）
const ROOT = path.resolve(__dirname, '../..');
const STAFF_CSV      = path.join(ROOT, 'SHYD(JK建设APP) _员工信息管理.csv');
const PARTNER_CSV    = path.join(ROOT, 'SHYD(JK建设APP) _合作单位信息管理.csv');
const PROCESS_CSV    = path.join(ROOT, 'SHYD(JK建设APP) _处理组配置.csv');

// ─── CSV 解析工具 ───────────────────────────────────────────────
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // 去 BOM
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    return row;
  }).filter(row => row[headers[0]]); // 过滤空行
}

// ─── 从处理组配置构建角色映射 ───────────────────────────────────
// 返回 Map<姓名, { roles: string[], gridName: string }>
function buildRoleMap(processCsv) {
  const map = new Map();

  const addRole = (name, role, gridName) => {
    if (!name) return;
    const existing = map.get(name) || { roles: new Set(), gridName: '' };
    existing.roles.add(role);
    if (!existing.gridName) existing.gridName = gridName;
    map.set(name, existing);
  };

  for (const row of processCsv) {
    const serviceArea    = row['受理区域'] || '';
    const networkSupport = row['网络支撑'] || '';

    addRole(row['受理区域负责人'], 'GRID_MANAGER',    serviceArea);
    addRole(row['网络负责人'],     'NETWORK_MANAGER', networkSupport);
    addRole(row['设计人员'],       'DESIGN',          row['单位'] || '');
    addRole(row['施工人员'],       'CONSTRUCTION',    row['单位'] || '');
    addRole(row['监理人员'],       'SUPERVISOR',      row['单位'] || '');
  }

  // 将 Set 转为数组
  const result = new Map();
  for (const [name, val] of map) {
    result.set(name, { roles: [...val.roles], gridName: val.gridName });
  }
  return result;
}

// ─── 主流程 ────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB 已连接');

  const processCsv = parseCsv(PROCESS_CSV);
  const roleMap    = buildRoleMap(processCsv);

  const staffCsv   = parseCsv(STAFF_CSV);
  const partnerCsv = parseCsv(PARTNER_CSV);

  const users = [];

  // 自有人员
  for (const row of staffCsv) {
    const name  = row['姓名'];
    const phone = row['电话'];
    if (!name || !phone) continue;

    const roleInfo = roleMap.get(name);
    users.push({
      name,
      phone,
      feishuId:   row['飞书账号'] || '',
      wxAccount:  row['微信账号'] || '',
      area:       row['单位']     || '射洪',
      gridName:   roleInfo?.gridName || row['部门'] || '',
      employeeId: row['工号']     || '',
      staffType:  row['人员属性'] || '自有',
      roles:      roleInfo?.roles || ['FRONTLINE'],
    });
  }

  // 合作单位人员（设计/施工/监理）
  const partnerRoleMap = {
    '设计单位': 'DESIGN',
    '施工单位': 'CONSTRUCTION',
    '监理单位': 'SUPERVISOR',
  };
  for (const row of partnerCsv) {
    const name  = row['姓名'];
    const phone = row['电话'];
    if (!name || !phone) continue;

    const roleKey  = partnerRoleMap[row['单位属性']];
    const roleInfo = roleMap.get(name);
    users.push({
      name,
      phone,
      feishuId:  row['飞书账号'] || '',
      wxAccount: row['微信账号'] || '',
      area:      row['单位']     || '',
      gridName:  row['队/组名']  || '',
      staffType: row['单位属性'] || '',
      roles:     roleInfo?.roles || (roleKey ? [roleKey] : ['FRONTLINE']),
    });
  }

  // Upsert 写入数据库
  let inserted = 0, updated = 0, skipped = 0;
  for (const u of users) {
    if (!u.phone) { skipped++; continue; }
    const result = await User.findOneAndUpdate(
      { phone: u.phone },
      {
        $set: {
          name:       u.name,
          feishuId:   u.feishuId,
          wxAccount:  u.wxAccount,
          area:       u.area,
          gridName:   u.gridName,
          employeeId: u.employeeId || '',
          staffType:  u.staffType,
          roles:      u.roles,
          active:     true,
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
      inserted++;
    } else {
      updated++;
    }
    console.log(`[${u.roles.join('/')}] ${u.name} ${u.phone} → ${u.area} ${u.gridName}`);
  }

  console.log(`\n导入完成：新增 ${inserted} 人，更新 ${updated} 人，跳过 ${skipped} 条`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('导入失败:', err.message);
  process.exit(1);
});
