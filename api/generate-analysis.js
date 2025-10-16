export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { storyTopic, dataNeeded, timeframe, sources, deadline } = req.body;

    // Validate required fields
    if (!storyTopic || !dataNeeded || !timeframe) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build the prompt for OpenAI
    const prompt = `You are a data research assistant for journalists. Your task is to provide comprehensive data analysis with verifiable sources.

Story Topic: ${storyTopic}
Data Needed: ${dataNeeded}
Timeframe: ${timeframe}
Preferred Sources: ${sources.length > 0 ? sources.join(', ') : 'Any authoritative sources'}
Deadline: ${deadline || 'Not specified'}

Please provide:
1. Key statistical findings relevant to the story topic
2. Historical context and benchmarks
3. Expert analysis and insights
4. For EACH data point, provide specific, verifiable sources with:
   - Organization name (e.g., Bureau of Labor Statistics)
   - Report/document title
   - Publication date
   - Relevant URL if available

Format your response clearly with:
- Main findings organized by topic
- Each finding followed by its sources in brackets
- Statistical data with proper context
- Any important caveats or limitations

Focus on accuracy and verifiability. Only cite real, existing sources.`;

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a data research assistant specializing in providing journalists with accurate, well-sourced data and analysis. Always cite specific, verifiable sources.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      return res.status(openaiResponse.status).json({ 
        error: `OpenAI API error: ${errorData.error?.message || 'Unknown error'}` 
      });
    }

    const openaiData = await openaiResponse.json();
    const analysis = openaiData.choices[0].message.content;

    return res.status(200).json({ 
      analysis,
      metadata: {
        storyTopic,
        timeframe,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating analysis:', error);
    return res.status(500).json({ 
      error: 'Failed to generate analysis. Please try again.' 
    });
  }
}
