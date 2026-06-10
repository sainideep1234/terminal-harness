import { exec } from 'child_process';
import fs from 'fs/promises';

export type toolReturnType =
  | { success: true; data: unknown }
  | { success: false; errorMessage: string };


export function bashTool(comand: string): toolReturnType {
  const isExecuted = exec(comand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Standard Error: ${stderr}`);
      return;
    }
    console.log(`Output:\n${stdout}`);
  });
  if (isExecuted) return { success: true, data: isExecuted };
  return { success: false, errorMessage: 'comand couldn;t able to execute' };
}

export async function writeFileTool(
  filePath: string,
  content: string,
): Promise<toolReturnType> {
  try {
    const stringifyContent = JSON.stringify(content);
    await fs.writeFile(filePath, stringifyContent);
    return { success: true, data: 'content wirte to file succefully' };
  } catch (error) {
    return { success: false, errorMessage: "can't able to write data" };
  }
}

export async function readFileTool(filePath: string): Promise<toolReturnType> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsedData = JSON.parse(data);
    return { success: true, data: parsedData };
  } catch (error) {
    return { success: false, errorMessage: "can't able to read data" };
  }
}

