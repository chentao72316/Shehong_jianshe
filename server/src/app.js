require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { logger } = require('./utils/logger');

const authRouter = require('./routes/auth');
const demandRouter = require('./routes/demand');
const designRouter = require('./routes/design');
const constructionRouter = require('./routes/construction');
const supervisorRouter = require('./routes/supervisor');
const timeoutRouter = require('./routes/timeout');
const messageRouter = require('./routes/message');
const statsRouter = require('./routes/stats');
const adminRouter = require('./routes/admin');
const uploadRouter = require('./routes/upload');
const interveneRouter = require('./routes/intervene');
const configRouter = require('./routes/config');
const areaConfigRouter = require('./routes/area-config');
const roleConfigRouter = require('./routes/role-config');
const askRouter = require('./routes/ask');

const announcementRouter = require('./routes/announcement');

const { authenticate } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件（上传资源 + PC上传页面）
app.use('/uploads', express.static('uploads', {
  dotfiles: 'deny',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
app.use(express.static(path.join(__dirname, '../public')));

// 健康检查（无需认证）
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 公开路由
app.use('/api', authRouter);

// 需要认证的路由
app.use('/api', authenticate, demandRouter);
app.use('/api', authenticate, designRouter);
app.use('/api', authenticate, constructionRouter);
app.use('/api', authenticate, supervisorRouter);
app.use('/api', authenticate, timeoutRouter);
app.use('/api', authenticate, messageRouter);
app.use('/api', authenticate, statsRouter);
app.use('/api', authenticate, adminRouter);
app.use('/api', authenticate, uploadRouter);
app.use('/api', authenticate, interveneRouter);
app.use('/api', authenticate, configRouter);
app.use('/api', authenticate, areaConfigRouter);
app.use('/api', authenticate, roleConfigRouter);
app.use('/api', authenticate, announcementRouter);
app.use('/api', authenticate, askRouter);

// DEV-ONLY: 测试工具路由，必须显式开启
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_ROUTES === 'true') {
  const devTestRouter = require('./routes/dev-test');
  app.use('/api', devTestRouter);
  logger.warn('⚠️  DEV-ONLY test routes are active (/api/dev/*). Remove before production!');
}

// 统一错误处理
app.use(errorHandler);

// 连接数据库并启动
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB connected');

    // 初始化系统配置
    const { initSystemConfig } = require('./config/init');
    await initSystemConfig();

    // 初始化角色默认配置
    const { seedRoleConfig } = require('./config/seed-role-config');
    await seedRoleConfig();

    // 启动超时检查调度器：按北京时间固定批次发送，检查间隔由 AUTO_REMINDER_CONFIG 控制
    const { startAutoReminderScheduler } = require('./services/auto-reminder.service');
    startAutoReminderScheduler();

    // 创建HTTP服务器并初始化WebSocket
    const server = http.createServer(app);
    const { initWebSocket } = require('./utils/websocket');
    initWebSocket(server);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

start();

module.exports = app;
