import { Command } from 'commander';
import { getSession, MODELS_SUPPORTED } from '../../utils/share';

export const getModelsCommand = new Command('ls')
  .description('Returns all the supported models')
  .action(async (options) => {
    console.log('Listing models...');
    MODELS_SUPPORTED.forEach((model) => {
      console.log('->', model);
    });
    const session = await getSession();
    session.model = options.model;
  });
