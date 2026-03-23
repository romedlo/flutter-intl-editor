
import fs from 'fs';

export function readJsonFile(filePath: string): { [key: string]: string } | null {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
}

export default {
    readJsonFile
};
