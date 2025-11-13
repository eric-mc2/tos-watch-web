import { isManifestPath, downloadData, downloadJsonBlob,  } from './_common.js';
import path from 'path';
import { Stages } from './stages.js';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

let cache = null; // Persists during build runtime.

async function getData() {
  if (cache) return cache;
  cache = await downloadData(isManifestPath);
  return cache;
}

export default async function() {
  const datas = await getData();
  const manifest = {};
  datas.forEach(data => {
    const company = data.metadata?.company;
    const policy = data.metadata?.policy;
    data.content.forEach(snap => {
      manifest[`${company}/${policy}/${snap.timestamp}`] = snap.original;
    })
  }); 
  return manifest;
}