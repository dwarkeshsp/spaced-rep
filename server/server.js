/**
 * Flash Cards Generator API Server
 * 
 * Provides endpoints for generating flashcards using Claude API
 * and integrating with Mochi Cards
 */

// Load .env file if present
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not installed, using process.env directly');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

// Import shared constants and helpers from a server-side module
// that mirrors the client-side API_CONFIG
const API_CONFIG = {
  // Claude API settings
  ANTHROPIC_API_URL: "https://api.anthropic.com/v1/messages",
  CLAUDE_MODEL: "claude-3-7-sonnet-20250219",
  ANTHROPIC_VERSION: "2023-06-01",
  
  // System prompts for various functionalities
  PROMPTS: {
    CARDS: `You are an expert in creating high-quality spaced repetition flashcards. 
Your task is to generate effective flashcards from the highlighted text excerpt, with the full text provided for context.

Guidelines for creating excellent flashcards:
1. Focus on core concepts and relationships rather than trivia or isolated facts
2. Break complex ideas into smaller, atomic concepts
3. Ensure each card tests one specific idea (atomic)
4. Use precise, clear language
5. Front of card should ask a specific question that prompts recall
6. Back of card should provide a concise, complete answer
7. Avoid creating cards that can be answered through pattern matching or recognition
8. Create cards that build conceptual understanding and connections
9. Focus on "why" and "how" questions that develop deeper understanding
10. Promote connections between concepts across domains when relevant
11. Whenever you're describing the author's viewpoint or prediction (and not just raw facts), feel free to cite them (or the resource itself) in the question 

You will also analyze the content and suggest an appropriate deck category.
The specific deck options will be dynamically determined and provided in the user message.

CRITICAL: You MUST ALWAYS output your response as a valid JSON array of card objects. NEVER provide any prose, explanation or markdown formatting.

Each card object must have the following structure:

{
  "front": "The question or prompt text goes here",
  "back": "The answer or explanation text goes here",
  "deck": "One of the deck categories listed above"
}

Example of expected JSON format:

[
  {
    "front": "What is the primary function of X?",
    "back": "X primarily functions to do Y by using mechanism Z.",
    "deck": "CS/Hardware"
  },
  {
    "front": "Why is concept A important in the context of B?",
    "back": "Concept A is crucial because it enables process C and prevents problem D.",
    "deck": "Math/Physics"
  }
]

Generate between 1-5 cards depending on the complexity and amount of content in the highlighted text.
Your response MUST BE ONLY valid JSON - no introduction, no explanation, no markdown formatting.`,

    ANALYSIS: `You analyze text to extract key contextual information. Create a concise 1-2 paragraph summary that includes: the author/source if identifiable, the main thesis or argument, key points, and relevant background. This summary will serve as context for future interactions with sections of this text.`
  }
};

/**
 * Helper function to truncate text to a reasonable size
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 8000) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [truncated]';
}

/**
 * Helper to call Claude API with consistent options
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {string} apiKey - Claude API key
 * @param {number} maxTokens - Maximum tokens for response
 * @returns {Promise<Object>} Claude API response
 */
async function callClaudeApi(systemPrompt, userPrompt, apiKey, maxTokens = 4000) {
  if (!apiKey) {
    throw new Error('API key not configured. Please provide a Claude API key.');
  }

  const payload = {
    model: API_CONFIG.CLAUDE_MODEL,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: maxTokens
  };

  // Log the request for debugging
  console.log(`\n===== CLAUDE API REQUEST =====`);
  console.log('SYSTEM:', systemPrompt.substring(0, 100) + '...');
  console.log('USER PROMPT:', userPrompt.substring(0, 100) + '...');
  console.log('==============================\n');

  const response = await fetch(API_CONFIG.ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_CONFIG.ANTHROPIC_VERSION
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Claude API Error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return response.json();
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://spaced-rep.vercel.app',
    'https://spaced-rep-ten.vercel.app',
    'https://pod-prep.com',
    new RegExp(/https:\/\/spaced-.*\.vercel\.app/)
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../src')));

// Add middleware to expose environment variables to client
app.use((req, res, next) => {
  res.locals.envVars = {
    hasMochiApiKey: !!process.env.MOCHI_API_KEY
  };
  next();
});

// CLAUDE API ENDPOINTS

// API endpoint for text analysis
app.post('/api/analyze-text', async (req, res) => {
  try {
    const { text, userApiKey } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Use user-provided API key if available, otherwise fall back to environment variable
    const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
    const truncatedText = truncateText(text, 10000);
    
    const userPrompt = `Please analyze this text and provide a concise contextual summary (1-2 paragraphs maximum):

${truncatedText}`;
    
    const claudeResponse = await callClaudeApi(
      API_CONFIG.PROMPTS.ANALYSIS, 
      userPrompt, 
      apiKey, 
      1000
    );
    
    res.json(claudeResponse);
  } catch (error) {
    console.error('Server error during text analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for generating flashcards
app.post('/api/generate-cards', async (req, res) => {
  try {
    const { text, textContext, deckOptions, userApiKey } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Use user-provided API key if available, otherwise fall back to environment variable
    const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
    
    const userPrompt = `Please create spaced repetition flashcards from the SELECTED TEXT below.
Use the guidelines from the system prompt.

Available deck categories: ${deckOptions || Object.keys(req.body.deckMap || {}).join(', ') || "General"}

Remember to return ONLY a valid JSON array of flashcard objects matching the required format.

PRIMARY FOCUS - Selected Text (create cards from this):
${truncateText(text)}

${textContext ? `OPTIONAL BACKGROUND - Document Context (use only if helpful for understanding the selected text):
${textContext}` : ''}`;
    
    const claudeResponse = await callClaudeApi(
      API_CONFIG.PROMPTS.CARDS, 
      userPrompt, 
      apiKey, 
      4000
    );
    
    // Log the response for debugging
    console.log('Claude API response structure:', Object.keys(claudeResponse));
    if (claudeResponse.content) {
      console.log('Content types:', claudeResponse.content.map(item => item.type).join(', '));
    }
    
    res.json(claudeResponse);
  } catch (error) {
    console.error('Server error during card generation:', error);
    res.status(500).json({ error: error.message });
  }
});


// MOCHI API ENDPOINTS

// API endpoint to fetch decks from Mochi
app.get('/api/mochi-decks', async (req, res) => {
  try {
    // Get Mochi API key from query parameter or environment
    const mochiApiKey = req.query.userMochiKey || process.env.MOCHI_API_KEY;
    if (!mochiApiKey) {
      return res.status(500).json({ 
        error: 'Mochi API key not configured',
        fallbackDecks: { "General": "general" }
      });
    }
    
    // Mochi uses HTTP Basic Auth with API key followed by colon
    const base64ApiKey = Buffer.from(`${mochiApiKey}:`).toString('base64');
    const authToken = `Basic ${base64ApiKey}`;
    
    // Fetch decks from Mochi API
    const response = await fetch('https://app.mochi.cards/api/decks/', {
      method: 'GET',
      headers: {
        'Authorization': authToken
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mochi API Error: ${errorText}`);
    }
    
    const decksData = await response.json();
    
    // Transform data for client use
    const formattedDecks = {};
    
    // Filter out trashed and archived decks
    const activeDeckCount = decksData.docs.length;
    let activeDecksCount = 0;
    
    decksData.docs.forEach(deck => {
      // Skip decks that are in trash or archived
      if (deck['trashed?'] || deck['archived?']) {
        return; // Skip this deck
      }
      
      // Only include active decks
      activeDecksCount++;
      
      // Remove [[ ]] if present in the ID
      const cleanId = deck.id.replace(/\[\[|\]\]/g, '');
      formattedDecks[deck.name] = cleanId;
    });
    
    console.log(`Loaded ${activeDecksCount} active decks out of ${activeDeckCount} total decks from Mochi API`);
    
    res.json({
      success: true,
      decks: formattedDecks,
      deckCount: activeDecksCount
    });
    
  } catch (error) {
    console.error('Error fetching Mochi decks:', error);
    res.status(500).json({ 
      error: error.message,
      fallbackDecks: {
        "General": "general"
      }
    });
  }
});

// API endpoint to check environment status
app.get('/api/env-status', (req, res) => {
  res.json({
    hasMochiApiKey: !!process.env.MOCHI_API_KEY
  });
});

// API endpoint for direct Mochi integration
app.post('/api/upload-to-mochi', async (req, res) => {
  try {
    const { cards, userMochiKey } = req.body;
    
    if (!cards || !Array.isArray(cards)) {
      return res.status(400).json({ error: 'Cards array is required' });
    }
    
    // Get Mochi API key from request or environment
    const mochiApiKey = userMochiKey || process.env.MOCHI_API_KEY;
    if (!mochiApiKey) {
      return res.status(500).json({ error: 'Mochi API key not configured' });
    }
    
    console.log('Starting Mochi API upload');
    
    // Mochi uses HTTP Basic Auth with API key followed by colon
    const base64ApiKey = Buffer.from(`${mochiApiKey}:`).toString('base64');
    const authToken = `Basic ${base64ApiKey}`;
    
    // Upload each card to Mochi
    const results = [];
    
    for (const card of cards) {
      try {
        console.log('Uploading card to Mochi:', JSON.stringify({
          'content': card.content.substring(0, 20) + '...',
          'deck-id': card['deck-id']
        }));
        
        // Use HTTP Basic Auth header format
        const response = await fetch('https://app.mochi.cards/api/cards/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken
          },
          body: JSON.stringify({
            'content': card.content,
            'deck-id': card['deck-id']
          })
        });
        
        const responseText = await response.text();
        console.log('Mochi API response:', response.status, responseText.substring(0, 100));
        
        if (response.ok) {
          let responseData;
          try {
            responseData = JSON.parse(responseText);
            results.push({ success: true, id: responseData.id });
          } catch (jsonError) {
            console.error('Error parsing JSON response:', jsonError);
            results.push({ success: true, response: responseText });
          }
        } else {
          results.push({ success: false, error: responseText, status: response.status });
        }
      } catch (cardError) {
        console.error('Error uploading to Mochi:', cardError);
        results.push({ success: false, error: cardError.message });
      }
    }
    
    res.json({
      success: true,
      results: results,
      totalSuccess: results.filter(r => r.success).length,
      totalCards: cards.length
    });
    
  } catch (error) {
    console.error('Server error during Mochi upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// UTILITY ENDPOINTS

// Health check route for Vercel
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../src/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});