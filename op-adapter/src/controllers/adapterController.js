import axios from 'axios';
import axiosRetry from 'axios-retry';
import logger from '../utils/logger.js';

const YENTE_URL = process.env.YENTE_API_URL || 'http://localhost:8000';

// Axios dedicated client for Yente with retry mechanism
const apiClient = axios.create({
  baseURL: YENTE_URL
});

// Retry configuration
axiosRetry(apiClient, { 
  retries: 3, // Maximum 3 tries
  retryDelay: axiosRetry.exponentialDelay, // Wait increasingly longer (e.g., 1s, 2s, 4s)
  retryCondition: (error) => {
    // Retry only on network errors or 5xx server errors
    // Do not retry on 400 (bad request) or 404 (not found)
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500;
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn('Yente API connection retry attempt #${retryCount}', {
      url: requestConfig.url,
      error: error.message
    });
  }
});

// Health Check
export const getHealth = (req, res) => {
  logger.debug('Health check requested');
  res.json({ status: 'UP', service: 'op-adapter', mode: 'ES Modules + Retry' });
};

// Main Check Logic
export const checkEntity = async (req, res) => {
  const queryName = req.query.name;
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

  logger.info('Received check request', { requestId, queryName });

  if (!queryName) {
    logger.warn('Missing name parameter in check request', { requestId });
    return res.status(400).json({ error: 'Missing name parameter' });
  }

  try {
    logger.debug(`Initiating Yente API search`, { requestId, queryName, url: YENTE_URL });

    const start = Date.now();

    // API Call with retry
    const response = await apiClient.get('/search/default', {
      params: {
        q: queryName,
        limit: 15,
        fuzzy: false
      }
    });

    const duration = Date.now() - start;

    const rawResults = response.data.results || [];

    // Mapping logic (DTO)
    const results = response.data.results.map(item => {
      const props = item.properties || {};
      const topics = props.topics || [];
      
      return {
        id: item.id,
        name: item.caption,
        schema: item.schema, 
        
        // Key Flags
        isSanctioned: topics.includes('sanction'),
        isPep: topics.includes('role.pep'),
        
        // Context
        country: props.country || [],
        birthDate: props.birthDate || [],
        notes: props.notes || [],
        
        score: item.score
      };
    });

    logger.info('Yente search completed successfully', { 
      requestId, 
      hits: results.length, 
      durationMs: duration,
      source: 'OpenSanctions (Local Yente)' 
    });

    res.json({
      meta: {
        source: 'OpenSanctions (Local Yente)',
        timestamp: new Date().toISOString(),
        requestId
      },
      query: queryName,
      hits_count: results.length,
      data: results
    });

  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    const statusCode = error.response ? error.response.status : 500;
    
    logger.error('Error connecting to Yente (after retries):', { 
      requestId, 
      error: error.message,
      stack: error.stack,
      responseData: errorMsg,
      statusCode 
    });
    
    res.status(502).json({ 
      error: 'Sanctions Service Unavailable',
      details: error.message
    });
  }
};