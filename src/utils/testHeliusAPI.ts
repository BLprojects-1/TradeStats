import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Try to load from different possible locations
const possiblePaths = [
  '.env.local',
  '../.env.local',
  '../../.env.local',
  path.resolve(process.cwd(), '.env.local'),
];

console.log('Current working directory:', process.cwd());
console.log('Checking for .env.local in the following locations:');

possiblePaths.forEach(envPath => {
  console.log(`Checking ${envPath}...`);
  if (fs.existsSync(envPath)) {
    console.log(`Found .env.local at: ${envPath}`);
    dotenv.config({ path: envPath });
  }
});

console.log('\nEnvironment Variables:');
console.log('Helius API Key:', process.env.HELIUS_API_KEY);