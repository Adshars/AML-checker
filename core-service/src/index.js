import exxpress from 'express';
import axios from 'axios';
import sequelize from './config/database.js';
import AuditLog from './models/AuditLog.js';

const app = exxpress();
const PORT = 3000;
const OP_ADAPTER_URL = process.env.OP_ADAPTER_URL || 'http://op-adapter:3000';

app.use(exxpress.json());

// Health Check
app.get('/health', async (req, res) => {
    let dbStatus = 'Disconnected';
    try {
        await sequelize.authenticate();
        dbStatus = 'Connected';
    } catch (error) {
        dbStatus = 'Disconnected';
    }
    res.json({ service: 'core-service', status: 'UP', database: dbStatus });
});

// Endpoint for sanctions check

app.get('/check', async (req, res) => {
    const queryName = req.query.name;

    // Get context from the headers

    const orgID = req.headers['x-org-id'];
    const userID = req.headers['x-user-id'];

    if (!queryName) return res.status(400).json({ error: 'Missing name parameter' });
    if (!orgID) return res.status(403).json({ error: 'Missing Organization Context (x-org-id)' });

    try {
        // Forward the request to the OP Adapter

        console.log(`[CORE] Checking sanctions for: ${queryName} (Org: ${orgID})`);
        const adapterResponse = await axios.get(`${OP_ADAPTER_URL}/check`, {
            params: { name: queryName }
        });

        const data = adapterResponse.data;
        const hasHit = data.hits_count > 0;

        // Log the audit record

        await AuditLog.create({
            organizationId: orgID,
            userId: userID || 'B2B-API-KEY', // When no user ID, assume API key usage
            searchQuery: queryName,
            hasHit: hasHit,
            hitsCount: data.hits_count
        });

        // Return the response from the adapter

        res.json(data);

    } catch (error) {
        console.error('[CORE] Error during sanctions check:', error.message);
        res.status(502).json({ error: 'Validation failed downstream' });
    }
});

// History endpoint

app.get('/history', async (req, res) => {
    const orgID = req.headers['x-org-id'];
    if (!orgID) return res.status(403).json({ error: 'Unauthorized' });

    try {
        // Validation: always filter by organization ID

        const history = await AuditLog.findAll({
            where: { organizationId: orgID },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        res.json(history);
    } catch (error) {
        console.error('[CORE] Error fetching history:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server after syncing the database

app.listen(PORT, async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync({alter: true});
        console.log(`✅ [CORE] Service running on port ${PORT} & DB Connected`);
    } catch (error) {
        console.error('[CORE] Failed to start server:', error.message);
        process.exit(1);
    }
});