import { DataTypes, Model, type Sequelize, type Optional, type ModelStatic } from 'sequelize';

export interface AuditLogAttributes {
  id: string;
  organizationId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  searchQuery: string;
  hasHit: boolean;
  hitsCount: number;
  entityName: string | null;
  entityScore: number | null;
  entityBirthDate: string | null;
  entityGender: string | null;
  entityCountries: string | null;
  entityDatasets: string | null;
  entityDescription: string | null;
  hitDetails: Record<string, unknown> | null;
  isSanctioned: boolean;
  isPep: boolean;
  source: string | null;
  idvVerificationId: string | null;
  createdAt: Date;
}

export type AuditLogCreationAttributes = Optional<
  AuditLogAttributes,
  | 'id'
  | 'userId'
  | 'userName'
  | 'userEmail'
  | 'hasHit'
  | 'hitsCount'
  | 'entityName'
  | 'entityScore'
  | 'entityBirthDate'
  | 'entityGender'
  | 'entityCountries'
  | 'entityDatasets'
  | 'entityDescription'
  | 'hitDetails'
  | 'isSanctioned'
  | 'isPep'
  | 'source'
  | 'idvVerificationId'
  | 'createdAt'
>;

export type AuditLogModelInstance = Model<AuditLogAttributes, AuditLogCreationAttributes> & AuditLogAttributes;

export type AuditLogModelStatic = ModelStatic<AuditLogModelInstance>;

/**
 * Create AuditLog Sequelize model
 */
export const createAuditLogModel = (sequelize: Sequelize): AuditLogModelStatic => {
  const AuditLogModel = sequelize.define<AuditLogModelInstance>('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    searchQuery: {
      type: DataTypes.STRING,
      allowNull: false
    },
    hasHit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    hitsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    entityScore: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    entityBirthDate: {
      type: DataTypes.STRING,
      allowNull: true
    },
    entityGender: {
      type: DataTypes.STRING,
      allowNull: true
    },
    entityCountries: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    entityDatasets: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    entityDescription: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    hitDetails: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    isSanctioned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isPep: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // panel / api / idv — null for checks recorded before the column existed
    source: {
      type: DataTypes.STRING(16),
      allowNull: true
    },
    idvVerificationId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  return AuditLogModel;
};

export default createAuditLogModel;
