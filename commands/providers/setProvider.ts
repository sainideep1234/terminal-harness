import { Command } from 'commander';
import { getSession } from '../../utils/share';

export const setProviderCommand = new Command('provider')
  .description('Lets user set the default provider')
  .option(
    '-p, --provider <providerName>',
    'Name of the provider (gemini, claude etc)',
    '',
  )
  .action(async (options) => {
    if (options.p === 'google' || options.provider === 'google') {
      const session = await getSession();
      session.provider = 'google';

      // TODO: add model to database.json file.
    }
  });
