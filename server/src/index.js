require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'https://cv-bank-new-fiz3.vercel.app' }));
app.use(express.json());
app.use('/api', require('./routes'));

// Production: serve the built React app from the same port
const dist = path.join(__dirname, '../../client/dist');
app.use(express.static(dist));
app.get('{*splat}', (_, res) => res.sendFile(path.join(dist, 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Portal running on :${PORT}`)))
  .catch(e => { console.error('Mongo connection failed', e.message); process.exit(1); });