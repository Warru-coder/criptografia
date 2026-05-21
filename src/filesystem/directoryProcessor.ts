import fs from 'fs';
import path from 'path';
import { scanDirectory, isExcluded } from './fileScanner';
import { encryptFile, EncryptProgress } from '../crypto/fileCipher';
import { decryptFile, DecryptProgress } from '../crypto/fileDecipher';
import { isCriticalSystemPath } from './systemExclusions';
import { ENCRYPTED_EXTENSION } from '../core/constants';
import { FileError, CryptoError } from '../core/errorHandler';

export interface DirectoryProgress {
  currentFile: number;
  totalFiles: number;
  currentFilename: string;
  fileProgress: number;
  overallPercentage: number;
  errors: string[];
}

export interface DirectoryResult {
  processedFiles: number;
  failedFiles: number;
  totalSize: number;
  errors: string[];
  outputDir: string;
}

export async function encryptDirectory(
  inputDir: string,
  outputDir: string,
  masterKey: Buffer,
  onProgress?: (progress: DirectoryProgress) => void
): Promise<DirectoryResult> {
  if (!fs.existsSync(inputDir)) {
    throw new FileError(`Directory not found: ${inputDir}`);
  }

  if (!fs.statSync(inputDir).isDirectory()) {
    throw new FileError(`Path is not a directory: ${inputDir}`);
  }

  if (isCriticalSystemPath(inputDir)) {
    throw new CryptoError(`Cannot encrypt critical system path: ${inputDir}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = scanDirectory(inputDir);
  const validFiles = files.filter((f) => !isExcluded(f.path));

  const result: DirectoryResult = {
    processedFiles: 0,
    failedFiles: 0,
    totalSize: 0,
    errors: [],
    outputDir,
  };

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];

    const relativePath = path.relative(inputDir, file.path);
    const outputPath = path.join(outputDir, relativePath + ENCRYPTED_EXTENSION);

    const outputSubDir = path.dirname(outputPath);
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true });
    }

    try {
      await encryptFile(file.path, outputPath, masterKey, (fileProg: EncryptProgress) => {
        if (onProgress) {
          onProgress({
            currentFile: i + 1,
            totalFiles: validFiles.length,
            currentFilename: path.basename(file.path),
            fileProgress: fileProg.percentage,
            overallPercentage: Math.round(((i + fileProg.percentage / 100) / validFiles.length) * 100),
            errors: result.errors,
          });
        }
      });

      result.processedFiles++;
      result.totalSize += file.size;
    } catch (error) {
      result.failedFiles++;
      result.errors.push(`Failed to encrypt ${file.path}: ${(error as Error).message}`);
    }
  }

  return result;
}

export async function decryptDirectory(
  inputDir: string,
  outputDir: string,
  masterKey: Buffer,
  onProgress?: (progress: DirectoryProgress) => void
): Promise<DirectoryResult> {
  if (!fs.existsSync(inputDir)) {
    throw new FileError(`Directory not found: ${inputDir}`);
  }

  if (!fs.statSync(inputDir).isDirectory()) {
    throw new FileError(`Path is not a directory: ${inputDir}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const allFiles = scanDirectory(inputDir);
  const encryptedFiles = allFiles.filter((f) => f.path.endsWith(ENCRYPTED_EXTENSION));

  const result: DirectoryResult = {
    processedFiles: 0,
    failedFiles: 0,
    totalSize: 0,
    errors: [],
    outputDir,
  };

  for (let i = 0; i < encryptedFiles.length; i++) {
    const file = encryptedFiles[i];

    const relativePath = path.relative(inputDir, file.path);
    const decryptedName = path.basename(file.path).slice(0, -ENCRYPTED_EXTENSION.length);
    const outputPath = path.join(outputDir, path.dirname(relativePath), decryptedName);

    const outputSubDir = path.dirname(outputPath);
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true });
    }

    try {
      await decryptFile(file.path, outputPath, masterKey, (fileProg: DecryptProgress) => {
        if (onProgress) {
          onProgress({
            currentFile: i + 1,
            totalFiles: encryptedFiles.length,
            currentFilename: path.basename(file.path),
            fileProgress: fileProg.percentage,
            overallPercentage: Math.round(((i + fileProg.percentage / 100) / encryptedFiles.length) * 100),
            errors: result.errors,
          });
        }
      });

      result.processedFiles++;
      result.totalSize += file.size;
    } catch (error) {
      result.failedFiles++;
      result.errors.push(`Failed to decrypt ${file.path}: ${(error as Error).message}`);
    }
  }

  return result;
}
