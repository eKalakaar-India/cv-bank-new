const { Requirement, Resume } = require('./models');
const { listFiles, download, SUPPORTED } = require('./drive');
const { extractText, parseResume } = require('./parser');
const { categorize } = require('./scorer');

const progress = new Map(); // requirementId -> { running, total, done, error }
const idle = { running: false, total: 0, done: 0, error: null };
const getProgress = id => progress.get(String(id)) || idle;

async function processFile(req, file) {
  const existing = await Resume.findOne({ requirement: req._id, driveFileId: file.id }).select('modifiedTime note');
  if (existing && existing.modifiedTime === file.modifiedTime && !(existing.note || '').startsWith('Error')) return;

  const base = {
    requirement: req._id, driveFileId: file.id, fileName: file.name, mimeType: file.mimeType,
    webViewLink: file.webViewLink, modifiedTime: file.modifiedTime,
    text: '', matchedMust: [], missingMust: [], matchedNice: [], score: 0, experienceYears: 0, note: '',
  };
  let data;
  if (!SUPPORTED.has(file.mimeType)) {
    data = { ...base, category: 'Unreadable', note: 'Unsupported type (use PDF, DOCX, TXT or Google Doc)' };
  } else {
    try {
      const text = (await extractText(await download(file), file.mimeType)).trim();
      if (text.length < 80) {
        data = { ...base, category: 'Unreadable', note: 'No readable text (scanned image PDF?)' };
      } else {
        const info = parseResume(text, file.name);
        data = { ...base, ...info, text: text.slice(0, 60000), ...categorize(text, req, info.experienceYears) };
      }
    } catch (e) {
      data = { ...base, category: 'Unreadable', note: `Error: ${e.message}` };
    }
  }
  await Resume.updateOne({ requirement: req._id, driveFileId: file.id }, { $set: data }, { upsert: true });
}

function startSync(reqId) {
  const key = String(reqId);
  if (progress.get(key)?.running) return progress.get(key);
  const state = { running: true, total: 0, done: 0, error: null };
  progress.set(key, state);

  (async () => {
    try {
      const req = await Requirement.findById(reqId);
      const files = await listFiles(req.driveFolderId, req.includeSubfolders);
      state.total = files.length;
      // CVs removed from Drive disappear from the portal
      await Resume.deleteMany({ requirement: req._id, driveFileId: { $nin: files.map(f => f.id) } });

      const queue = [...files];
      const worker = async () => {
        while (queue.length) {
          const f = queue.shift();
          try { await processFile(req, f); } catch (e) { console.error(f.name, e.message); }
          state.done++;
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
    } catch (e) {
      state.error = e.message;
    } finally {
      state.running = false;
    }
  })();
  return state;
}

// Re-categorize stored CVs after a requirement is edited (no Drive download)
async function rescore(reqId) {
  const req = await Requirement.findById(reqId);
  const resumes = await Resume.find({ requirement: reqId, text: { $nin: [null, ''] } }).select('+text experienceYears');
  if (!resumes.length) return;
  await Resume.bulkWrite(resumes.map(r => ({
    updateOne: { filter: { _id: r._id }, update: { $set: categorize(r.text, req, r.experienceYears) } },
  })));
}

module.exports = { startSync, getProgress, rescore };