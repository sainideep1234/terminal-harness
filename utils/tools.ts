import { Type } from '@google/genai';

export const zshCommands = {
  name: 'zsh',
  description: `zsh --version zsh 5.9 (arm64-apple-darwin25.0)`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      comand: {
        type: Type.STRING,
        description: 'comand to runon zsh',
      },
    },
    required: ['comand'],
  },
};
