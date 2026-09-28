import Joi from 'joi';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { VERIFICATION_STATUSES, REVIEW_COMMENT_MAX, REVIEW_COMMENT_MIN } from '../../domain/entities/Verification.js';
import { ValidationError } from '../../shared/errors/index.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * https only; plain http is accepted for localhost outside production (development)
 */
const redirectUrlRule: Joi.CustomValidator<string> = (value, helpers) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return helpers.error('redirectUrl.invalid');
  }
  if (url.protocol === 'https:') return value;
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname) && process.env.NODE_ENV !== 'production') {
    return value;
  }
  return helpers.error('redirectUrl.invalid');
};

const optionalText = (max: number) => Joi.string().trim().max(max).allow('', null);

export const createVerificationSchema = Joi.object({
  externalRef: optionalText(100),
  customerName: optionalText(200),
  redirectUrl: Joi.string().trim().max(2000).allow('', null).custom(redirectUrlRule).messages({
    'redirectUrl.invalid': 'redirectUrl must be a valid https:// URL'
  })
});

export const listVerificationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  status: Joi.string().valid(...VERIFICATION_STATUSES),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  search: Joi.string().trim().max(100).allow(''),
  includeDemo: Joi.boolean()
});

export const reviewSchema = Joi.object({
  decision: Joi.string().valid('APPROVE', 'REJECT').required(),
  comment: Joi.when('decision', {
    is: 'REJECT',
    then: Joi.string().trim().min(REVIEW_COMMENT_MIN).max(REVIEW_COMMENT_MAX).required().messages({
      'any.required': 'A comment is required to reject',
      'string.empty': 'A comment is required to reject'
    }),
    otherwise: optionalText(REVIEW_COMMENT_MAX)
  })
});

const toValidationError = (error: Joi.ValidationError): ValidationError =>
  new ValidationError(error.details[0].message, error.details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message
  })));

/**
 * Validate the request body (DTOs read the same body afterwards)
 */
export const validateBody = (schema: Joi.Schema): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body ?? {}, { abortEarly: false });
    next(error ? toValidationError(error) : undefined);
  };

/**
 * Validate query parameters
 */
export const validateQuery = (schema: Joi.Schema): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    next(error ? toValidationError(error) : undefined);
  };
