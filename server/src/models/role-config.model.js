const mongoose = require('mongoose');

const ROLE_CODES = [
  'FRONTLINE', 'GRID_MANAGER', 'NETWORK_MANAGER', 'DISTRICT_MANAGER',
  'DEPT_MANAGER', 'LEVEL4_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR', 'ADMIN'
];
const VISIBILITY_SCOPES = ['all', 'area', 'grid', 'self', 'assigned'];

const roleConfigSchema = new mongoose.Schema({
  role:            { type: String, required: true, unique: true, enum: ROLE_CODES },
  label:           { type: String, required: true },
  visibilityScope: { type: String, required: true, enum: VISIBILITY_SCOPES, default: 'self' },
  description:     { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('RoleConfig', roleConfigSchema);
