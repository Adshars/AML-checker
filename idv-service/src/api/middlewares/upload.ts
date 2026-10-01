import multer from 'multer';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ImageMime } from '../../domain/providers/IIdentityProvider.js';
import { FileTooLargeError, UnsupportedMediaTypeError, ValidationError } from '../../shared/errors/index.js';

export const MAX_FILE_MB = 10;

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Image type from the file content — the declared Content-Type and extension are ignored
 */
export const detectImageMime = (data: Buffer): ImageMime | null => {
  if (data.length >= JPEG_MAGIC.length && data.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) return 'image/jpeg';
  if (data.length >= PNG_MAGIC.length && data.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return 'image/png';
  return null;
};

export interface UploadedImage {
  buffer: Buffer;
  mime: ImageMime;
}

/**
 * Single image field kept in memory (never written to disk unencrypted)
 */
export const uploadImage = (field: 'document' | 'selfie'): RequestHandler => {
  const handler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 }
  }).single(field);

  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        next(err.code === 'LIMIT_FILE_SIZE'
          ? new FileTooLargeError(MAX_FILE_MB)
          : new ValidationError(`Upload a single image in the "${field}" field`));
        return;
      }
      if (err) {
        next(err);
        return;
      }
      if (!req.file) {
        next(new ValidationError(`Upload a single image in the "${field}" field`));
        return;
      }
      const mime = detectImageMime(req.file.buffer);
      if (!mime) {
        next(new UnsupportedMediaTypeError());
        return;
      }
      res.locals.image = { buffer: req.file.buffer, mime } satisfies UploadedImage;
      next();
    });
  };
};
