import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import path from 'path';
import { objectify } from 'postcss-js';
import { Stages } from './stages.js';

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
  const parts = parseBlobPath(blobPath, container);
  if (Object.keys(parts).length != 4) {
    throw new Error(`Not a manifest file ${filename}`)
  }

  const { stage, company, policy, filename } = parts;

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
  const parts = parseBlobPath(blobPath, container);
  if (Object.keys(parts).length != 5) {
    throw new Error(`Not a summary file ${filename}`)
  }
  
  const { stage, company, policy, timestamp, filename } = parts;

  // Stage validation 
  if (stage != Stages.SUMMARY_CLEAN) {
    throw new Error(
      `Invalid stage "${stage}".`
    );
  }

  // Timestamp validation
  if (!/^[0-9]+$/.test(timestamp)) {
    throw new Error(
      `Invalid timestamp format. timestamp must be numeric. ` +
      `timestamp: ${timestamp}`
    );
  }

  // Filename valdation
  if (filename !== "latest.json") {
    throw new Error(`Not a latest file ${filename}`)
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
function parseDiffPath(blobPath, container = "documents") {
  const parts = parseBlobPath(blobPath, container);
  if (Object.keys(parts).length != 4) {
    throw new Error(`Not a diff file ${filename}`)
  }
  
  const { stage, company, policy, filename} = parts;

  // Stage validation 
  if (stage !== Stages.DIFF_SPAN) {
    throw new Error(
      `Invalid stage "${stage}".`
    );
  }

  // Timestamp validation
  const timestamp = filename.replace(".json","");
  if (!/^[0-9]+$/.test(timestamp)) {
    throw new Error(
      `Invalid timestamp format. timestamp must be numeric. ` +
      `timestamp: ${timestamp}`
    );
  }

  // Filename valdation;
  if (!filename.endsWith(".json") ) {
    throw new Error(`Not a json file ${filename}`)
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

  // Validate path structure: should have exactly 4-5 parts (stage/company/policy/filename)
  if (pathParts.length == 4) {
    return parseTimestampPath(...pathParts);
  }
  else if (pathParts.length == 5) {
    return parseVersionPath(...pathParts);
  }
  else {
    throw new Error(
      `Invalid blob path format. Expected format: {container}/{stage}/{company}/{policy}/{filename}, ` +
      `but got ${pathParts.length} parts in path: ${blobPath}`
    );
  }
}

/**
 * Parses and validates blob file paths according to the expected format:
 * {container}/{stage}/{company}/{policy}/{filename}
 * 
 * @returns {Object} Object with stage, company, policy, and filename properties
 * @throws {Error} If the path doesn't conform to the expected format
 */
function parseBasePath(stage, company, policy, ...args) {
  // Validate that no part is empty
  if (!stage || !company || !policy) {
    throw new Error(
      `Invalid blob path format. All path components must be non-empty. ` +
      `Path: ${blobPath}`
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
}
function parseTimestampPath(stage, company, policy, filename) {
  parseBasePath(stage, company, policy);
  // Validate that no part is empty
  if (!filename) {
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
  return {stage, company, policy, filename};
}
function parseVersionPath(stage, company, policy, timestamp, filename) {
  parseBasePath(stage, company, policy);
  // Validate that no part is empty
  if (!timestamp || !filename) {
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
  return {stage, company, policy, timestamp, filename};
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
function isDiffPath(filepath, container = "documents") {
  try {
    parseDiffPath(filepath, container);
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
  try {
    const downloaded = await downloadBlob(filename);
    const textContent = downloaded.toString('utf-8');
    const blobContent = JSON.parse(textContent);
    return blobContent;
  } catch (error) {
    throw new Error(`Error downloading blob: ${filename} `, error.message);
  }
}

async function listBlobs() {
  try {
    let blobs = [];
    for await (const blob of getClient().listBlobsFlat()) {
      blobs.push(blob);
    }
    return blobs
  } catch (error) {
    throw new Error('Error fetching blob list:', error.message);
  }
}

async function downloadJsonData(fileFilter) {
  return await downloadData(fileFilter, downloadJsonBlob);
}

async function downloadTextData(fileFilter) {
  return await downloadData(fileFilter, downloadBlob);
}

async function downloadData(fileFilter, downloader) {
  const data = [];

  const allBlobs = await listBlobs();
  const validBlobs = allBlobs.map(b => b.name).filter(fileFilter);
  let blobCount = validBlobs.length;

  for (var i = 0; i < blobCount; i++) {
    const blob = validBlobs[i];
    let blobContent = null;
    console.log(`Downloading: ${blob}`);
    blobContent = await downloader(blob);
    data.push({ metadata: parseMetadata(blob), content: blobContent });
  }

  if (blobCount === 0) {
    console.log('No JSON files found in container');
  } else {
    console.log(`✅ Successfully downloaded ${blobCount} JSON files.`);
  } 
  
  return data;
}

function parseMetadata(filepath) {
  const parsedPath = parseBlobPath(filepath);
  if (Object.keys(parsedPath).length == 4) {
    return parseMetadata4(filepath, parsedPath);
  } else {
    return parseMetadata5(filepath, parsedPath);
  }
}
function parseMetadataBase(filepath, parsedPath) {
  const company = parsedPath.company;
  const policy = parsedPath.policy;
  const meta = {filepath, company, policy};
  return meta;
}
function parseMetadata4(filepath, parsedPath) {
  let meta = parseMetadataBase(filepath, parsedPath);
  const timestamp = path.parse(parsedPath.filename).name;
  const dataKey = path.join(parsedPath.company, parsedPath.policy, timestamp);
  const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
  meta = { ...meta, date, dataKey };
  return meta;
}
function parseMetadata5(filepath, parsedPath) {
  let meta = parseMetadataBase(filepath, parsedPath);
  const timestamp = parsedPath.timestamp;
  const dataKey = path.join(parsedPath.company, parsedPath.policy, timestamp);
  const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
  meta = { ...meta, date, dataKey };
  return meta;
}

export { downloadJsonData, downloadTextData, downloadJsonBlob, isManifestPath, isSummaryPath, isDiffPath};
