import net from 'net';
import type { Request, Response } from 'express';
import type { PublicSessionService } from '../../application/services/PublicSessionService.js';
import type { UploadedImage } from '../middlewares/upload.js';

/**
 * Customer IP for the consent record: the entry appended by api-gateway (last in X-Forwarded-For)
 */
export const clientIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  const chain = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidate = (chain[chain.length - 1] ?? req.ip ?? req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
  return net.isIP(candidate) ? candidate : null;
};

/**
 * Public Session Controller — customer verification page (token in the URL, no auth)
 */
export class PublicSessionController {
  publicSessionService: PublicSessionService;

  constructor(publicSessionService: PublicSessionService) {
    this.publicSessionService = publicSessionService;
  }

  /**
   * GET /public/sessions/:token
   */
  getSession = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.publicSessionService.getSession(String(req.params.token)));
  };

  /**
   * POST /public/sessions/:token/start { consent: true }
   */
  start = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.publicSessionService.start(String(req.params.token), clientIp(req)));
  };

  /**
   * POST /public/sessions/:token/document (multipart "document")
   */
  uploadDocument = async (req: Request, res: Response): Promise<void> => {
    const image = res.locals.image as UploadedImage;
    res.json(await this.publicSessionService.uploadDocument(String(req.params.token), image));
  };

  /**
   * POST /public/sessions/:token/selfie (multipart "selfie")
   */
  uploadSelfie = async (req: Request, res: Response): Promise<void> => {
    const image = res.locals.image as UploadedImage;
    res.json(await this.publicSessionService.uploadSelfie(String(req.params.token), image));
  };
}

export default PublicSessionController;
