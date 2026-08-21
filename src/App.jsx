import React, { useRef, useState } from 'react';
import ProjectCard from './components/ProjectCard.jsx';
import { slugify } from './lib/utils';

let idCounter = 1;

function defaultProjects() {
  idCounter = 1;
  return [
    {
      id: idCounter,
      title: 'Speeldag Picks',
      handle: '@jouwaccount',
      disclaimer: '18+ · Speel bewust',
      picks: [
        { match: 'Ajax - PSV', pick: 'Ajax wint', odds: 1.85 },
        { match: 'Feyenoord - AZ', pick: 'Over 2.5 doelpunten', odds: 1.65 },
      ],
    },
  ];
}

export default function App() {
  const [projects, setProjects] = useState(defaultProjects);
  const [videos, setVideos] = useState({}); // projectId -> { blob, url }
  const [zipping, setZipping] = useState(false);
  const cardRefs = useRef({});

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
          handle: last ? last.handle : '@jouwaccount',
          disclaimer: last ? last.disclaimer : '18+ · Speel bewust',
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
          title: `${source.title} (kopie)`,
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
      ready.forEach((p) => {
        let name = `${slugify(p.title)}.webm`;
        let i = 2;
        while (usedNames.has(name)) {
          name = `${slugify(p.title)}-${i}.webm`;
          i += 1;
        }
        usedNames.add(name);
        zip.file(name, videos[p.id].blob);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'soccer-picks-videos.zip';
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
          Beheer meerdere video's tegelijk, elk met eigen picks en odds, en genereer ze allemaal in één keer.
        </p>
      </header>

      <div className="toolbar">
        <button type="button" className="primary" onClick={addProject}>
          + Nieuwe video
        </button>
        <button type="button" className="primary" onClick={generateAll} disabled={projects.length === 0}>
          Genereer alle video's
        </button>
        <button
          type="button"
          className="primary outline"
          onClick={downloadAllZip}
          disabled={readyCount === 0 || zipping}
        >
          {zipping ? 'Zippen…' : `Download alles (.zip) — ${readyCount}/${projects.length}`}
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
            Nog geen video's — klik op "+ Nieuwe video" om te beginnen.
          </div>
        )}
      </div>
    </div>
  );
}
