import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

type toolReturnType =
  | { success: true; data: unknown }
  | { success: false; errorMessage: string };

export async function bashTool(command: string): Promise<toolReturnType> {
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, data: stdout || stderr };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, errorMessage: error.message };
    }
    return { success: false, errorMessage: String(error) };
  }
}

export async function writeFileTool(
  filePath: string,
  content: string,
): Promise<toolReturnType> {
  try {
    await fs.writeFile(filePath, content);
    return { success: true, data: 'content written to file successfully' };
  } catch (error) {
    return { success: false, errorMessage: "can't write data" };
  }
}

export async function readFileTool(filePath: string): Promise<toolReturnType> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, errorMessage: "can't read data" };
  }
}
