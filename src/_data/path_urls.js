import { downloadJsonBlob } from './_common.js';

export default async function() {
  const urls = await downloadJsonBlob("static_urls.json");
  const url_paths = await downloadJsonBlob("url_blob_paths.json");
  const path_urls = {};
  Object.keys(url_paths).forEach(url => {
    const path = url_paths[url];
    path_urls[path] = url;
  });
  return path_urls;
}