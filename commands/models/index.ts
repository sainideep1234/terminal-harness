import { Command } from 'commander';
import { getModelsCommand } from './getModels';
import { setModel } from './setModels';

export const modelsCommands = new Command('models')
  .description('models related settings')
  .addCommand(getModelsCommand)
  .addCommand(setModel);
