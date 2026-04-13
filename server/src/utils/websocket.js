const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { logger } = require('./logger');
const User = require('../models/user.model');
const Demand = require('../models/demand.model');
const { canUserAccessDemand } = require('./demand-access');

let io = null;

// 角色房间映射
const ROLE_ROOMS = {
  ADMIN: 'admin',
  GRID_MANAGER: 'grid_manager',
  NETWORK_MANAGER: 'network_manager',
  FRONTLINE: 'frontline',
  DISTRICT_MANAGER: 'district_manager',
  DEPT_MANAGER: 'dept_manager',
  LEVEL4_MANAGER: 'level4_manager',
  DESIGN: 'design',
  CONSTRUCTION: 'construction',
  SUPERVISOR: 'supervisor'
};

/**
 * 初始化WebSocket服务
 * @param {http.Server} server - HTTP服务器实例
 */
function initWebSocket(server) {
  const corsOrigin = process.env.WS_CORS_ORIGIN
    ? process.env.WS_CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
    : false;
  io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    path: '/ws'
  });

  // JWT鉴权中间件
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('未提供认证令牌'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId).lean();
      if (!user || !user.active) {
        return next(new Error('用户不存在或已被禁用'));
      }
      socket.user = user;
      next();
    } catch (err) {
      logger.warn('WebSocket Token验证失败', { error: err.message });
      next(new Error('令牌无效或已过期'));
    }
  });

  io.on('connection', (socket) => {
    const { roles = [] } = socket.user;
    const userId = String(socket.user._id);
    const role = roles[0] || null;
    logger.info(`WebSocket连接: userId=${userId}, role=${role}`);

    // 按主角色加入房间
    if (role && ROLE_ROOMS[role]) {
      socket.join(ROLE_ROOMS[role]);
    }
    // 按所有角色加入房间
    roles.forEach(r => {
      if (ROLE_ROOMS[r]) {
        socket.join(ROLE_ROOMS[r]);
      }
    });
    // 加入用户专属房间（用于点对点消息推送）
    socket.join(`user:${userId}`);
    // 加入公共房间（所有认证用户）
    socket.join('authenticated');

    // 订阅工单详情更新
    socket.on('subscribe_demand', async (demandId) => {
      try {
        const demand = await Demand.findById(demandId).lean();
        if (!await canUserAccessDemand(socket.user, demand)) {
          logger.warn('WebSocket订阅被拒绝', { userId, demandId });
          return;
        }
        socket.join(`demand:${demandId}`);
        logger.info(`用户 ${userId} 订阅工单 ${demandId}`);
      } catch (err) {
        logger.warn('WebSocket订阅校验失败', { userId, demandId, error: err.message });
      }
    });

    // 取消订阅工单
    socket.on('unsubscribe_demand', (demandId) => {
      socket.leave(`demand:${demandId}`);
      logger.info(`用户 ${userId} 取消订阅工单 ${demandId}`);
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`WebSocket断开: userId=${userId}`);
    });
  });

  logger.info('WebSocket服务已初始化');
  return io;
}

/**
 * 获取IO实例
 */
function getIO() {
  return io;
}

/**
 * 广播工单状态变更
 * @param {string} demandId - 工单ID
 * @param {object} data - 变更数据
 */
async function broadcastDemandUpdate(demandId, data) {
  if (!io) return;

  // 通知订阅该工单的所有用户
  io.to(`demand:${demandId}`).emit('demand_update', data);

  // 仅向明确相关人员点对点推送，避免按角色房间泄露非本人指派工单
  try {
    const demand = await Demand.findById(demandId)
      .select('createdBy assignedDesignUnit assignedConstructionUnit assignedSupervisor assignedDesignUnits assignedConstructionUnits assignedSupervisors crossAreaReviewerId')
      .lean();
    const recipients = new Set([
      demand?.createdBy,
      demand?.assignedDesignUnit,
      demand?.assignedConstructionUnit,
      demand?.assignedSupervisor,
      ...(demand?.assignedDesignUnits || []),
      ...(demand?.assignedConstructionUnits || []),
      ...(demand?.assignedSupervisors || []),
      demand?.crossAreaReviewerId,
      data.createdBy,
      data.assignedDesignUnit,
      data.assignedConstructionUnit,
      data.assignedSupervisor,
      ...(data.assignedDesignUnits || []),
      ...(data.assignedConstructionUnits || []),
      ...(data.assignedSupervisors || []),
      data.crossAreaReviewerId
    ].filter(Boolean).map(id => String(id)));

    recipients.forEach(userId => {
      io.to(`user:${userId}`).emit('demand_update', data);
    });
  } catch (err) {
    logger.warn('工单点对点广播失败', { demandId, error: err.message });
  }

  logger.info(`工单${demandId}状态变更广播`, { status: data.status });
}

/**
 * 发送消息给特定用户
 * @param {string} userId - 用户ID
 * @param {string} event - 事件名
 * @param {object} data - 数据
 */
function sendToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * 广播系统消息给所有用户
 * @param {object} data - 消息数据
 */
function broadcastSystemMessage(data) {
  if (!io) return;
  io.to('authenticated').emit('system_message', data);
}

module.exports = {
  initWebSocket,
  getIO,
  broadcastDemandUpdate,
  sendToUser,
  broadcastSystemMessage,
  ROLE_ROOMS
};
