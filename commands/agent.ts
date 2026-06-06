import { Command } from 'commander';
import { GoogleGenAI } from '@google/genai';
import { zshCommands } from '../utils/tools';
import { exec } from 'child_process';
import fs from 'fs/promises';
import { getSession } from '../utils/share';

export const agentCommand = new Command('agent')
  .description('Runs the agent')
  .option('-p, --prompt <prompt>', 'prompt', '')
  .action(async (options) => {
    if (options.prompt) {
      let query = options.prompt;
      const session = await getSession();
      if (session.provider === 'google' && session.apiKey) {
        const ai = new GoogleGenAI({ apiKey: session.apiKey });

        while (1) {
          const response = await ai.models.generateContent({
            model: session.model || 'gemini-3.5-flash',
            contents: query,
            config: {
              tools: [{ functionDeclarations: [zshCommands] }],
            },
          });

          if (!response) {
            continue;
          }

          console.log('[RESPONSE]', response.functionCalls);
          if (response.functionCalls && response.functionCalls.length > 0) {
            const fc = response.functionCalls[0];
            const args = fc.args;
            if (!args) {
              continue;
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
        }
      }
    }
  });
