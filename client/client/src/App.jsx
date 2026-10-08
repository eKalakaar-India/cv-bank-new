import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

const CATS = ['All', 'Shortlisted', 'Potential', 'Not a Match', 'Unreadable'];
const emptyForm = { title: '', driveFolderId: '', mustHave: '', niceToHave: '', minExperience: 0, includeSubfolders: true };
const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

export default function App() {
  const [reqs, setReqs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => setReqs(await api.listReqs()), []);
  useEffect(() => { load(); }, [load]);
  const current = reqs.find(r => r._id === selected);

  return (
    <div className="layout">
      <aside>
        <h2>Requirements</h2>
        <button onClick={() => setForm(emptyForm)}>+ New requirement</button>
        {reqs.map(r => (
          <div key={r._id} className={'item' + (r._id === selected ? ' active' : '')}
               onClick={() => { setSelected(r._id); setForm(null); }}>
            {r.title}
          </div>
        ))}
      </aside>
      <main>
        {form ? (
          <RequirementForm initial={form} onCancel={() => setForm(null)}
            onDone={async id => { await load(); if (id) setSelected(id); setForm(null); }} />
        ) : current ? (
          <Board key={current._id} req={current}
            onEdit={() => setForm({ ...current, mustHave: current.mustHave.join('\n'), niceToHave: current.niceToHave.join('\n') })}
            onDeleted={async () => { setSelected(null); await load(); }} />
        ) : <p className="muted">Create or pick a requirement to begin.</p>}
      </main>
    </div>
  );
}

function RequirementForm({ initial, onDone, onCancel }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async e => {
    e.preventDefault();
    const body = { ...f, mustHave: lines(f.mustHave), niceToHave: lines(f.niceToHave) };
    try {
      const saved = f._id ? await api.updateReq(f._id, body) : await api.createReq(body);
      onDone(saved._id);
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <form className="card" onSubmit={save}>
      <h2>{f._id ? 'Edit' : 'New'} requirement</h2>
      <label>Role / title<input value={f.title} onChange={set('title')} required /></label>
      <label>Google Drive folder (URL or ID)<input value={f.driveFolderId} onChange={set('driveFolderId')} required /></label>
      <label>Must-have skills (one per line; synonyms with |)
        <textarea rows={6} value={f.mustHave} onChange={set('mustHave')} placeholder={'React|ReactJS|React.js\nNode.js|NodeJS\nMongoDB'} />
      </label>
      <label>Nice-to-have skills (one per line)
        <textarea rows={4} value={f.niceToHave} onChange={set('niceToHave')} placeholder={'TypeScript\nDocker'} />
      </label>
      <label>Minimum experience (years)<input type="number" min="0" step="0.5" value={f.minExperience} onChange={set('minExperience')} /></label>
      <label className="row"><input type="checkbox" checked={f.includeSubfolders} onChange={set('includeSubfolders')} /> Include subfolders</label>
      {err && <p className="error">{err}</p>}
      <div className="row"><button type="submit">Save</button><button type="button" className="ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function Board({ req, onEdit, onDeleted }) {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ items: [], counts: {} });
  const [prog, setProg] = useState(null);

  const refresh = useCallback(async () => setData(await api.resumes(req._id, { category: cat, q })), [req._id, cat, q]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { api.progress(req._id).then(setProg); }, [req._id]);

  useEffect(() => {              // poll while a sync is running
    if (!prog?.running) return;
    const t = setInterval(async () => { setProg(await api.progress(req._id)); refresh(); }, 2000);
    return () => clearInterval(t);
  }, [prog?.running, req._id, refresh]);

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const remove = async () => {
    if (confirm(`Delete "${req.title}" and its categorized CVs? (Drive files are untouched)`)) {
      await api.deleteReq(req._id); onDeleted();
    }
  };

  return (
    <>
      <div className="head">
        <div>
          <h2>{req.title}</h2>
          <p className="muted">Must: {req.mustHave.map(s => s.split('|')[0]).join(', ')} · Min exp: {req.minExperience} yrs</p>
        </div>
        <div className="row">
          <button onClick={async () => setProg(await api.sync(req._id))} disabled={prog?.running}>
            {prog?.running ? `Processing ${prog.done}/${prog.total}…` : 'Sync & categorize'}
          </button>
          <a className="btn ghost" href={`/api/requirements/${req._id}/export.csv`}>Export CSV</a>
          <button className="ghost" onClick={onEdit}>Edit</button>
          <button className="ghost danger" onClick={remove}>Delete</button>
        </div>
      </div>
      {prog?.error && <p className="error">Sync failed: {prog.error}</p>}

      <div className="tabs">
        {CATS.map(c => (
          <button key={c} className={c === cat ? 'tab on' : 'tab'} onClick={() => setCat(c)}>
            {c} ({c === 'All' ? total : data.counts[c] || 0})
          </button>
        ))}
        <input placeholder="Search name / email / file" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <table>
        <thead><tr><th>Candidate</th><th>Exp</th><th>Score</th><th>Category</th><th>Matched</th><th>Missing</th><th>CV</th></tr></thead>
        <tbody>
          {data.items.map(r => (
            <tr key={r._id}>
              <td><b>{r.name}</b><div className="muted">{r.email} {r.phone}</div></td>
              <td>{r.experienceYears} y</td>
              <td>{r.score}</td>
              <td><span className={'badge ' + r.category.replace(/\s/g, '')}>{r.category}</span>{r.note && <div className="muted">{r.note}</div>}</td>
              <td>{[...r.matchedMust, ...r.matchedNice].join(', ')}</td>
              <td className="miss">{r.missingMust.join(', ')}</td>
              <td><a href={r.webViewLink} target="_blank" rel="noreferrer">Open</a></td>
            </tr>
          ))}
          {!data.items.length && <tr><td colSpan="7" className="muted">No CVs yet. Click “Sync & categorize”.</td></tr>}
        </tbody>
      </table>
    </>
  );
}