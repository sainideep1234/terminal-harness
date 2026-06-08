import { Command } from 'commander';
import { GoogleGenAI } from '@google/genai';
import { getCurrentSession } from '../utils/share';

export const agentCommand = new Command('agent')
  .description('Runs the agent')
  .option('-p, --prompt <prompt>', 'prompt', '')
  .action(async (options) => {
    if (options.prompt) {
      let query = options.prompt;

      let session;
      try {
        session = await getCurrentSession();
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }

      if (
        session.provider === 'google' &&
        session.apiKey &&
        session.client instanceof GoogleGenAI
      ) {
        const response = await session.client!.models.generateContent({
          model: session.model!,
          contents: query,
          config: {
            tools: [{ functionDeclarations: [] }],
          },
        });

        if (!response) {
          return;
        }

        console.log(response.candidates?.[0].content?.parts?.[0].text);

        console.log('[RESPONSE]', response.functionCalls);
        if (response.functionCalls && response.functionCalls.length > 0) {
          const fc = response.functionCalls[0];
          const args = fc.args;
          if (!args) {
            return;
          }
      
        }
        query = '';
      } else if (
        session.provider === 'openai' &&
        session.apiKey &&
        session.client instanceof GoogleGenAI
      ) {
      } else if (
        session.provider === 'claude' &&
        session.apiKey &&
        session.client instanceof GoogleGenAI
      ) {
      }
    }
  });
