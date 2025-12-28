import { DataTypes } from 'sequelize';
import squelize from '../config/database.js';

const AuditLog = squelize.define('AuditLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    // Organization ID
    organizationId: {
        type: DataTypes.STRING,
        allowNull: false,
        index: true,
    },

    // Who performed the action (null for system actions)
    userId: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // Who was asked about
    searchQuery: {
        type: DataTypes.STRING,
        allowNull: false
    },

    // HIT or CLEAR
    hasHit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // Technical details (e.g. number of matches)
    hitsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
});

export default AuditLog;
