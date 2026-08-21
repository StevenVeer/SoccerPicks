import React, { useEffect, useRef, useState } from 'react';
import ProjectCard from './components/ProjectCard.jsx';
import { dateStamp, slugify } from './lib/utils';

let idCounter = 1;
const PROJECTS_STORAGE_KEY = 'soccer-picks-projects';

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
  const [videos, setVideos] = useState({}); // projectId -> { blob, url }
  const [zipping, setZipping] = useState(false);
  const cardRefs = useRef({});

  useEffect(() => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

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
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setVideos((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      URL.revokeObjectURL(next[id].url);
      delete next[id];
      return next;
    });
    delete cardRefs.current[id];
  }

  function handleVideoReady(id, blob, url) {
    setVideos((prev) => {
      if (prev[id]) URL.revokeObjectURL(prev[id].url);
      return { ...prev, [id]: { blob, url } };
    });
  }

  async function generateAll() {
    await Promise.allSettled(projects.map((p) => cardRefs.current[p.id]?.generate()));
  }

  async function downloadAllZip() {
    const ready = projects.filter((p) => videos[p.id]);
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
        zip.file(name, videos[p.id].blob);
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

  const readyCount = projects.filter((p) => videos[p.id]).length;

  return (
    <div className="app-wrap">
      <header className="top">
        <div className="eyebrow">TikTok content generator</div>
        <h1>⚽ Soccer Picks Studio</h1>
        <p className="sub">
          Manage multiple videos at once, each with its own picks and odds, and generate them all in one go.
        </p>
      </header>

      <div className="toolbar">
        <button type="button" className="primary" onClick={addProject}>
          + New video
        </button>
        <button type="button" className="primary" onClick={generateAll} disabled={projects.length === 0}>
          Generate all videos
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

      <div className="project-grid">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            ref={(el) => {
              cardRefs.current[p.id] = el;
            }}
            project={p}
            onChange={(updated) => updateProject(p.id, updated)}
            onRemove={() => removeProject(p.id)}
            onDuplicate={() => duplicateProject(p.id)}
            onVideoReady={handleVideoReady}
          />
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
