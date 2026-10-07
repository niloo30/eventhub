import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadImageBuffer, isCloudinaryConfigured } from '../services/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (file.mimetype?.startsWith('image/')) {
    return cb(null, true);
  }

  const error = new Error('Please upload an image file.');
  error.status = 400;
  cb(error);
}

function buildLocalFilename(originalName) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName) || '.png';
  return `poster-${uniqueSuffix}${ext}`;
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export async function storeUploadedImage(file, options = {}) {
  if (!file) return null;

  if (isCloudinaryConfigured()) {
    const result = await uploadImageBuffer(file.buffer, {
      folder: options.folder,
      originalName: file.originalname,
    });

    return {
      provider: 'cloudinary',
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  const filename = buildLocalFilename(file.originalname);
  const destination = path.join(uploadsDir, filename);
  await fs.promises.writeFile(destination, file.buffer);

  return {
    provider: 'local',
    url: `/uploads/${filename}`,
    filename,
  };
}
