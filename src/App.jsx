import React, { useEffect, useRef, useState } from 'react';
import ProjectCard from './components/ProjectCard.jsx';
import { dateStamp, slugify } from './lib/utils';
import { deleteMedia, getAllMedia, saveMedia } from './lib/mediaStore';
import { PREVIEW_T, renderCanvas } from './lib/canvasRenderer';
import { archiveProject } from './lib/archive';

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

function calendarDays(month) {
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1;
    return day > 0 && day <= daysInMonth
      ? new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day))
      : null;
  });
}

function monthLabel(value) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(value);
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
      clientId: crypto.randomUUID(),
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
        const usedIds = new Set();
        const projectsWithUniqueIds = stored.map((project) => {
          let projectId = Number(project.id) || 0;
          while (!projectId || usedIds.has(projectId)) projectId += 1;
          usedIds.add(projectId);
          const clientId = project.clientId || crypto.randomUUID();
          return project.id === projectId && project.clientId === clientId
            ? project
            : { ...project, id: projectId, clientId };
        });
        idCounter = projectsWithUniqueIds.reduce((maxId, project) => Math.max(maxId, Number(project.id) || 0), 1);
        return projectsWithUniqueIds;
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
  const [postingCalendarMonth, setPostingCalendarMonth] = useState(() => new Date(`${todayDate()}T12:00:00Z`));
  const [postingCalendarOpen, setPostingCalendarOpen] = useState(false);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState(null);
  const [generatingIds, setGeneratingIds] = useState({});
  const [videoModalProjectId, setVideoModalProjectId] = useState(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoModalRef = useRef(null);
  const [zipping, setZipping] = useState(false);
  const cardRefs = useRef({});

  useEffect(() => {
    function closeDownloadMenus(event) {
      document.querySelectorAll('details.download-menu[open]').forEach((menu) => {
        if (!menu.contains(event.target)) menu.removeAttribute('open');
      });
    }
    document.addEventListener('mousedown', closeDownloadMenus);
    return () => document.removeEventListener('mousedown', closeDownloadMenus);
  }, []);

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
          clientId: crypto.randomUUID(),
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
          clientId: crypto.randomUUID(),
          title: `${source.title} (copy)`,
          picks: source.picks.map((p) => ({ ...p })),
        },
      ];
    });
  }

  function removeProject(id) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    const oldMedia = media[id];
    if (oldMedia?.videoUrl) URL.revokeObjectURL(oldMedia.videoUrl);
    if (oldMedia?.overviewUrl) URL.revokeObjectURL(oldMedia.overviewUrl);
    if (oldMedia?.resultUrl) URL.revokeObjectURL(oldMedia.resultUrl);
    setMedia((prev) => { const next = { ...prev }; delete next[id]; return next; });
    deleteMedia(id).catch(() => {});
    delete cardRefs.current[id];
  }

  function requestDeleteProject(id) {
    const project = projects.find((currentProject) => currentProject.id === id);
    if (project?.status === 'posted') {
      setDeleteConfirmProjectId(id);
      return;
    }
    removeProject(id);
  }

  function confirmDeleteProject() {
    if (deleteConfirmProjectId === null) return;
    removeProject(deleteConfirmProjectId);
    setDeleteConfirmProjectId(null);
  }

  function openPostingDate(id) {
    setPostingProjectId(id);
    const date = todayDate();
    setPostingDate(date);
    setPostingCalendarMonth(new Date(`${date}T12:00:00Z`));
    setPostingCalendarOpen(false);
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
    setGeneratingIds((prev) => { const next = { ...prev }; delete next[id]; return next; });
    const project = projects.find((currentProject) => currentProject.id === id);
    if (project) archiveProject(project, { videoBlob: blob, overviewBlob });
  }

  function startBackgroundGeneration(id) {
    setGeneratingIds((prev) => ({ ...prev, [id]: true }));
    setActiveProjectId(null);
  }

  function finishBackgroundGeneration(id) {
    setGeneratingIds((prev) => { const next = { ...prev }; delete next[id]; return next; });
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
  const videoModalProject = projects.find((project) => project.id === videoModalProjectId);

  function saveProjects() {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    if (activeProject) archiveProject(activeProject, media[activeProject.id]);
    setSaveNotice('Saved');
    window.setTimeout(() => setSaveNotice(''), 1800);
  }

  function renderDeleteModal() {
    if (deleteConfirmProjectId === null) return null;
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteConfirmProjectId(null); }}>
        <div className="delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <span className="section-kicker">Posted video</span>
          <h2 id="delete-modal-title">Delete this posted video?</h2>
          <p>This video is marked as posted. Deleting it will remove its saved video, image, and project data permanently.</p>
          <div className="delete-modal-actions">
            <button type="button" className="back-button" onClick={() => setDeleteConfirmProjectId(null)}>Cancel</button>
            <button type="button" className="modal-delete-button" onClick={confirmDeleteProject}>Delete anyway</button>
          </div>
        </div>
      </div>
    );
  }

  function openVideoModal(id) {
    setVideoModalProjectId(id);
    setVideoPlaying(false);
  }

  function playVideo() {
    videoModalRef.current?.play();
    setVideoPlaying(true);
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
          onRemove={() => requestDeleteProject(activeProject.id)}
          onDuplicate={() => duplicateProject(activeProject.id)}
          onGenerationStart={() => startBackgroundGeneration(activeProject.id)}
          onGenerationEnd={() => finishBackgroundGeneration(activeProject.id)}
          onVideoReady={handleVideoReady}
        />
        {renderDeleteModal()}
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
            <button type="button" className="video-item-delete" onClick={() => requestDeleteProject(p.id)} aria-label={`Delete ${p.title}`} title="Delete video">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
            <button type="button" className="video-thumb video-thumb-button" onClick={() => openVideoModal(p.id)} disabled={!media[p.id]?.videoUrl} aria-label={`Play ${p.title}`}>
              {media[p.id]?.resultUrl || media[p.id]?.overviewUrl ? <img src={media[p.id].resultUrl || media[p.id].overviewUrl} alt={`${p.title} ${p.result || 'overview'} result`} /> : <div className="thumb-placeholder">{mediaLoading ? 'Loading…' : media[p.id]?.videoBlob ? 'Generated' : 'Not generated'}</div>}
            </button>
            <div className="video-item-info">
              <div className="video-item-topline">
                <span className="section-kicker">{p.picks.length} picks · {p.status === 'posted' ? 'Posted' : generatingIds[p.id] ? 'Generating…' : media[p.id]?.videoBlob ? 'Generated' : 'Draft'}</span>
                <div className="video-item-links">
                  <button type="button" className="link-btn link-btn-gold" onClick={() => setActiveProjectId(p.id)}>Open editor</button>
                  {(media[p.id]?.videoUrl || media[p.id]?.resultUrl) && (
                    <details className="download-menu download-menu-top">
                      <summary>Download</summary>
                      <div className="download-menu-options">
                        {media[p.id]?.videoUrl && <a href={media[p.id].videoUrl} download={`${slugify(p.title)}-${dateStamp()}.webm`}>Download video</a>}
                        {media[p.id]?.resultUrl && <a href={media[p.id].resultUrl} download={`${slugify(p.title)}-${p.result}.png`}>Download image</a>}
                      </div>
                    </details>
                  )}
                </div>
              </div>
              <h2>{p.title}</h2>
              <div className="video-picks-description">
                {p.picks.length > 0 ? p.picks.map((pick, index) => <span key={`${pick.match}-${index}`}>{pick.pick} · {Number(pick.odds).toFixed(2)}</span>) : <span>No picks added yet</span>}
              </div>
              <div className="video-item-actions">
                <div className="result-actions">
                  <button type="button" className="hit-button" onClick={() => markResult(p.id, 'hit')} disabled={Boolean(p.result)}>Hit</button>
                  <button type="button" className="miss-button" onClick={() => markResult(p.id, 'miss')} disabled={Boolean(p.result)}>Miss</button>
                </div>
                <button type="button" className="posted-button" onClick={() => openPostingDate(p.id)} disabled={p.status === 'posted'}>
                  <span aria-hidden="true">▣</span> {p.status === 'posted' ? 'Posted' : 'Mark posted'}
                </button>
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
      {postingProjectId !== null && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPostingProjectId(null); }}>
          <div className="posting-modal" role="dialog" aria-modal="true" aria-labelledby="posting-modal-title">
            <span className="section-kicker">Post video</span>
            <h2 id="posting-modal-title">When was this posted?</h2>
            <button type="button" className="posting-date-display" onClick={() => setPostingCalendarOpen((open) => !open)} aria-expanded={postingCalendarOpen}>
              <span aria-hidden="true">▣</span>
              {postedTitle(postingDate)}
            </button>
            {postingCalendarOpen && (
              <div className="posting-calendar calendar-popover">
                <div className="calendar-header">
                  <button type="button" onClick={() => setPostingCalendarMonth((month) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} aria-label="Previous month">‹</button>
                  <strong>{monthLabel(postingCalendarMonth)}</strong>
                  <button type="button" onClick={() => setPostingCalendarMonth((month) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} aria-label="Next month">›</button>
                </div>
                <div className="calendar-weekdays">{['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => <span key={day}>{day}</span>)}</div>
                <div className="calendar-grid">
                  {calendarDays(postingCalendarMonth).map((day, index) => day ? (
                    <button type="button" className={day.toISOString().slice(0, 10) === postingDate ? 'selected' : ''} key={day.toISOString()} onClick={() => { setPostingDate(day.toISOString().slice(0, 10)); setPostingCalendarOpen(false); }}>{day.getUTCDate()}</button>
                  ) : <span className="calendar-empty" key={`posting-empty-${index}`} />)}
                </div>
              </div>
            )}
            <div className="posting-modal-actions">
              <button type="button" className="back-button" onClick={() => setPostingProjectId(null)}>Cancel</button>
              <button type="button" className="back-button today-button" onClick={() => setPostingDate(todayDate())}>Today</button>
              <button type="button" className="save-button" onClick={markPosted}>Post</button>
            </div>
          </div>
        </div>
      )}
      {renderDeleteModal()}
      {videoModalProject && media[videoModalProject.id]?.videoUrl && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVideoModalProjectId(null); }}>
          <div className="video-modal" role="dialog" aria-modal="true" aria-labelledby="video-modal-title">
            <div className="video-modal-header">
              <div>
                <span className="section-kicker">Video preview</span>
                <h2 id="video-modal-title">{videoModalProject.title}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setVideoModalProjectId(null)} aria-label="Close video preview">×</button>
            </div>
            <div className="video-player-shell">
              <video ref={videoModalRef} src={media[videoModalProject.id].videoUrl} poster={media[videoModalProject.id].overviewUrl} onEnded={() => setVideoPlaying(false)} playsInline />
              {!videoPlaying && <button type="button" className="video-play-button" onClick={playVideo} aria-label="Play video">▶</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
