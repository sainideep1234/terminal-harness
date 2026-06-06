import { Command } from 'commander';
import fs from 'node:fs/promises';
import { getSession } from '../../utils/share';

export const logoutCommand = new Command('logout')
  .description('Lets user logout from the provider')
  .option(
    '-p, --provider <providerName>',
    'Name of the provider (gemini, claude etc)',
    '',
  )
  .action(async (options) => {
    if (options.p === 'google' || options.provider === 'google') {
      const session = await getSession();
      session.apiKey = null;
      session.client = null;
      session.model = null;
      session.provider = null;

      const content = JSON.stringify(session);

      try {
        await fs.writeFile(`${process.cwd()}/database.json`, content);
      } catch (error) {
        console.log('Problem in setting variable');
      }
      console.log(
        `api-key for provioder "${options.provider}" deleted successfully`,
      );
    }
  });
