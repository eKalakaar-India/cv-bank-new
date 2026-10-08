const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  driveFolderId: { type: String, required: true, trim: true },
  mustHave: [String],   // synonyms allowed: "React|ReactJS|React.js"
  niceToHave: [String],
  minExperience: { type: Number, default: 0 },
  includeSubfolders: { type: Boolean, default: true },
}, { timestamps: true });

const resumeSchema = new mongoose.Schema({
  requirement: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', index: true },
  driveFileId: String,
  fileName: String,
  mimeType: String,
  webViewLink: String,
  modifiedTime: String,
  name: String, email: String, phone: String,
  experienceYears: { type: Number, default: 0 },
  text: { type: String, select: false },   // kept so re-scoring needs no re-download
  matchedMust: [String], missingMust: [String], matchedNice: [String],
  score: { type: Number, default: 0 },
  category: { type: String, enum: ['Shortlisted', 'Potential', 'Not a Match', 'Unreadable'], index: true },
  note: String,
}, { timestamps: true });
resumeSchema.index({ requirement: 1, driveFileId: 1 }, { unique: true });

module.exports = {
  Requirement: mongoose.model('Requirement', requirementSchema),
  Resume: mongoose.model('Resume', resumeSchema),
};
