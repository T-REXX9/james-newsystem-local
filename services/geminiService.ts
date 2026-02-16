import { GoogleGenAI, Type } from '@google/genai';
import { Contact, LeadScoreResult } from '../types';

const getClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key missing. Set VITE_API_KEY in your .env');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Analyzes a contact's profile and interaction history to generate a "Lead Score" 
 * and strategic advice.
 */
export const analyzeLead = async (contact: Contact): Promise<LeadScoreResult> => {
  const model = 'gemini-2.5-flash';

  const prompt = `
    Analyze the following CRM contact data to determine a lead quality score (0-100) and win probability.
    Consider the deal value, current stage, job title, and the sentiment/content of recent interactions.
    
    Contact Data:
    Name: ${contact.name}
    Title: ${contact.title}
    Company: ${contact.company}
    Deal Value: $${contact.dealValue}
    Stage: ${contact.stage}
    
    Interactions:
    ${contact.interactions.map(i => `- [${i.date}] ${i.type}: ${i.notes}`).join('\n')}
    
    Provide a critical, realistic assessment. If interactions mention competitors or pricing concerns, lower the score.
  `;

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: 'Lead score from 0 to 100' },
            winProbability: { type: Type.INTEGER, description: 'Probability of closing won in %' },
            reasoning: { type: Type.STRING, description: 'Short explanation of the score calculation' },
            nextBestAction: { type: Type.STRING, description: 'Strategic recommendation for the salesperson' },
            riskFactors: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: 'List of potential risks'
            }
          },
          required: ['score', 'winProbability', 'reasoning', 'nextBestAction', 'riskFactors']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as LeadScoreResult;
    }
    throw new Error('No response text');
  } catch (error) {
    console.error('Gemini Analysis Failed:', error);
    // Fallback mock for demo if API fails or quota exceeded
    return {
      score: 50,
      winProbability: 50,
      reasoning: 'AI Analysis unavailable. Defaulting to neutral score.',
      nextBestAction: 'Check connection and try again.',
      riskFactors: ['API Error']
    };
  }
};

/**
 * Generates a concise summary of all interactions for a quick catch-up.
 */
export const summarizeHistory = async (contact: Contact): Promise<string> => {
  const model = 'gemini-2.5-flash';
  
  const prompt = `
    Summarize the relationship history with ${contact.name} from ${contact.company} in 2 sentences.
    Focus on the most recent status and any blockers.
    
    History:
    ${contact.interactions.map(i => `${i.date}: ${i.notes}`).join('\n')}
  `;

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text || 'No summary available.';
  } catch (e) {
    console.error(e);
    return 'Could not generate summary.';
  }
};
