import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { renderCanvas, PREVIEW_T } from '../lib/canvasRenderer';
import { timeline } from '../lib/timeline';
import { recordCanvasVideo } from '../lib/videoRecorder';
import { slugify } from '../lib/utils';

const ProjectCard = forwardRef(function ProjectCard(
  { project, onChange, onRemove, onDuplicate, onVideoReady },
  ref
) {
  const canvasRef = useRef(null);
  const [matchInput, setMatchInput] = useState('');
  const [pickInput, setPickInput] = useState('');
  const [oddsInput, setOddsInput] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | recording | done | error
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);

  // Redraw the static preview whenever the project data changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || status === 'recording') return;
    renderCanvas(canvas.getContext('2d'), PREVIEW_T, project);
  }, [project, status]);

  // Redraw once web fonts are actually loaded (first paint can happen before that).
  useEffect(() => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        const canvas = canvasRef.current;
        if (canvas) renderCanvas(canvas.getContext('2d'), PREVIEW_T, project);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field, value) {
    onChange({ ...project, [field]: value });
  }

  function addPick(e) {
    e.preventDefault();
    setError('');
    const match = matchInput.trim();
    const pickText = pickInput.trim();
    const odds = parseFloat(oddsInput);

    if (!match || !pickText || Number.isNaN(odds) || odds < 1.01) {
      setError('Vul een wedstrijd, pick en geldige odds (≥ 1.01) in.');
      return;
    }
    if (project.picks.length >= 8) {
      setError('Je hebt het maximum van 8 picks bereikt.');
      return;
    }
    onChange({ ...project, picks: [...project.picks, { match, pick: pickText, odds }] });
    setMatchInput('');
    setPickInput('');
    setOddsInput('');
  }

  function removePick(index) {
    onChange({ ...project, picks: project.picks.filter((_, i) => i !== index) });
  }

  async function generate() {
    if (project.picks.length === 0) {
      setError('Voeg eerst minstens 1 pick toe.');
      return null;
    }
    setError('');
    setStatus('recording');
    setProgress(0);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      const blob = await recordCanvasVideo(
        canvasRef.current,
        project,
        timeline,
        renderCanvas,
        (p) => setProgress(p)
      );
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setStatus('done');
      renderCanvas(canvasRef.current.getContext('2d'), PREVIEW_T, project);
      if (onVideoReady) onVideoReady(project.id, blob, url);
      return blob;
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Video-opname mislukt.');
      return null;
    }
  }

  useImperativeHandle(ref, () => ({ generate }));

  const parlay = project.picks.reduce((acc, p) => acc * p.odds, 1);
  const duration = Math.round(timeline(project.picks.length).total / 1000);

  return (
    <div className="project-card">
      <div className="project-card-header">
        <input
          className="project-title-input"
          value={project.title}
          onChange={(e) => updateField('title', e.target.value)}
          aria-label="Titel van de video"
        />
        <div className="project-card-actions">
          <button type="button" onClick={onDuplicate} title="Dupliceren">
            ⧉
          </button>
          <button type="button" onClick={onRemove} title="Verwijderen">
            ✕
          </button>
        </div>
      </div>

      <div className="project-body">
        <div className="project-form">
          <label htmlFor={`handle-${project.id}`}>Account (@handle)</label>
          <input
            id={`handle-${project.id}`}
            type="text"
            value={project.handle}
            onChange={(e) => updateField('handle', e.target.value)}
          />
          <label htmlFor={`disclaimer-${project.id}`}>Disclaimer onderaan</label>
          <input
            id={`disclaimer-${project.id}`}
            type="text"
            value={project.disclaimer}
            onChange={(e) => updateField('disclaimer', e.target.value)}
          />

          <form onSubmit={addPick} className="pick-form">
            <label htmlFor={`match-${project.id}`}>Wedstrijd</label>
            <input
              id={`match-${project.id}`}
              type="text"
              placeholder="Ajax - PSV"
              value={matchInput}
              onChange={(e) => setMatchInput(e.target.value)}
            />
            <div className="grid3">
              <div>
                <label htmlFor={`pick-${project.id}`}>Pick</label>
                <input
                  id={`pick-${project.id}`}
                  type="text"
                  placeholder="Ajax wint"
                  value={pickInput}
                  onChange={(e) => setPickInput(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor={`odds-${project.id}`}>Odds</label>
                <input
                  id={`odds-${project.id}`}
                  type="number"
                  step="0.01"
                  min="1.01"
                  placeholder="1.85"
                  value={oddsInput}
                  onChange={(e) => setOddsInput(e.target.value)}
                />
              </div>
              <div className="add-btn-wrap">
                <button type="submit" className="primary small">
                  +
                </button>
              </div>
            </div>
          </form>
          {error && <div className="error">{error}</div>}

          <div className="pick-list">
            {project.picks.length === 0 && <div className="empty">Nog geen picks toegevoegd.</div>}
            {project.picks.map((p, i) => (
              <div className="pick-row" key={i}>
                <div className="info">
                  <b>{p.match}</b>
                  {p.pick} · <span className="odds">{p.odds.toFixed(2)}</span>
                </div>
                <button type="button" className="del" onClick={() => removePick(i)} title="Verwijderen">
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="parlay-summary">
            <span>Gecombineerde odds ({project.picks.length}/8)</span>
            <b>{project.picks.length ? parlay.toFixed(2) : '—'}</b>
          </div>
        </div>

        <div className="project-preview">
          <div className="phone-frame">
            <div className="phone-screen">
              <canvas ref={canvasRef} width="1080" height="1920" />
            </div>
          </div>

          {status === 'recording' && (
            <div className="progress">
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          )}

          <button type="button" className="primary" onClick={generate} disabled={status === 'recording'}>
            {status === 'recording' ? 'Bezig met opnemen…' : `Video genereren (${duration}s)`}
          </button>

          {videoUrl && (
            <a className="download-link" href={videoUrl} download={`${slugify(project.title)}.webm`}>
              Video downloaden (.webm)
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProjectCard;
