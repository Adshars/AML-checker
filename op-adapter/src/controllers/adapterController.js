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

// Helper to safely get first property value
const getProp = (item, propName) => {
  const props = item.properties || {};
  const values = props[propName];
  return values && values.length > 0 ? values[0] : null;
};

// Helper to safely get list property value
const getList = (item, propName) => {
    const props = item.properties || {};
    return props[propName] || [];
};

// Health Check
export const getHealth = (req, res) => {
  logger.debug('Health check requested');
  res.json({ status: 'UP', service: 'op-adapter', mode: 'ES Modules + Retry' });
};

// Main Check Logic
export const checkEntity = async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  
  // Dynamic query parameters
  const { 
      name, 
      limit = 15, 
      fuzzy = 'false', 
      schema, 
      country 
  } = req.query;

  logger.info('Received check request', { requestId, name, limit, fuzzy, schema, country });

  if (!name) {
    logger.warn('Missing name parameter in check request', { requestId });
    return res.status(400).json({ error: 'Missing name parameter' });
  }

  try {
    logger.debug(`Initiating Yente API search`, { requestId, name, url: YENTE_URL });

    const start = Date.now();

    // Building Yente query parameters
    const yenteParams = {
        q: name,
        limit: parseInt(limit) || 15,
        fuzzy: fuzzy === 'true'
    };


    if (schema) yenteParams.schema = schema;
    if (country) yenteParams.countries = country;

    const response = await apiClient.get('/search/default', {
      params: yenteParams
    });

    const duration = Date.now() - start;

    // Mapping logic (DTO)
    const results = response.data.results.map(item => {
      const props = item.properties || {};
      const topics = props.topics || [];
      
      return {
        id: item.id,
        name: item.caption,
        schema: item.schema,
        score: item.score, 
        
        // Key Flags
        isSanctioned: topics.includes('sanction'),
        isPep: topics.includes('role.pep'),

        // Personal Details
        birthDate: getProp(item, 'birthDate'),
        birthPlace: getProp(item, 'birthPlace'),
        gender: getProp(item, 'gender'),
        nationality: getList(item, 'nationality'),
        
        // Localization and Context
        country: props.country || [],
        position: getList(item, 'position'),
        description: getList(item, 'notes'),
        
        // Bonus data
        aliases: getList(item, 'alias'),
        addresses: getList(item, 'address'),

        datasets: item.datasets || []
      };
    });

    logger.info('Yente search completed successfully', { 
      requestId, 
      hits: results.length, 
      durationMs: duration,
      source: 'OpenSanctions (Local Yente)' 
    });

    // Return the formatted response
    res.json({
      meta: {
        source: 'OpenSanctions (Local Yente)',
        timestamp: new Date().toISOString(),
        requestId
      },
      query: name,
      search_params: { limit: yenteParams.limit, fuzzy: yenteParams.fuzzy, schema: yenteParams.schema },
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