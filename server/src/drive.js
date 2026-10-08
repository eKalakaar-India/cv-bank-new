const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({
  version: 'v3',
  auth,
});

const FOLDER = 'application/vnd.google-apps.folder';
const GDOC = 'application/vnd.google-apps.document';

const SUPPORTED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  GDOC,
]);

async function listFiles(rootId, recursive = true) {
  const files = [];
  const queue = [rootId];

  while (queue.length) {
    const id = queue.shift();
    let pageToken;

    do {
      const { data } = await drive.files.list({
        q: `'${id}' in parents and trashed = false`,
        fields:
          'nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      for (const f of data.files) {
        if (f.mimeType === FOLDER) {
          if (recursive) queue.push(f.id);
        } else {
          files.push(f);
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  return files;
}

async function download(file) {
  const res =
    file.mimeType === GDOC
      ? await drive.files.export(
          {
            fileId: file.id,
            mimeType: 'text/plain',
          },
          {
            responseType: 'arraybuffer',
          }
        )
      : await drive.files.get(
          {
            fileId: file.id,
            alt: 'media',
            supportsAllDrives: true,
          },
          {
            responseType: 'arraybuffer',
          }
        );

  return Buffer.from(res.data);
}

module.exports = {
  listFiles,
  download,
  SUPPORTED,
};