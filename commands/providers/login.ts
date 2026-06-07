import { Command } from 'commander';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs/promises';

import { Session } from 'node:inspector';
import { PROVIDERS_MODELS, PROVIDERS_TYPES, upsertProviderInSession } from '../../utils/share';

export const loginCommand = new Command('login')
  .description('Lets user login into the provider (use it as default)')
  .option(
    '-p, --provider <providerName>',
    'Name of the provider (gemini, claude etc)',
    '',
  )
  .option('-a, --api_key <apiKey>', 'Your api key', '')
  .action(async (options) => {
    const providerAvailabel = PROVIDERS_MODELS[(options.provider as PROVIDERS_TYPES)];
    if(!providerAvailabel){
      console.error(`"${options.provider}" provider is not supported currently`)
    }

    if (providerAvailabel && options.api_key ) {
        try {
          console.log("hiì");
          
          await upsertProviderInSession(options.provider, options.api_key);
        } catch (error) {
          console.error(error);
          process.exit(1);
        }

        console.log('api-key is set for provider -> ', options.provider);
        console.log('api-key  for provider -> ', options.api_key);
      }
  });
