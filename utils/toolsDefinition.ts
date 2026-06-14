import { exec } from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type toolReturnType =
  | { success: true; data: unknown }
  | { success: false; errorMessage: string };

// Run any shell command and await its output
export async function bashTool(command: string): Promise<toolReturnType> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    const output = (stdout || '') + (stderr ? `\n[stderr]: ${stderr}` : '');
    return { success: true, data: output || '(no output)' };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error?.message ?? 'Command failed to execute',
    };
  }
}

// Write raw content to a file
export async function writeFileTool(
  filePath: string,
  content: string,
): Promise<toolReturnType> {
  try {
    await fs.writeFile(filePath, content);
    return { success: true, data: `File written: ${filePath}` };
  } catch (error) {
    return { success: false, errorMessage: "can't able to write data" };
  }
}

// Read raw content from a file
export async function readFileTool(filePath: string): Promise<toolReturnType> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, errorMessage: "can't able to read data" };
  }
}

// Search for a text pattern inside files (like grep -rn)
export async function grepSearchTool(
  pattern: string,
  directory: string,
  fileGlob?: string,
): Promise<toolReturnType> {
  try {
    const globFlag = fileGlob ? `--include="${fileGlob}"` : '';
    const cmd = `grep -rn --color=never ${globFlag} "${pattern}" "${directory}" 2>/dev/null | head -100`;
    const { stdout } = await execAsync(cmd);
    return {
      success: true,
      data: stdout || `No matches found for "${pattern}" in ${directory}`,
    };
  } catch (error: any) {
    // grep returns exit code 1 when no matches — not a real error
    return {
      success: true,
      data: `No matches found for "${pattern}" in ${directory}`,
    };
  }
}

// Find files matching a name pattern in a directory (like find)
export async function findFilesTool(
  directory: string,
  namePattern: string,
): Promise<toolReturnType> {
  try {
    const { stdout } = await execAsync(
      `find "${directory}" -name "${namePattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -50`,
    );
    return {
      success: true,
      data: stdout || `No files matching "${namePattern}" found in ${directory}`,
    };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error?.message ?? 'find command failed',
    };
  }
}

// Run a git command (status, diff, log, add, commit, etc.)
export async function gitTool(
  gitCommand: string,
  repoPath: string,
): Promise<toolReturnType> {
  try {
    const { stdout, stderr } = await execAsync(`git -C "${repoPath}" ${gitCommand}`, {
      timeout: 15000,
    });
    const output = (stdout || '') + (stderr ? `\n[stderr]: ${stderr}` : '');
    return { success: true, data: output || '(no output)' };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error?.message ?? 'git command failed',
    };
  }
}

