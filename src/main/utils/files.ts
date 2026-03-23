import CyrillicToTranslit from 'cyrillic-to-translit-js';
import fs from 'fs';
import path from 'path';

const translitUk = CyrillicToTranslit({ preset: 'uk' });

function fileToTranslit(filePath: string, rename = false): string {
  if (!fs.existsSync(filePath)) {
    console.error(`[files] File not found: ${filePath}`);
  }

  try {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const transliterated = translitUk.transform(baseName);
    const newPath = path.join(dir, transliterated + ext);
    if (rename) {
      fs.renameSync(filePath, newPath);
    }

    return newPath;
  } catch (error) {
    console.error(`[files] Rename file has error: ${filePath}`);
    return filePath;
  }
}

export function renameFileToTranslit(filePath: string) {
  return fileToTranslit(filePath, true);
}

export function getTransliteratedPath(filePath: string) {
  return fileToTranslit(filePath, false);
}
