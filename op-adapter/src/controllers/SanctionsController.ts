import type { Request, Response } from 'express';
import logger from '../utils/logger.js';
import { UpstreamError } from '../services/SanctionsService.js';
import type SanctionsService from '../services/SanctionsService.js';
import { CheckSanctionsRequestDto, ValidationError } from '../application/dtos/requests/index.js';
import { CheckSanctionsResponseDto } from '../application/dtos/responses/index.js';

interface SanctionsControllerDeps {
  sanctionsService: SanctionsService;
}

export default class SanctionsController {
  private sanctionsService: SanctionsService;

  constructor({ sanctionsService }: SanctionsControllerDeps) {
    this.sanctionsService = sanctionsService;
  }

  getHealth = (_req: Request, res: Response): void => {
    logger.debug('Health check requested');
    res.json({ status: 'UP', service: 'op-adapter', mode: 'ES Modules + Retry' });
  };

  checkSanctions = async (req: Request, res: Response): Promise<Response | void> => {
    let requestDto: CheckSanctionsRequestDto;

    try {
      requestDto = CheckSanctionsRequestDto.fromRequest(req);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.warn(error.message, { requestId: req.headers['x-request-id'] });
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }

    logger.info('Received check request', {
      requestId: requestDto.requestId,
      name: requestDto.name,
      ...requestDto.getSearchParams(),
    });

    try {
      const { results, stats } = await this.sanctionsService.findEntities(
        requestDto.toServiceParams()
      );

      const responseDto = CheckSanctionsResponseDto.fromServiceResult({
        query: requestDto.name,
        searchParams: requestDto.getSearchParams(),
        results,
        stats,
      });

      res.json(responseDto.toJSON());
    } catch (error) {
      if (error instanceof UpstreamError) {
        const cause = error.cause instanceof Error ? error.cause.message : undefined;
        logger.error('Error connecting to Yente (after retries)', {
          requestId: requestDto.requestId,
          error: error.message,
          cause,
        });
        return res.status(502).json({
          error: 'Sanctions Service Unavailable',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error during check', {
        requestId: requestDto.requestId,
        error: message,
      });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
