import express from 'express';
import axios from 'axios';

const app = express();
const PORT = 3000;

// Docker address or default localhost
const YENTE_URL = process.env.YENTE_API_URL || 'http://localhost:8000';

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'op-adapter', mode: 'ES Modules' });
});

// Main verification endpoint
app.get('/check', async (req, res) => {
  const queryName = req.query.name;

  if (!queryName) {
    return res.status(400).json({ error: 'Missing name parameter' });
  }

  try {
    console.log(`[OP-Adapter] Checking: ${queryName}...`);

    // Request to Yente (documentation: /search)
    // Searching in the 'default' dataset (Sanctions + PEP)
    const response = await axios.get(`${YENTE_URL}/search/default`, {
      params: {
        q: queryName,
        limit: 15,
        fuzzy: false // fuzzy search (typos)
      }
    });

    // Mapping
    const results = response.data.results.map(item => {
      // Extracting topics - these indicate the person's status
      // OpenSanctions documentation: topic 'sanction' or 'role.pep'
      const topics = item.properties.topics || [];
      
      return {
        id: item.id,
        name: item.caption,
        schema: item.schema, // Person, Company, Organization
        
        // --- Key Flags ---
        isSanctioned: topics.includes('sanction'),
        isPep: topics.includes('role.pep'),
        
        // Additional contextual data
        country: item.properties.country || [],
        birthDate: item.properties.birthDate || [],
        notes: item.properties.notes || [],
        
        score: item.score
      };
    });

    // Response structure
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
    // Error handling - log details if available
    const errorMsg = error.response ? error.response.data : error.message;
    console.error('Error connecting to Yente:', errorMsg);
    
    res.status(502).json({ 
      error: 'Sanctions Service Unavailable',
      details: error.message
    });
  }
});

// Starting the server
app.listen(PORT, () => {
  console.log(`OP-Adapter running on port ${PORT}`);
});