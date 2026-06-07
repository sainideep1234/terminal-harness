import { Command } from 'commander';
import { GoogleGenAI } from '@google/genai';
import { zshCommands } from '../utils/tools';
import { exec } from 'child_process';
import { getCurrentSession } from '../utils/share';

export const agentCommand = new Command('agent')
  .description('Runs the agent')
  .option('-p, --prompt <prompt>', 'prompt', '')
  .action(async (options) => {
    if (options.prompt) {
      let query = options.prompt;
      const session = await getCurrentSession();

      if (
        session.provider === 'google' &&
        session.apiKey &&
        session.client instanceof GoogleGenAI
      ) {
        const response = await session.client!.models.generateContent({
          model: session.model!,
          contents: query,
          config: {
            tools: [{ functionDeclarations: [zshCommands] }],
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
          exec(args.comand as string, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error executing command: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Standard Error: ${stderr}`);
              return;
            }
            console.log(`Output:\n${stdout}`);
          });
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
