import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  organizationId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  searchQuery: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hasHit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  hitsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  // Best match details
  
  entityName: {         // Name and surname
    type: DataTypes.STRING,
    allowNull: true
  },
  entityScore: {        // Score
    type: DataTypes.FLOAT,
    allowNull: true
  },
  entityBirthDate: {    // Birth date
    type: DataTypes.STRING,
    allowNull: true
  },
  entityGender: {       // Gender
    type: DataTypes.STRING,
    allowNull: true
  },
  entityCountries: {    // Countries/Jurisdictions (comma-separated)
    type: DataTypes.TEXT,
    allowNull: true
  },
  entityDatasets: {     // Lists found on (comma-separated)
    type: DataTypes.TEXT,
    allowNull: true
  },
  entityDescription: {  // Description/Position
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Flags
  isSanctioned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isPep: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

export default AuditLog;