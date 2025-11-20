import path from 'path';
import { Stages } from './stages.js';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

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
 * Parses and validates blob file paths according to the expected format:
 * {container}/{stage}/{company}/{policy}/{timestamp}
 * 
 * @param {string} blobPath - The full blob path to parse
 * @param {string} container - The expected container name (default: "documents")
 * @returns {Object} Object with stage, company, policy, and timestamp properties
 * @throws {Error} If the path doesn't conform to the expected format
 */
function parseManifestPath(blobPath, container = "documents") {
  const { stage, company, policy, filename } = parseBlobPath(blobPath, container);

  // Stage validation 
  if (stage != Stages.META) {
    throw new Error(
      `Invalid stage "${stage}".`
    );
  }

  if (filename != "manifest.json") {
    throw new Error(`Not a manifest file ${filename}`);
  }
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
function parseSummaryPath(blobPath, container = "documents") {
  const { stage, company, policy, filename } = parseBlobPath(blobPath, container);

  // Stage validation 
  if (stage != Stages.SUMMARY_CLEAN) {
    throw new Error(
      `Invalid stage "${stage}".`
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

}

/**
 * Parses and validates blob file paths according to the expected format:
 * {container}/{stage}/{company}/{policy}/{filename}
 * 
 * @param {string} blobPath - The full blob path to parse
 * @param {string} container - The expected container name (default: "documents")
 * @returns {Object} Object with stage, company, policy, and filename properties
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

  return {
    stage,
    company,
    policy,
    filename
  };
}

/**
 * Predicate wrapper for parsing and validating blob paths.
 * @param {string} filepath 
 * @param {string} container 
 * @returns 
 */
function isSummaryPath(filepath, container = "documents") {
  try {
    parseSummaryPath(filepath, container);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Predicate wrapper for parsing and validating blob paths.
 * @param {string} filepath 
 * @param {string} container 
 * @returns 
 */
function isManifestPath(filepath, container = "documents") {
  try {
    parseManifestPath(filepath, container);
    return true;
  } catch (error) {
    return false;
  }
}

const DRY_RUN_DATA = [
  {
    legally_substantive: {
      rating: false,
      explanation: "words ..."
    },
    practically_substantive: {
      rating: true,
      explanation: "more words ..."
    },
    change_keywords: ["change", "keywords"],
    subject_keywords: ["subject", "keywords"],
    helm_keywords: ["helm", "keywords"],
  }
]

let client = null;

function getClient(){
  if (client) {
    return client;
  }
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const blobEndpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!accountName || !accountKey || !blobEndpoint || !containerName) {
    throw new Error('Missing required environment variables. Check your .env file for AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER_NAME');
  }
  
  console.log(`Connecting to container: ${containerName}`);
  
  // Note: Can't use fromConnectionString bc its not interoperable with Azurite URI
  const blobServiceClient = new BlobServiceClient(
    `${blobEndpoint}`,
    new StorageSharedKeyCredential(accountName, accountKey)
  );
  client = blobServiceClient.getContainerClient(containerName);
  console.log(`Created container client ${containerName}. Container exists: ${client.exists()}`)
  return client;
}

async function downloadBlob(filename) {
  const containerClient = getClient();
  const blobClient = containerClient.getBlockBlobClient(filename);
  const downloadResponse = await blobClient.download();
  const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
  return downloaded;
}

async function downloadJsonBlob(filename) {
  const downloaded = await downloadBlob(filename);
  const textContent = downloaded.toString('utf-8');
  const blobContent = JSON.parse(textContent);
  return blobContent;
}

async function downloadData(fileFilter) {
  const dryRun = process.argv.includes('--dry-run');
  const data = [];
  let allBlobs = null;

  try {
    allBlobs = await Array.fromAsync(getClient().listBlobsFlat());
  } catch (error) {
    throw new Error('Error fetching blob list:', error.message);
  }

  const validBlobs = allBlobs.map(b => b.name).filter(fileFilter);
  let blobCount = validBlobs.length;

  for (var i = 0; i < blobCount; i++) {
    const blob = validBlobs[i];
    let blobContent = null;
    if (dryRun) {
      console.log(`[DRY RUN] Would download: ${blob} -> ${localFilename}`);
      if (i < DRY_RUN_DATA.length) {
        blobContent = DRY_RUN_DATA[i];
      }
    } else {
      console.log(`Downloading: ${blob}`);
      try {
        blobContent = await downloadJsonBlob(blob);
      } catch (error) {
        throw new Error('Error downloading blob:', error.message);
      }
    }
    data.push({ metadata: parseMetadata(blob), content: blobContent });
  }

  if (blobCount === 0) {
    console.log('No JSON files found in container');
  } else if (!dryRun) {
    console.log(`✅ Successfully downloaded ${blobCount} JSON files.`);
  } else {
    console.log(`[DRY RUN] Found ${blobCount} JSON files that would be downloaded`);
  }

  
  return data;
}

function parseMetadata(filepath) {
  const parsedPath = parseBlobPath(filepath);
  const company = parsedPath.company;
  const policy = parsedPath.policy;
  const fname = path.parse(parsedPath.filename).name;
  const dataKey = path.join(company, policy, fname);
  let date = undefined;
  if (isSummaryPath(filepath)) {
    date = `${fname.slice(0, 4)}-${fname.slice(4, 6)}-${fname.slice(6, 8)}`;
  }
  const meta = { filepath, company, policy, date, dataKey };
  return meta;
}

export { isManifestPath, isSummaryPath, downloadData, downloadJsonBlob };