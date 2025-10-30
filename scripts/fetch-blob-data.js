#!/usr/bin/env node

import { BlobServiceClient } from '@azure/storage-blob';
import { existsSync } from 'node:fs';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();



async function fetchBlobData() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  const dryRun = process.argv.includes('--dry-run');

  if (!connectionString || !containerName) {
    throw new Error('Missing required environment variables. Check your .env file for AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER_NAME');
  }

  try {
    console.log(`Connecting to container: ${containerName}`);
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const localDataDir = eleventyDataDir();
    const allBlobs = await Array.fromAsync(containerClient.listBlobsFlat());
    const validBlobs = allBlobs.map(b => b.name).filter(isDataPath);
    let blobCount = validBlobs.length;
    let existsCount = 0;

    for (const blob of validBlobs) {
        const blobClient = containerClient.getBlockBlobClient(blob);

        // Clean filename for local use
        const localFilename = blob.replace(/[^a-zA-Z0-9.-/]/g, '_');
        const localPath = path.join(localDataDir, localFilename);
        
        if (existsSync(localPath)) {
          existsCount ++; // Don't need to download
        } else if (dryRun) {
          console.log(`[DRY RUN] Would download: ${blob} -> ${localFilename}`);
        } else {
          console.log(`Downloading: ${blob}`);
          await fs.mkdir(path.dirname(localPath), {recursive: true});
          const downloadResponse = await blobClient.download();
          const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
          const textContent = downloaded.toString('utf-8');
          await fs.writeFile(localPath, textContent);
        }
    }

    if (blobCount === 0) {
      console.log('No JSON files found in container');
    } else if (!dryRun) {
      console.log(`✅ Successfully downloaded ${blobCount - existsCount} JSON files to ${localDataDir}`);
    } else {
      console.log(`[DRY RUN] Found ${blobCount - existsCount} JSON files that would be downloaded`);
    }

  } catch (error) {
    console.error('Error fetching blob data:', error.message);
    process.exit(1);
  }
}

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

/**
 * Summarizes metadata about all local data files.
 */
async function createManifest() {
  const dataDir = eleventyDataDir();
  const allDataFiles = await Array.fromAsync(fs.glob(path.join(dataDir, "**/*.json")));
  const dataFiles = allDataFiles.filter(x => isDataPath(x, dataDir));
  const manifest = await Array.fromAsync(dataFiles.map(summarizeDatafile));
  const manifestStr = JSON.stringify(manifest, null, 2);
  await fs.writeFile(path.join(dataDir, "manifest.json"), manifestStr);
}

/**
 * Summarizes data
 */
async function summarizeDatafile(filepath) {
  const dataDir = eleventyDataDir();
  const dataPath = path.relative(dataDir, filepath);
  const parsedPath = parseBlobPath(filepath, dataDir);
  const ts = parsedPath.timestamp;
  const date = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
  const company = parsedPath.company;
  const policy = parsedPath.policy;
  const textData = await fs.readFile(filepath, 'utf-8');
  const data = JSON.parse(textData);
  const rating = data.legally_substantive.rating + data.practically_substantive.rating;
  const passfail = rating === 0 ? "✅" : rating === 1 ? "⚠️"  : "‼️";
  const meta = {company, policy, date, dataPath, passfail};
  return meta;
}

/**
 * @returns {string} Eleventy default data dir.
 */
function eleventyDataDir() {
    return path.join(process.cwd(), 'src', '_data');
}

/**
 * Parses and validates blob file paths according to the expected format:
 * {container}/{stage}/{company}/{policy}/{timestamp}
 * 
 * @param {string} blobPath - The full blob path to parse
 * @param {string} container - The expected container name (default: "documents")
 * @returns {Object} Object with stage, company, policy, and timestamp properties
 * @throws {Error} If the path doesn't conform to the expected format
 */
function parseBlobPath(blobPath, container = "documents") {
  if (!blobPath || typeof blobPath !== 'string') {
    throw new Error('Blob path must be a non-empty string');
  }
  // Remove container prefix if present
  const pathWithoutContainer = blobPath.startsWith(`${container}/`) 
  ? blobPath.slice(`${container}/`.length)
  : blobPath;
  
  // Split the path into parts
  const pathParts = pathWithoutContainer.split('/');
  
  // Validate path structure: should have exactly 4 parts (stage/company/policy/filename)
  if (pathParts.length !== 4) {
    throw new Error(
      `Invalid blob path format. Expected format: {container}/{stage}/{company}/{policy}/{filename}, ` +
      `but got ${pathParts.length} parts in path: ${blobPath}`
    );
  }
  
  const [stage, company, policy, filename] = pathParts;
  
  // Validate that no part is empty
  if (!stage || !company || !policy || !filename) {
    throw new Error(
      `Invalid blob path format. All path components must be non-empty. ` +
      `Path: ${blobPath}`
    );
  }
  
  
  if (path.extname(filename) != '.json') {
    throw new Error(
      `Invalid extension. Must be json. ` +
      `Filename: ${filename}`
    );
  }
  
  // Extract timestamp from timestamp (timestamp without extension)
  const timestamp = path.parse(filename).name;
  if (!/^[0-9]+$/.test(timestamp)) {
    throw new Error(
      `Invalid timestamp format. timestamp must be numeric. ` +
      `timestamp: ${timestamp}`
    );
  }
  
  // Company name validation (alphanumeric and hyphens and spaces only)
  if (!/^[a-zA-Z0-9- ]+$/.test(company)) {
    throw new Error(
      `Invalid company name "${company}". Must contain only alphanumeric characters and hyphens`
    );
  }
  
  // Policy name validation (alphanumeric, hyphens, spaces, and underscores only)
  if (!/^[a-zA-Z0-9-_ ]+$/.test(policy)) {
    throw new Error(
      `Invalid policy name "${policy}". Must contain only alphanumeric characters, hyphens, and underscores`
    );
  }

  // Stage validation 
  if (stage != "summary_parsed") {
    throw new Error(
      `Invalid stage "${stage}".`
    );
  }

  return {
    stage,
    company,
    policy,
    timestamp
  };
}

/**
 * Predicate wrapper for parsing and validating blob paths.
 * @param {string} filepath 
 * @param {string} container 
 * @returns 
 */
function isDataPath(filepath, container = "documents") {
  try {
    parseBlobPath(filepath, container);
    return true;
  } catch (error) {
    return false;
  }
}


// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchBlobData();
  createManifest();
}

export { fetchBlobData, createManifest};