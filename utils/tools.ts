import { Type } from '@google/genai';

interface JsonSchema {
  type: string;
  properties: Record<string, { type: string; description: string }>;
  required?: string[];
}

export interface Ttool<Tparameter extends JsonSchema = JsonSchema> {
  name: string;
  descripiton: string;
  options: Tparameter;
}

const zshCommands: Ttool = {
  name: 'zsh',
  descripiton: `zsh --version zsh 5.9 (arm64-apple-darwin25.0)`,
  options: {
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

const WriteToFile: Ttool = {
  name: 'file_write',
  descripiton: 'tool to  write code in file',
  options: {
    type: 'string',
    properties: {
      fileName: {
        type: 'string',
        description: 'file address where need to add the code',
      },
      content: {
        type: 'string ',
        description: 'code to add in a particular file location ',
      },
    },
    required: ['fileName', 'content'],
  },
};

const ReadToFile: Ttool = {
  name: 'read_write',
  descripiton: 'tool to read file content',
  options: {
    type: 'string',
    properties: {
      fileName: {
        type: 'string',
        description: 'file address where need to add the code',
      },
    },
    required: ['fileName'],
  },
};

export const ALL_TOOLS: Ttool[] = [zshCommands, WriteToFile, ReadToFile];
