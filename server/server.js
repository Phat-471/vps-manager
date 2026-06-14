const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Đọc và nạp biến môi trường từ file .env cục bộ
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (err) {
  console.error('Lỗi khi đọc tệp tin .env:', err.message);
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Import routes
const vpsRoutes = require('./routes/vps');
const systemRoutes = require('./routes/system');
const fileRoutes = require('./routes/files');
const serviceRoutes = require('./routes/services');
const softwareRoutes = require('./routes/software');
const applicationRoutes = require('./routes/applications');
const scriptRoutes = require('./routes/scripts');
const webserverRoutes = require('./routes/webserver');
const mysqlRoutes = require('./routes/mysql');
const securityRoutes = require('./routes/security');
const dockerRoutes = require('./routes/docker');
const authRoutes = require('./routes/auth');
const cronRoutes = require('./routes/cron');
const backupRoutes = require('./routes/backup');
const statsRoutes = require('./routes/stats');
const alertsRoutes = require('./routes/alerts');
const phpRoutes = require('./routes/php');
const nodeRoutes = require('./routes/node');
const mailRoutes = require('./routes/mail');
const installerRoutes = require('./routes/installer');

// API Routes (Tuyến đường mở cho Auth)
app.use('/api/auth', authRoutes);

// Middleware bảo mật xác thực toàn bộ API của Panel
const AuthController = require('./controllers/AuthController');
app.use('/api', (req, res, next) => {
  if (!process.env.PANEL_PASSWORD) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Thiếu token đăng nhập' });
  }
  const token = authHeader.split(' ')[1];
  if (AuthController.verifyToken(token)) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized: Phiên làm việc hết hạn hoặc không hợp lệ' });
});

// API Routes (Các tuyến đường được bảo vệ)
app.use('/api/vps', vpsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/software', softwareRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/webserver', webserverRoutes);
app.use('/api/mysql', mysqlRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/php', phpRoutes);
app.use('/api/node', nodeRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/installer', installerRoutes);

// Socket.IO for real-time features
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Terminal session
  socket.on('terminal:create', (vpsConfig) => {
    const terminalHandler = require('./handlers/terminal');
    terminalHandler.create(socket, vpsConfig);
  });

  // Task execution session
  socket.on('task:run', (payload) => {
    const taskRunner = require('./handlers/taskRunner');
    taskRunner.start(socket, payload);
  });

  socket.on('task:stop', () => {
    const taskRunner = require('./handlers/taskRunner');
    taskRunner.stop(socket);
  });

  // System monitoring
  socket.on('monitor:start', (vpsConfig) => {
    const monitorHandler = require('./handlers/monitor');
    monitorHandler.start(socket, vpsConfig);
  });

  socket.on('monitor:stop', () => {
    const monitorHandler = require('./handlers/monitor');
    monitorHandler.stop(socket);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up resources
    const monitorHandler = require('./handlers/monitor');
    monitorHandler.stop(socket);
    const taskRunner = require('./handlers/taskRunner');
    taskRunner.stop(socket);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found'
    });
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 VPS Management Tool đang chạy tại http://localhost:${PORT}`);
  console.log(`📡 WebSocket server đã sẵn sàng`);
  
  // Khởi động Alert & Monitoring Daemon chạy ngầm
  const alertDaemon = require('./utils/alertDaemon');
  alertDaemon.init();
});

module.exports = { app, io };
