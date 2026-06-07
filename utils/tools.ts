import { Type } from '@google/genai';
import { DESTRUCTION } from 'dns';
import { parseArgs } from 'util';

export const zshCommands = {
  name: 'zsh',
  description: `zsh --version zsh 5.9 (arm64-apple-darwin25.0)`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      comand: {
        type: Type.STRING,
        description: 'comand to run on zsh',
      },
    },
    required: ['comand'],
  },
};

export const writeToFile = {
  nmae: 'write_to_file',
  description: 'use to create and write in file',
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.STRING,
        description: 'code to write in a file',
      },
    },
    required: ['code'],
  },
};
