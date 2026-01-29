import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  organizationId: { type: DataTypes.STRING, allowNull: false },
  userId: { type: DataTypes.STRING, allowNull: true },
  userEmail: { type: DataTypes.STRING, allowNull: true },
  searchQuery: { type: DataTypes.STRING, allowNull: false },
  hasHit: { type: DataTypes.BOOLEAN, defaultValue: false },
  hitsCount: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Flat columns (basic info - simplified to strings)
  entityName: { type: DataTypes.STRING, allowNull: true },
  entityScore: { type: DataTypes.FLOAT, allowNull: true },
  entityBirthDate: { type: DataTypes.STRING, allowNull: true },
  entityGender: { type: DataTypes.STRING, allowNull: true },
  
  // Changed to TEXT because country lists can be long
  entityCountries: { type: DataTypes.TEXT, allowNull: true },
  entityDatasets: { type: DataTypes.TEXT, allowNull: true },
  entityDescription: { type: DataTypes.TEXT, allowNull: true },

  // FULL DATA - Complete properties object goes here (aliases, education, etc.)
  hitDetails: {
    type: DataTypes.JSONB, 
    allowNull: true
  },

  isSanctioned: { type: DataTypes.BOOLEAN, defaultValue: false },
  isPep: { type: DataTypes.BOOLEAN, defaultValue: false },
  
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

export default AuditLog;