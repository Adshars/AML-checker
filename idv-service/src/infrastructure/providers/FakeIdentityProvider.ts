import crypto from 'crypto';
import type {
  DocumentOutcome,
  IIdentityProvider,
  InitializeParams,
  ProviderImage,
  ProviderResult,
  SelfieOutcome
} from '../../domain/providers/IIdentityProvider.js';

type FakeMarker = 'none' | 'review' | 'reject' | 'doc-fail' | 'no-face';

const MARKERS: FakeMarker[] = ['review', 'reject', 'doc-fail', 'no-face'];
const MARKER_PATTERN = /\[fake:([a-z-]+)\]/gi;
const DEFAULT_NAME = 'JOHN SAMPLE';

const parseMarker = (customerName: string | null): FakeMarker => {
  const found = [...(customerName ?? '').matchAll(MARKER_PATTERN)].map((match) => match[1].toLowerCase());
  return (MARKERS.find((marker) => found.includes(marker)) ?? 'none');
};

const stripMarkers = (customerName: string | null): string =>
  (customerName ?? '').replace(MARKER_PATTERN, '').replace(/\s+/g, ' ').trim();

/**
 * Deterministic provider without ML (E2E tests, machines without RAM for idswyft).
 * Behaviour is steered by markers in customerName:
 *   none → verified; [fake:review] → manual review; [fake:reject] → rejected (FACE_MISMATCH);
 *   [fake:doc-fail] → first document rejected; [fake:no-face] → first selfie without a face.
 * Stateless: the marker and the name travel inside providerVerificationId.
 */
export class FakeIdentityProvider implements IIdentityProvider {
  readonly name = 'fake';

  private decode(providerVerificationId: string): { marker: FakeMarker; fullName: string } {
    const [, marker, encodedName] = providerVerificationId.split('.');
    const fullName = Buffer.from(encodedName ?? '', 'base64url').toString('utf8');
    return { marker: (MARKERS.includes(marker as FakeMarker) ? marker : 'none') as FakeMarker, fullName };
  }

  async initialize({ customerName }: InitializeParams): Promise<{ providerVerificationId: string }> {
    const marker = parseMarker(customerName);
    const fullName = stripMarkers(customerName) || DEFAULT_NAME;
    const encodedName = Buffer.from(fullName, 'utf8').toString('base64url');
    return { providerVerificationId: `fake.${marker}.${encodedName}.${crypto.randomUUID().slice(0, 8)}` };
  }

  async submitDocument({ providerVerificationId, attempt }: ProviderImage): Promise<DocumentOutcome> {
    const { marker, fullName } = this.decode(providerVerificationId);

    if (marker === 'doc-fail' && attempt === 1) {
      return { accepted: false, reason: 'FRONT_LOW_CONFIDENCE', retryable: true, raw: { fake: true, rejected: true } };
    }

    return {
      accepted: true,
      ocr: {
        fullName,
        dateOfBirth: '1980-01-01',
        documentNumber: 'ABC123456',
        expiryDate: '2030-01-01',
        nationality: 'POL',
        issuingCountry: 'PL',
        documentType: 'national_id',
        ocrConfidence: 0.93
      },
      authenticity: null,
      raw: { fake: true }
    };
  }

  async submitSelfie({ providerVerificationId, attempt }: ProviderImage): Promise<SelfieOutcome> {
    const { marker } = this.decode(providerVerificationId);
    if (marker === 'no-face' && attempt === 1) {
      return { final: false, reason: 'FACE_NOT_DETECTED' };
    }
    return { final: true };
  }

  async getResult({ providerVerificationId }: { providerVerificationId: string }): Promise<ProviderResult> {
    const { marker } = this.decode(providerVerificationId);
    const liveness = { passed: true, score: 0.95 };

    if (marker === 'reject') {
      return { outcome: 'REJECTED', reason: 'FACE_MISMATCH', liveness, faceMatch: { passed: false, score: 0.35 }, raw: { fake: true, marker } };
    }
    if (marker === 'review') {
      return { outcome: 'MANUAL_REVIEW', reason: 'PROVIDER_REVIEW', liveness, faceMatch: { passed: true, score: 0.9 }, raw: { fake: true, marker } };
    }
    return { outcome: 'VERIFIED', reason: null, liveness, faceMatch: { passed: true, score: 0.9 }, raw: { fake: true, marker } };
  }
}

export default FakeIdentityProvider;
