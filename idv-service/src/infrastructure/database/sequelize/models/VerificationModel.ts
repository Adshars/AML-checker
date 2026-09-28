import { DataTypes, Model, type Sequelize, type ModelStatic, type Optional } from 'sequelize';
import type { Verification } from '../../../../domain/entities/Verification.js';

export type VerificationCreationAttributes = Optional<Verification, 'id' | 'createdAt' | 'updatedAt'>;

export type VerificationModelInstance = Model<Verification, VerificationCreationAttributes> & Verification;

export type VerificationModelStatic = ModelStatic<VerificationModelInstance>;

const nullableString = (length?: number) => ({
  type: length ? DataTypes.STRING(length) : DataTypes.STRING,
  allowNull: true
});
const nullableDate = () => ({ type: DataTypes.DATE, allowNull: true });
const nullableBoolean = () => ({ type: DataTypes.BOOLEAN, allowNull: true });
const nullableFloat = () => ({ type: DataTypes.FLOAT, allowNull: true });
const nullableJson = () => ({ type: DataTypes.JSONB, allowNull: true });

/**
 * Create Verification Sequelize model
 */
export const createVerificationModel = (sequelize: Sequelize): VerificationModelStatic =>
  sequelize.define<VerificationModelInstance>('Verification', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.STRING, allowNull: false },
    organizationName: nullableString(),
    identityMode: { type: DataTypes.STRING(16), allowNull: false },
    isDemo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdByType: { type: DataTypes.STRING(8), allowNull: false },
    createdByUserId: nullableString(),
    createdByName: nullableString(),
    externalRef: nullableString(100),
    customerName: nullableString(200),
    redirectUrl: nullableString(2000),
    tokenHash: { type: DataTypes.STRING(64), allowNull: false },
    tokenEncrypted: { type: DataTypes.TEXT, allowNull: true },
    linkExpiresAt: { type: DataTypes.DATE, allowNull: false },
    consentAt: nullableDate(),
    consentIp: nullableString(64),
    startedAt: nullableDate(),
    sessionExpiresAt: nullableDate(),
    completedAt: nullableDate(),
    status: { type: DataTypes.STRING(16), allowNull: false },
    decisionSource: nullableString(8),
    decisionReason: nullableString(),
    reviewedById: nullableString(),
    reviewedByName: nullableString(),
    reviewedAt: nullableDate(),
    reviewComment: { type: DataTypes.TEXT, allowNull: true },
    provider: { type: DataTypes.STRING(16), allowNull: false },
    providerVerificationIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    // Provider verdict kept until FULL_AML screening decides the final status
    providerOutcome: nullableString(16),
    documentAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    selfieAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ocr: nullableJson(),
    livenessPassed: nullableBoolean(),
    livenessScore: nullableFloat(),
    faceMatchPassed: nullableBoolean(),
    faceMatchScore: nullableFloat(),
    documentAuthenticity: nullableJson(),
    providerResult: nullableJson(),
    documentImagePath: nullableString(),
    documentImageMime: nullableString(32),
    selfieImagePath: nullableString(),
    selfieImageMime: nullableString(32),
    imagesPurgedAt: nullableDate(),
    screeningStatus: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'NOT_APPLICABLE' },
    screeningAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    screenedAt: nullableDate(),
    screeningHitsCount: { type: DataTypes.INTEGER, allowNull: true },
    screeningIsSanctioned: nullableBoolean(),
    screeningIsPep: nullableBoolean(),
    screeningTopMatch: nullableJson(),
    auditLogId: { type: DataTypes.UUID, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    indexes: [
      { fields: ['organizationId', 'createdAt'] },
      { fields: ['status'] },
      // Named index instead of a column-level unique: sync({ alter }) would add a new constraint on every start
      { name: 'verifications_token_hash_unique', unique: true, fields: ['tokenHash'] }
    ]
  });

export default createVerificationModel;
