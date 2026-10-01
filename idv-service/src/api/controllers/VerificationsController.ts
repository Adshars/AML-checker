import type { Request, Response } from 'express';
import { CreateVerificationDto } from '../../application/dtos/requests/CreateVerificationDto.js';
import { ListVerificationsQueryDto } from '../../application/dtos/requests/ListVerificationsQueryDto.js';
import { ReviewVerificationDto } from '../../application/dtos/requests/ReviewVerificationDto.js';
import type { ImageKind, VerificationService } from '../../application/services/VerificationService.js';
import { NotFoundError } from '../../shared/errors/index.js';
import type { RequestContext } from '../middlewares/requestContext.js';

const IMAGE_KINDS: readonly string[] = ['document', 'selfie'];

/**
 * Verifications Controller
 * Authenticated endpoints (B2B API key and panel users); errors go to the error handler
 */
export class VerificationsController {
  verificationService: VerificationService;

  constructor(verificationService: VerificationService) {
    this.verificationService = verificationService;
  }

  /**
   * POST /verifications (API key)
   */
  create = async (req: Request, res: Response): Promise<void> => {
    const dto = CreateVerificationDto.fromRequest(req.body);
    const created = await this.verificationService.create(req.ctx as RequestContext, dto);
    res.status(201).json(created);
  };

  /**
   * POST /verifications/demo (user session)
   */
  createDemo = async (req: Request, res: Response): Promise<void> => {
    const created = await this.verificationService.createDemo(req.ctx as RequestContext);
    res.status(201).json(created);
  };

  /**
   * GET /verifications
   */
  list = async (req: Request, res: Response): Promise<void> => {
    const query = ListVerificationsQueryDto.fromRequest(req);
    const response = await this.verificationService.list(req.ctx as RequestContext, query);
    res.json(response.toJSON());
  };

  /**
   * GET /verifications/:id
   */
  getDetails = async (req: Request, res: Response): Promise<void> => {
    const details = await this.verificationService.getDetails(req.ctx as RequestContext, String(req.params.id));
    res.json(details);
  };

  /**
   * GET /verifications/:id/images/:kind (kind = document | selfie)
   */
  getImage = async (req: Request, res: Response): Promise<void> => {
    const kind = String(req.params.kind);
    if (!IMAGE_KINDS.includes(kind)) {
      throw new NotFoundError('Image not available');
    }
    const image = await this.verificationService.getImage(req.ctx as RequestContext, String(req.params.id), kind as ImageKind);
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Cache-Control', 'no-store');
    res.send(image.data);
  };

  /**
   * POST /verifications/:id/review (user session)
   */
  review = async (req: Request, res: Response): Promise<void> => {
    const dto = ReviewVerificationDto.fromRequest(req.body);
    const details = await this.verificationService.review(req.ctx as RequestContext, String(req.params.id), dto);
    res.json(details);
  };
}

export default VerificationsController;
