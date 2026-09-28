export interface CreateVerificationBody {
  externalRef?: string | null;
  customerName?: string | null;
  redirectUrl?: string | null;
}

const emptyToNull = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Create Verification Request DTO (body validated by createVerificationSchema)
 */
export class CreateVerificationDto {
  externalRef: string | null;
  customerName: string | null;
  redirectUrl: string | null;

  constructor({ externalRef, customerName, redirectUrl }: CreateVerificationBody) {
    this.externalRef = emptyToNull(externalRef);
    this.customerName = emptyToNull(customerName);
    this.redirectUrl = emptyToNull(redirectUrl);
  }

  static fromRequest(body: CreateVerificationBody = {}): CreateVerificationDto {
    return new CreateVerificationDto(body);
  }
}

export default CreateVerificationDto;
