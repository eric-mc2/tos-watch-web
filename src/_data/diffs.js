import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { streamToBuffer, parseBlobPath, isDataPath } from './_common.js';
import path from 'path';

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
    change_keywords: ["change","keywords"],
    subject_keywords: ["subject","keywords"],
    helm_keywords: ["helm","keywords"],
  }
]

let cache = null; // Persists during build runtime.

export default async function() {
  if (cache) return cache;
  cache = await downloadData();
  return cache;
}

async function downloadData() {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const blobEndpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  
  const dryRun = process.argv.includes('--dry-run');
  const data = [];

  if (!accountName || !accountKey || !blobEndpoint || !containerName) {
    throw new Error('Missing required environment variables. Check your .env file for AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER_NAME');
  }

  try {
    console.log(`Connecting to container: ${containerName}`);
    // Note: Can't use fromConnectionString bc its not interoperable with Azurite URI
    const blobServiceClient = new BlobServiceClient(
      `${blobEndpoint}/${accountName}`, 
      new StorageSharedKeyCredential(accountName, accountKey)
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    const allBlobs = await Array.fromAsync(containerClient.listBlobsFlat());
    const validBlobs = allBlobs.map(b => b.name).filter(isDataPath);
    let blobCount = validBlobs.length;
  
    for (var i = 0; i < blobCount; i ++) {
        const blob = validBlobs[i];
        const blobClient = containerClient.getBlockBlobClient(blob);
        let blobContent = null;
        if (dryRun) {
          console.log(`[DRY RUN] Would download: ${blob} -> ${localFilename}`);
          if (i < DRY_RUN_DATA.length) {
            blobContent = DRY_RUN_DATA[i];
          }
        } else {
          console.log(`Downloading: ${blob}`);
          const downloadResponse = await blobClient.download();
          const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
          const textContent = downloaded.toString('utf-8');
          blobContent = JSON.parse(textContent);
        }
        blobContent['metadata'] = {filepath: blob, ...parseMetadata(blob)}
        data.push(blobContent);
    }

    if (blobCount === 0) {
      console.log('No JSON files found in container');
    } else if (!dryRun) {
      console.log(`✅ Successfully downloaded ${blobCount} JSON files.`);
    } else {
      console.log(`[DRY RUN] Found ${blobCount} JSON files that would be downloaded`);
    }

  } catch (error) {
    throw new Error('Error fetching blob data:', error.message);
  }
  return data;
}

function parseMetadata(filepath) {
  const parsedPath = parseBlobPath(filepath);
  const company = parsedPath.company;
  const policy = parsedPath.policy;
  const ts = parsedPath.timestamp;
  const dataKey = path.join(company, policy, ts);
  const date = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
  const meta = {company, policy, date, dataKey};
  return meta;
}