import { program } from 'commander';
import { agentCommand } from './commands/agent';
import { providerCommand } from './commands/providers';
import { modelsCommands } from './commands/models';

program
  .name('opencode')
  .description('Coding agent cli')
  .version('0.1.0')
  .addCommand(modelsCommands)
  .addCommand(agentCommand)
  .addCommand(providerCommand);

program.parse();
