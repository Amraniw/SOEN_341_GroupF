const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPLOAD_DIRECTORY = path.join(
  __dirname,
  '..',
  '..',
  'uploads',
  'resumes'
);

class UnsupportedResumeTypeError extends Error {
  constructor() {
    super('Only PDF resumes are accepted.');
    this.name = 'UnsupportedResumeTypeError';
  }
}

function createResumeUpload(uploadDirectory = DEFAULT_UPLOAD_DIRECTORY) {
  const storage = multer.diskStorage({
    destination(request, file, callback) {
      fs.mkdir(uploadDirectory, { recursive: true }, (error) => {
        callback(error, uploadDirectory);
      });
    },
    filename(request, file, callback) {
      callback(null, `${crypto.randomUUID()}.pdf`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: MAX_RESUME_SIZE_BYTES,
      files: 1,
      fields: 0,
      parts: 1,
    },
    fileFilter(request, file, callback) {
      const extension = path.extname(file.originalname).toLowerCase();
      const isPdf = extension === '.pdf' && file.mimetype === 'application/pdf';

      if (!isPdf) {
        return callback(new UnsupportedResumeTypeError());
      }

      return callback(null, true);
    },
  });
}

module.exports = {
  DEFAULT_UPLOAD_DIRECTORY,
  MAX_RESUME_SIZE_BYTES,
  UnsupportedResumeTypeError,
  createResumeUpload,
};
