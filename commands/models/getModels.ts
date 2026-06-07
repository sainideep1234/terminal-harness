import { Command } from 'commander';
import {  getCurrentSession, PROVIDERS_MODELS } from '../../utils/share';

export const getModelsCommand = new Command('ls')
  .description('Returns all the supported models')
  .action(async (options) => {
    console.log('Listing models...');
    Object.entries(PROVIDERS_MODELS).forEach(([provider, modelArr]) => {
      console.log('->', provider);
      modelArr.forEach((model) => {
        console.log(model);
      });
    });
    const session = await getCurrentSession();
    session.model = options.model;
  });
