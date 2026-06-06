import { Command } from 'commander';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs/promises';
import { getSession } from '../../utils/share';

export const loginCommand = new Command('login')
  .description('Lets user login into the provider (use it as default)')
  .option(
    '-p, --provider <providerName>',
    'Name of the provider (gemini, claude etc)',
    '',
  )
  .option('-a, --api_key <apiKey>', 'Your api key', '')
  .action(async (options) => {
    if (options.provoder === 'google') {
      if (options.api_key) {
        const session = await getSession();
        session.provider = options.provider;
        session.apiKey = options.api_key;
        session.client = new GoogleGenAI({ apiKey: options.api_key });

        const content = JSON.stringify(session);

        try {
          await fs.writeFile(`${process.cwd()}/database.json`, content);
        } catch (error) {
          console.log('Problem in setting variables');
        }

        console.log('api-key is set for provider -> ', options.provider);
        console.log('api-key  for provider -> ', options.api_key);
      }
    }
  });
