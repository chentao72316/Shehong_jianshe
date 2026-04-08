const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createError } = require('../middleware/error-handler');
const { logger } = require('../utils/logger');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024;

// 确保上传目录存在
['images', 'files'].forEach(sub => {
  const dir = path.join(UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const sub = req.params.fileType === 'file' ? 'files' : 'images';
    cb(null, path.join(UPLOAD_DIR, sub));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const unique = `${crypto.randomUUID()}${ext}`;
    cb(null, unique);
  }
});

function fileFilter(req, file, cb) {
  const { fileType } = req.params;
  const ext = path.extname(file.originalname).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
  const docExts  = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.dwg', '.dwt', '.dxf'];
  const allowed  = imageExts.concat(docExts);
  const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']);
  const docMimes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/acad',
    'application/x-acad',
    'application/octet-stream'
  ]);

  if (fileType === 'file') {
    // 通用文件：图片 + 文档均可
    if (!allowed.includes(ext) || (!imageMimes.has(file.mimetype) && !docMimes.has(file.mimetype))) {
      return cb(createError(400, `不支持的文件格式，允许：${allowed.join(', ')}`));
    }
  } else {
    // 图片仅限图片格式
    if (!imageExts.includes(ext) || !imageMimes.has(file.mimetype)) {
      return cb(createError(400, '图片只支持 jpg/png/webp 格式'));
    }
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

/**
 * POST /api/upload/:fileType
 * fileType: 'image' | 'file'
 * 返回可访问的文件URL
 */
router.post('/upload/:fileType', (req, res, next) => {
  const { fileType } = req.params;
  if (!['image', 'file'].includes(fileType)) {
    return next(createError(400, 'fileType 必须为 image 或 file'));
  }

  upload.single('file')(req, res, err => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(createError(400, `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`));
      }
      return next(createError(400, err.message));
    }
    if (err) return next(err);
    if (!req.file) return next(createError(400, '未接收到文件'));

    const sub = fileType === 'file' ? 'files' : 'images';
    const url = `/uploads/${sub}/${req.file.filename}`;

    logger.info('文件上传成功', { url, uploader: req.user._id });
    res.json({ code: 0, data: { url, filename: req.file.originalname } });
  });
});

module.exports = router;
