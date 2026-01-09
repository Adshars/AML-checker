import axios from 'axios';
import axiosRetry from 'axios-retry';

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
  }
});

// Health Check
export const getHealth = (req, res) => {
  res.json({ status: 'UP', service: 'op-adapter', mode: 'ES Modules + Retry' });
};

// Main Check Logic
export const checkEntity = async (req, res) => {
  const queryName = req.query.name;

  if (!queryName) {
    return res.status(400).json({ error: 'Missing name parameter' });
  }

  try {
    console.log(`[OP-Adapter] Checking: ${queryName}...`);

    // API Call with retry
    const response = await apiClient.get('/search/default', {
      params: {
        q: queryName,
        limit: 15,
        fuzzy: false
      }
    });

    // Mapping logic (DTO)
    const results = response.data.results.map(item => {
      const topics = item.properties.topics || [];
      
      return {
        id: item.id,
        name: item.caption,
        schema: item.schema, 
        
        // Key Flags
        isSanctioned: topics.includes('sanction'),
        isPep: topics.includes('role.pep'),
        
        // Context
        country: item.properties.country || [],
        birthDate: item.properties.birthDate || [],
        notes: item.properties.notes || [],
        
        score: item.score
      };
    });

    res.json({
      meta: {
        source: 'OpenSanctions (Local Yente)',
        timestamp: new Date().toISOString()
      },
      query: queryName,
      hits_count: results.length,
      data: results
    });

  } catch (error) {
    const errorMsg = error.response ? error.response.data : error.message;
    console.error('Error connecting to Yente (after retries):', errorMsg);
    
    res.status(502).json({ 
      error: 'Sanctions Service Unavailable',
      details: error.message
    });
  }
};