const router = require('express').Router();
const mongoose = require('mongoose');
const { Requirement, Resume } = require('./models');
const { startSync, getProgress, rescore } = require('./syncService');

const h = fn => (req, res, next) => fn(req, res, next).catch(next);
const clean = a => (Array.isArray(a) ? a : []).map(s => String(s).trim()).filter(Boolean);
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Accepts a folder URL or a raw ID
const folderId = v => {
  const s = String(v || '').trim();
  return (s.match(/folders\/([\w-]+)/) || s.match(/[?&]id=([\w-]+)/) || [null, s])[1];
};

function pickBody(b) {
  const driveFolderId = folderId(b.driveFolderId);
  const body = {
    title: String(b.title || '').trim(),
    driveFolderId,
    mustHave: clean(b.mustHave),
    niceToHave: clean(b.niceToHave),
    minExperience: Math.max(0, Number(b.minExperience) || 0),
    includeSubfolders: b.includeSubfolders !== false,
  };
  if (!body.title) throw Object.assign(new Error('Title is required'), { status: 400 });
  if (!/^[\w-]+$/.test(driveFolderId || '')) throw Object.assign(new Error('Invalid Drive folder ID/URL'), { status: 400 });
  if (!body.mustHave.length) throw Object.assign(new Error('Add at least one must-have skill'), { status: 400 });
  return body;
}

router.get('/requirements', h(async (_, res) => res.json(await Requirement.find().sort({ createdAt: -1 }))));

router.post('/requirements', h(async (req, res) => res.status(201).json(await Requirement.create(pickBody(req.body)))));

router.put('/requirements/:id', h(async (req, res) => {
  const doc = await Requirement.findByIdAndUpdate(req.params.id, pickBody(req.body), { new: true });
  await rescore(doc._id);
  res.json(doc);
}));

router.delete('/requirements/:id', h(async (req, res) => {
  await Resume.deleteMany({ requirement: req.params.id });
  await Requirement.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

router.post('/requirements/:id/sync', h(async (req, res) => res.json(startSync(req.params.id))));
router.get('/requirements/:id/progress', (req, res) => res.json(getProgress(req.params.id)));

router.get('/requirements/:id/resumes', h(async (req, res) => {
  const { category, q } = req.query;
  const filter = { requirement: req.params.id };
  if (category && category !== 'All') filter.category = category;
  if (q) filter.$or = ['name', 'fileName', 'email'].map(f => ({ [f]: new RegExp(escapeRegex(q), 'i') }));

  const [items, counts] = await Promise.all([
    Resume.find(filter).sort({ score: -1, name: 1 }).lean(),
    Resume.aggregate([
      { $match: { requirement: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: { _id: '$category', n: { $sum: 1 } } },
    ]),
  ]);
  res.json({ items, counts: Object.fromEntries(counts.map(c => [c._id, c.n])) });
}));

router.get('/requirements/:id/export.csv', h(async (req, res) => {
  const items = await Resume.find({ requirement: req.params.id }).sort({ score: -1 }).lean();
  const cols = ['name', 'email', 'phone', 'experienceYears', 'score', 'category', 'matchedMust', 'missingMust', 'fileName', 'webViewLink'];
  const cell = v => {
    let s = String(Array.isArray(v) ? v.join('; ') : v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;           // block spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(','), ...items.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
  res.type('text/csv').attachment('resumes.csv').send(csv);
}));

module.exports = router;