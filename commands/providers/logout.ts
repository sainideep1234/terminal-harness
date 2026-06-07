import { Command } from 'commander';
import fs from 'node:fs/promises';

export const logoutCommand = new Command('logout')
  .description('Lets user logout from the provider')
  .option(
    '-p, --provider <providerName>',
    'Name of the provider (gemini, claude etc)',
    '',
  )
  .action(async (options) => {
    if (options.p === 'google' || options.provider === 'google') {
      
      // TODO: update it delete session of a particular provider
      const session = {
        apiKey:null, 
        model : null , 
        provider:null
      }
     

      console.log("Session logout successfully");
      
    }
  });
