import path from 'path';

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

export { isDataPath, parseBlobPath, streamToBuffer };