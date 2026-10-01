import type { OcrData, ProviderOutcome } from '../entities/Verification.js';

export type ImageMime = 'image/jpeg' | 'image/png';

export interface ProviderImage {
  providerVerificationId: string;
  file: Buffer;
  mime: ImageMime;
  /** 1-based attempt number of this image kind */
  attempt: number;
}

export interface InitializeParams {
  verificationId: string;
  /** 1-based number of provider sessions opened for this verification */
  sessionNumber: number;
  /** End customer IP (provider-side velocity / geo risk checks) */
  clientIp: string | null;
  /** Used only by the fake provider (test markers) */
  customerName: string | null;
}

export type DocumentOutcome =
  | { accepted: true; ocr: OcrData; authenticity: Record<string, unknown> | null; raw: Record<string, unknown> }
  | { accepted: false; reason: string | null; retryable: boolean; raw: Record<string, unknown> };

/** final:false only when no face was found — the customer may take another photo */
export type SelfieOutcome =
  | { final: true }
  | { final: false; reason: string };

export interface ProviderResult {
  outcome: ProviderOutcome;
  reason: string | null;
  liveness: { passed: boolean | null; score: number | null };
  faceMatch: { passed: boolean | null; score: number | null };
  /** Full provider response for the audit trail (no images) */
  raw: Record<string, unknown>;
}

/**
 * Identity verification engine. Every document attempt uses a new provider session.
 * Network errors, timeouts and 5xx responses throw ProviderUnavailableError.
 */
export interface IIdentityProvider {
  readonly name: string;
  initialize(params: InitializeParams): Promise<{ providerVerificationId: string }>;
  submitDocument(params: ProviderImage): Promise<DocumentOutcome>;
  submitSelfie(params: ProviderImage): Promise<SelfieOutcome>;
  getResult(params: { providerVerificationId: string }): Promise<ProviderResult>;
}
