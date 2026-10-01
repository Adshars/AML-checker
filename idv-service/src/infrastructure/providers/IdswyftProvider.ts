import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import FormData from 'form-data';
import net from 'net';
import logger from '../../shared/logger/index.js';
import { ProviderUnavailableError } from '../../shared/errors/index.js';
import type { OcrData, ProviderOutcome } from '../../domain/entities/Verification.js';
import type {
  DocumentOutcome,
  IIdentityProvider,
  InitializeParams,
  ProviderImage,
  ProviderResult,
  SelfieOutcome
} from '../../domain/providers/IIdentityProvider.js';

// Response contract of idswyft-community 1.12.32 (commit 198760e), mapped from its source:
// routes/newVerification.js (initialize, front-document, live-capture), verification/statusReader.js
// (GET status), @idswyft/shared verification/models/schemas.js (OCR and result shapes).
// Fixtures in tests/fixtures/idswyft/ follow the same contract.

type Json = Record<string, unknown>;

export interface IdswyftProviderOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  /**
   * idswyft flags steps closer than 2 s as "bot_like_timing" (forces manual review), measured
   * between the end of initialize / front-document and the end of the next step
   */
  minStepGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const NO_FACE_REASON = 'FACE_NOT_DETECTED';

const str = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const obj = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {});

/**
 * ocr_data = engine OCR result: canonical fields plus the raw engine fields
 * (name, document_number, expiration_date, confidence_scores, detected_document_type)
 */
export const mapOcr = (ocrData: unknown, detectedDocumentType?: unknown): OcrData => {
  const ocr = obj(ocrData);
  const scores = Object.values(obj(ocr.confidence_scores)).filter((value): value is number => typeof value === 'number');
  return {
    fullName: str(ocr.full_name) ?? str(ocr.name),
    dateOfBirth: str(ocr.date_of_birth),
    documentNumber: str(ocr.id_number) ?? str(ocr.document_number),
    expiryDate: str(ocr.expiry_date) ?? str(ocr.expiration_date),
    nationality: str(ocr.nationality),
    issuingCountry: str(ocr.issuing_country),
    documentType: str(ocr.detected_document_type) ?? str(detectedDocumentType),
    // Same formula as the engine's ocr_confidence (average of per-field confidence)
    ocrConfidence: scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null
  };
};

const FINAL_RESULTS: Record<string, ProviderOutcome> = {
  verified: 'VERIFIED',
  failed: 'REJECTED',
  manual_review: 'MANUAL_REVIEW'
};

/**
 * manual_review_reason is free text — reduce it to a code for the panel
 */
export const toReviewReason = (manualReviewReason: unknown): string => {
  const text = str(manualReviewReason) ?? '';
  if (text.startsWith('Face match skipped')) return 'FACE_MATCH_SKIPPED';
  if (text.startsWith('Velocity flags')) return 'VELOCITY_FLAGS';
  if (text.startsWith('Geo flags')) return 'GEO_FLAGS';
  if (text.startsWith('Cross-validation')) return 'CROSS_VALIDATION_REVIEW';
  if (text.startsWith('Duplicate')) return 'DUPLICATE_DETECTED';
  return 'PROVIDER_REVIEW';
};

/**
 * idswyft-community (self-hosted) — identity mode: front document OCR + passive liveness + face match
 */
export class IdswyftProvider implements IIdentityProvider {
  readonly name = 'idswyft';
  private http: AxiosInstance;
  private minStepGapMs: number;
  private sleep: (ms: number) => Promise<void>;
  private lastStepAt = new Map<string, number>();

  constructor(options: IdswyftProviderOptions) {
    this.http = axios.create({
      baseURL: `${options.baseUrl.replace(/\/+$/, '')}/api/v2/verify`,
      timeout: options.timeoutMs,
      headers: { 'X-API-Key': options.apiKey },
      // Status codes are interpreted below; no automatic retries on POST
      validateStatus: () => true,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    this.minStepGapMs = options.minStepGapMs ?? 2100;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async waitForStepGap(providerVerificationId: string): Promise<void> {
    const last = this.lastStepAt.get(providerVerificationId);
    if (last === undefined) return;
    const wait = last + this.minStepGapMs - Date.now();
    if (wait > 0) await this.sleep(wait);
  }

  private async send(step: string, request: () => Promise<AxiosResponse>): Promise<AxiosResponse> {
    const started = Date.now();
    let response: AxiosResponse;
    try {
      response = await request();
    } catch (error) {
      const code = (error as { code?: string }).code;
      logger.warn('idswyft request failed', { step, error: code || (error instanceof Error ? error.message : 'unknown') });
      throw new ProviderUnavailableError(code === 'ECONNABORTED' || code === 'ETIMEDOUT'
        ? 'Identity verification provider timed out'
        : undefined);
    }
    logger.info('idswyft response', { step, status: response.status, durationMs: Date.now() - started });
    return response;
  }

  private unexpected(step: string, response: AxiosResponse): ProviderUnavailableError {
    // Body is not logged — it may contain personal data
    logger.error('idswyft unexpected response', { step, status: response.status });
    return new ProviderUnavailableError();
  }

  private upload(field: 'document' | 'selfie', { file, mime }: ProviderImage): FormData {
    const form = new FormData();
    form.append(field, file, { filename: `${field}.${mime === 'image/png' ? 'png' : 'jpg'}`, contentType: mime });
    return form;
  }

  async initialize({ verificationId, sessionNumber, clientIp }: InitializeParams): Promise<{ providerVerificationId: string }> {
    const headers: Record<string, string> = { 'Idempotency-Key': `${verificationId}-initialize-${sessionNumber}` };
    // idswyft trusts one proxy hop — velocity and geo checks then use the customer IP, not ours
    if (clientIp && net.isIP(clientIp)) headers['X-Forwarded-For'] = clientIp;

    const response = await this.send('initialize', () => this.http.post('/initialize', {
      user_id: verificationId,
      verification_mode: 'identity',
      document_type: 'auto'
    }, { headers }));

    const providerVerificationId = str(obj(response.data).verification_id);
    if (response.status !== 201 || !providerVerificationId) {
      throw this.unexpected('initialize', response);
    }
    this.lastStepAt.set(providerVerificationId, Date.now());
    return { providerVerificationId };
  }

  async submitDocument(image: ProviderImage): Promise<DocumentOutcome> {
    const { providerVerificationId } = image;
    await this.waitForStepGap(providerVerificationId);

    const form = this.upload('document', image);
    form.append('document_type', 'auto');
    const response = await this.send('front-document', () => this.http.post(`/${providerVerificationId}/front-document`, form, {
      headers: { ...form.getHeaders(), 'Idempotency-Key': `${providerVerificationId}-front-document` }
    }));
    this.lastStepAt.set(providerVerificationId, Date.now());

    const data = obj(response.data);
    // FileUploadError — the engine could not decode the image
    if (response.status === 400) {
      return { accepted: false, reason: 'INVALID_IMAGE', retryable: true, raw: data };
    }
    if (response.status !== 200) {
      throw this.unexpected('front-document', response);
    }

    // Gate 1 rejection (FRONT_OCR_FAILED / FRONT_LOW_CONFIDENCE) ends the provider session;
    // the customer retakes the photo and we open a new session
    if (data.final_result === 'failed' || data.status === 'HARD_REJECTED') {
      return { accepted: false, reason: str(data.rejection_reason), retryable: true, raw: data };
    }

    return {
      accepted: true,
      ocr: mapOcr(data.ocr_data, data.detected_document_type),
      // Tamper detection result is not exposed by the API
      authenticity: null,
      raw: data
    };
  }

  async submitSelfie(image: ProviderImage): Promise<SelfieOutcome> {
    const { providerVerificationId } = image;
    await this.waitForStepGap(providerVerificationId);

    const form = this.upload('selfie', image);
    const response = await this.send('live-capture', () => this.http.post(`/${providerVerificationId}/live-capture`, form, {
      headers: { ...form.getHeaders(), 'Idempotency-Key': `${providerVerificationId}-live-capture` }
    }));
    this.lastStepAt.set(providerVerificationId, Date.now());

    const data = obj(response.data);
    if (response.status === 400) {
      return { final: false, reason: 'INVALID_IMAGE' };
    }
    if (response.status !== 200) {
      throw this.unexpected('live-capture', response);
    }

    // Gate 4: no face → the customer may take another selfie (in a new provider session).
    // Liveness and face match failures are final results.
    if (data.final_result === 'failed' && data.rejection_reason === NO_FACE_REASON) {
      return { final: false, reason: NO_FACE_REASON };
    }
    return { final: true };
  }

  async getResult({ providerVerificationId }: { providerVerificationId: string }): Promise<ProviderResult> {
    const response = await this.send('status', () => this.http.get(`/${providerVerificationId}/status`));
    if (response.status !== 200) {
      throw this.unexpected('status', response);
    }
    this.lastStepAt.delete(providerVerificationId);

    // final_result reflects the stored status, including velocity / geo manual review flags
    const data = obj(response.data);
    const outcome = FINAL_RESULTS[String(data.final_result)];
    if (!outcome) {
      logger.error('idswyft result not final', { providerVerificationId, status: str(data.status) });
      throw new ProviderUnavailableError('Identity verification result is not ready');
    }

    let reason: string | null = null;
    if (outcome === 'REJECTED') reason = str(data.rejection_reason) ?? 'PROVIDER_REJECTED';
    if (outcome === 'MANUAL_REVIEW') reason = toReviewReason(data.manual_review_reason);

    const liveness = obj(data.liveness_results);
    const faceMatch = obj(data.face_match_results);

    return {
      outcome,
      reason,
      liveness: {
        passed: bool(data.liveness_passed) ?? bool(liveness.passed),
        score: num(liveness.score)
      },
      faceMatch: {
        // Skipped face match (no embedding) reports passed: true with score 0 — keep passed null then
        passed: faceMatch.skipped_reason ? null : bool(data.face_match_passed) ?? bool(faceMatch.passed),
        score: faceMatch.skipped_reason ? null : num(faceMatch.similarity_score)
      },
      raw: data
    };
  }
}

export default IdswyftProvider;
