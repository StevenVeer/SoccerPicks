import React, { useEffect, useRef, useState } from 'react';
import ProjectCard from './components/ProjectCard.jsx';
import { dateStamp, slugify } from './lib/utils';
import { deleteMedia, getAllMedia, saveMedia } from './lib/mediaStore';
import { PREVIEW_T, renderCanvas } from './lib/canvasRenderer';

let idCounter = 1;
const PROJECTS_STORAGE_KEY = 'soccer-picks-projects';

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function postedTitle(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}

function createOverviewBlob(project) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  renderCanvas(canvas.getContext('2d'), PREVIEW_T, project);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function defaultProjects() {
  idCounter = 1;
  return [
    {
      id: idCounter,
      title: 'Matchday Picks',
      handle: 'soccer_picks_144',
      disclaimer: '18+ · Bet responsibly',
      picks: [],
    },
  ];
}

export default function App() {
  const [projects, setProjects] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY));
      if (Array.isArray(stored)) {
        idCounter = stored.reduce((maxId, project) => Math.max(maxId, Number(project.id) || 0), 1);
        return stored;
      }
    } catch {
      // Fall back to a clean project when saved data is invalid.
    }
    return defaultProjects();
  });
  const [media, setMedia] = useState({});
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [saveNotice, setSaveNotice] = useState('');
  const [postingProjectId, setPostingProjectId] = useState(null);
  const [postingDate, setPostingDate] = useState(todayDate);
  const [zipping, setZipping] = useState(false);
  const cardRefs = useRef({});

  useEffect(() => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    getAllMedia().then(async (storedMedia) => {
      const hydrated = {};
      for (const item of storedMedia) {
        let overviewBlob = item.overviewBlob;
        if (!overviewBlob && item.videoBlob) {
          const project = projects.find((currentProject) => currentProject.id === item.id);
          if (project) {
            overviewBlob = await createOverviewBlob(project);
            if (overviewBlob) saveMedia(item.id, { ...item, overviewBlob }).catch(() => {});
          }
        }
        hydrated[item.id] = {
          ...item,
          overviewBlob,
          videoUrl: item.videoBlob ? URL.createObjectURL(item.videoBlob) : null,
          overviewUrl: overviewBlob ? URL.createObjectURL(overviewBlob) : null,
          resultUrl: item.resultBlob ? URL.createObjectURL(item.resultBlob) : null,
        };
      }
      setMedia(hydrated);
      setProjects((prev) => prev.map((project) => (
        hydrated[project.id]?.result ? { ...project, result: hydrated[project.id].result } : project
      )));
    }).catch(() => {}).finally(() => setMediaLoading(false));
    return () => Object.values(media).forEach((item) => {
      if (item.videoUrl) URL.revokeObjectURL(item.videoUrl);
      if (item.overviewUrl) URL.revokeObjectURL(item.overviewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateProject(id, updated) {
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  function addProject() {
    idCounter += 1;
    setProjects((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          id: idCounter,
          title: `Video ${prev.length + 1}`,
          handle: 'soccer_picks_144',
          disclaimer: last ? last.disclaimer : '18+ · Bet responsibly',
          picks: [],
        },
      ];
    });
  }

  function duplicateProject(id) {
    idCounter += 1;
    const newId = idCounter;
    setProjects((prev) => {
      const source = prev.find((p) => p.id === id);
      if (!source) return prev;
      return [
        ...prev,
        {
          ...source,
          id: newId,
          title: `${source.title} (copy)`,
          picks: source.picks.map((p) => ({ ...p })),
        },
      ];
    });
  }

  function removeProject(id) {
    if (projects.find((project) => project.id === id)?.status === 'posted') return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    const oldMedia = media[id];
    if (oldMedia?.videoUrl) URL.revokeObjectURL(oldMedia.videoUrl);
    if (oldMedia?.overviewUrl) URL.revokeObjectURL(oldMedia.overviewUrl);
    if (oldMedia?.resultUrl) URL.revokeObjectURL(oldMedia.resultUrl);
    setMedia((prev) => { const next = { ...prev }; delete next[id]; return next; });
    deleteMedia(id).catch(() => {});
    delete cardRefs.current[id];
  }

  function openPostingDate(id) {
    setPostingProjectId(id);
    setPostingDate(todayDate());
  }

  function markPosted() {
    if (!postingProjectId || !postingDate) return;
    setProjects((prev) => prev.map((project) => project.id === postingProjectId
      ? { ...project, status: 'posted', postedDate: postingDate, title: postedTitle(postingDate) }
      : project));
    setPostingProjectId(null);
  }

  function handleVideoReady(id, blob, url, overviewBlob) {
    const oldMedia = media[id];
    if (oldMedia?.videoUrl) URL.revokeObjectURL(oldMedia.videoUrl);
    if (oldMedia?.overviewUrl) URL.revokeObjectURL(oldMedia.overviewUrl);
    const nextMedia = { ...oldMedia, videoBlob: blob, videoUrl: url, overviewBlob, overviewUrl: overviewBlob ? URL.createObjectURL(overviewBlob) : null };
    setMedia((prev) => ({ ...prev, [id]: nextMedia }));
    saveMedia(id, { videoBlob: blob, overviewBlob, resultBlob: oldMedia?.resultBlob, result: oldMedia?.result }).catch(() => {});
  }

  async function markResult(id, result) {
    const project = projects.find((currentProject) => currentProject.id === id);
    if (!project) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    renderCanvas(canvas.getContext('2d'), PREVIEW_T, project);
    const context = canvas.getContext('2d');
    context.save();
    context.translate(540, 960);
    context.rotate(-Math.atan2(1920, 1080));
    context.fillStyle = result === 'hit' ? 'rgba(37, 156, 91, 0.88)' : 'rgba(190, 56, 61, 0.88)';
    context.fillRect(-1000, -90, 2000, 180);
    context.fillStyle = '#F4F2E8';
    context.font = '700 92px Oswald';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(result.toUpperCase(), 0, 0);
    context.restore();
    const resultBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!resultBlob) return;
    const oldMedia = media[id];
    if (oldMedia?.resultUrl) URL.revokeObjectURL(oldMedia.resultUrl);
    const nextMedia = { ...oldMedia, resultBlob, resultUrl: URL.createObjectURL(resultBlob), result };
    setMedia((prev) => ({ ...prev, [id]: nextMedia }));
    setProjects((prev) => prev.map((currentProject) => currentProject.id === id ? { ...currentProject, result } : currentProject));
    await saveMedia(id, { videoBlob: oldMedia?.videoBlob, overviewBlob: oldMedia?.overviewBlob, resultBlob, result });
  }

  async function generateAll() {
    await Promise.allSettled(projects.map((p) => cardRefs.current[p.id]?.generate()));
  }

  async function downloadAllZip() {
    const ready = projects.filter((p) => media[p.id]?.videoBlob);
    if (ready.length === 0) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const usedNames = new Set();
      const today = dateStamp();
      ready.forEach((p) => {
        let name = `${slugify(p.title)}-${today}.webm`;
        let i = 2;
        while (usedNames.has(name)) {
          name = `${slugify(p.title)}-${today}-${i}.webm`;
          i += 1;
        }
        usedNames.add(name);
        zip.file(name, media[p.id].videoBlob);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soccer-picks-videos-${today}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  }

  const readyCount = projects.filter((p) => media[p.id]?.videoBlob).length;
  const activeProject = projects.find((project) => project.id === activeProjectId);

  function saveProjects() {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    setSaveNotice('Saved');
    window.setTimeout(() => setSaveNotice(''), 1800);
  }

  if (activeProject) {
    return (
      <div className="app-wrap editor-wrap">
        <div className="editor-nav">
          <button type="button" className="back-button" onClick={() => setActiveProjectId(null)}>← Cancel</button>
          <button type="button" className="save-button" onClick={saveProjects}>{saveNotice || 'Save'}</button>
        </div>
        <header className="top editor-top">
          <div className="eyebrow">Video editor</div>
          <h1>{activeProject.title}</h1>
          <p className="sub">Build the picks, preview the overview, and generate your next video.</p>
        </header>
        <ProjectCard
          ref={(el) => { cardRefs.current[activeProject.id] = el; }}
          project={activeProject}
          existingVideoUrl={media[activeProject.id]?.videoUrl}
          onChange={(updated) => updateProject(activeProject.id, updated)}
          onRemove={() => { removeProject(activeProject.id); setActiveProjectId(null); }}
          onDuplicate={() => duplicateProject(activeProject.id)}
          onVideoReady={handleVideoReady}
        />
      </div>
    );
  }

  return (
    <div className="app-wrap">
      <header className="top dashboard-top">
        <div className="eyebrow">Content dashboard</div>
        <h1>⚽ Soccer Picks Studio</h1>
        <p className="sub">Your generated picks, ready to review.</p>
      </header>

      <div className="toolbar">
        <button type="button" className="primary" onClick={() => { addProject(); setActiveProjectId(idCounter); }}>
          + New video
        </button>
        <button
          type="button"
          className="primary outline"
          onClick={downloadAllZip}
          disabled={readyCount === 0 || zipping}
        >
          {zipping ? 'Creating zip…' : `Download all (.zip) — ${readyCount}/${projects.length}`}
        </button>
      </div>

      <div className="dashboard-stats">
        <div><b>{projects.length}</b><span>Total videos</span></div>
        <div><b>{projects.filter((p) => p.result === 'hit').length}</b><span>Hits</span></div>
        <div><b>{projects.filter((p) => p.result === 'miss').length}</b><span>Misses</span></div>
        <div><b>{readyCount}</b><span>Generated</span></div>
      </div>
      <div className="video-library">
        {projects.map((p) => (
          <article className="video-item" key={p.id}>
            <button type="button" className="video-item-delete" onClick={() => removeProject(p.id)} aria-label={`Delete ${p.title}`} title={p.status === 'posted' ? 'Posted videos cannot be deleted' : 'Delete video'} disabled={p.status === 'posted'}>×</button>
            <div className="video-thumb">
              {media[p.id]?.resultUrl || media[p.id]?.overviewUrl ? <img src={media[p.id].resultUrl || media[p.id].overviewUrl} alt={`${p.title} ${p.result || 'overview'} result`} /> : <div className="thumb-placeholder">{mediaLoading ? 'Loading…' : media[p.id]?.videoBlob ? 'Generated' : 'Not generated'}</div>}
            </div>
            <div className="video-item-info">
              <span className="section-kicker">{p.picks.length} picks · {p.status === 'posted' ? 'Posted' : media[p.id]?.videoBlob ? 'Generated' : 'Draft'}</span>
              <h2>{p.title}</h2>
              <div className="video-picks-description">
                {p.picks.length > 0 ? p.picks.map((pick, index) => <span key={`${pick.match}-${index}`}>{pick.pick} · {Number(pick.odds).toFixed(2)}</span>) : <span>No picks added yet</span>}
              </div>
              <div className="video-item-actions">
                <button type="button" className="primary" onClick={() => setActiveProjectId(p.id)}>Open editor</button>
                {media[p.id]?.videoUrl && <a className="text-action" href={media[p.id].videoUrl} download={`${slugify(p.title)}-${dateStamp()}.webm`}>Download video</a>}
                {media[p.id]?.resultUrl && <a className="text-action" href={media[p.id].resultUrl} download={`${slugify(p.title)}-${p.result}.png`}>Download image</a>}
                <div className="result-actions"><button type="button" className="hit-button" onClick={() => markResult(p.id, 'hit')}>Hit</button><button type="button" className="miss-button" onClick={() => markResult(p.id, 'miss')}>Miss</button><button type="button" className="posted-button" onClick={() => openPostingDate(p.id)} disabled={p.status === 'posted'}>{p.status === 'posted' ? 'Posted' : 'Mark posted'}</button></div>
                {postingProjectId === p.id && (
                  <div className="posting-date-picker">
                    <label htmlFor={`posted-date-${p.id}`}>Posted date</label>
                    <input id={`posted-date-${p.id}`} type="date" value={postingDate} onChange={(event) => setPostingDate(event.target.value)} />
                    <button type="button" onClick={() => setPostingDate(todayDate())}>Today</button>
                    <button type="button" className="confirm-posted" onClick={markPosted}>Post</button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
        {projects.length === 0 && (
          <div className="empty" style={{ gridColumn: '1 / -1', padding: '40px 0' }}>
            No videos yet — click "+ New video" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
