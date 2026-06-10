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

// The runtime shape of a tool call from the AI
export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

const zshCommands: Ttool = {
  name: 'zsh',
  descripiton: 'Run a shell command on zsh',
  options: {
    type: 'object',
    properties: {
      comand: {
        type: 'string',
        description: 'command to run on zsh',
      },
    },
    required: ['comand'],
  },
};

const WriteToFile: Ttool = {
  name: 'file_write',
  descripiton: 'Write content to a file at a given path',
  options: {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: 'absolute file path where content should be written',
      },
      content: {
        type: 'string',
        description: 'content to write into the file',
      },
    },
    required: ['fileName', 'content'],
  },
};

const ReadToFile: Ttool = {
  name: 'read_write',
  descripiton: 'Read the content of a file at a given path',
  options: {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: 'absolute file path to read from',
      },
    },
    required: ['fileName'],
  },
};

export const ALL_TOOLS: Ttool[] = [zshCommands, WriteToFile, ReadToFile];
