import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { renderCanvas, PREVIEW_T } from '../lib/canvasRenderer';
import { timeline } from '../lib/timeline';
import { recordCanvasVideo } from '../lib/videoRecorder';
import { dateStamp, slugify } from '../lib/utils';
import MatchPicker from './MatchPicker.jsx';

function getDescription(pickCount) {
  const pickLabel = pickCount === 1 ? 'pick' : 'picks';
  return `⚽️ ${pickCount} football ${pickLabel} I’m backing today 👀

Which one are you taking? 👇
Follow for daily football predictions & value bets 📈

#football #footballtips #footballpredictions #bettingtips #soccer #soccerbets #valuebets #footballbetting #bettingpicks #sportsbetting`;
}

const ProjectCard = forwardRef(function ProjectCard(
  { project, onChange, onRemove, onDuplicate, onVideoReady },
  ref
) {
  const canvasRef = useRef(null);
  const previewFrameRef = useRef(null);
  const [homeTeamInput, setHomeTeamInput] = useState('');
  const [awayTeamInput, setAwayTeamInput] = useState('');
  const [pickInput, setPickInput] = useState('');
  const [oddsInput, setOddsInput] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | recording | done | error
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [draggedPickIndex, setDraggedPickIndex] = useState(null);
  const [descriptionCopied, setDescriptionCopied] = useState(false);

  // Redraw the static preview whenever the project data changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || status === 'recording' || isPreviewing) return;
    renderCanvas(canvas.getContext('2d'), PREVIEW_T, project);
  }, [project, status, isPreviewing]);

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
      if (previewFrameRef.current) cancelAnimationFrame(previewFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field, value) {
    onChange({ ...project, [field]: value });
  }

  function formatOddsInput() {
    const odds = parseFloat(oddsInput);
    if (!Number.isNaN(odds)) setOddsInput(odds.toFixed(2));
  }

  function addPick(e) {
    e.preventDefault();
    setError('');
    const homeTeam = homeTeamInput.trim();
    const awayTeam = awayTeamInput.trim();
    const match = homeTeam && awayTeam ? `${homeTeam} - ${awayTeam}` : '';
    const pickText = pickInput.trim();
    const odds = parseFloat(oddsInput);

    if (!match || !pickText || Number.isNaN(odds) || odds < 1.01) {
      setError('Enter both teams, a pick, and valid odds (≥ 1.01).');
      return;
    }
    if (project.picks.length >= 8) {
      setError('You have reached the maximum of 8 picks.');
      return;
    }
    onChange({ ...project, picks: [...project.picks, { match, pick: pickText, odds }] });
    setHomeTeamInput('');
    setAwayTeamInput('');
    setPickInput('');
    setOddsInput('');
  }

  function addLivePick(pick) {
    setError('');
    const existingIndex = project.picks.findIndex((currentPick) => (
      currentPick.match === pick.match &&
      currentPick.pick === pick.pick &&
      currentPick.market === pick.market
    ));
    if (existingIndex >= 0) {
      onChange({ ...project, picks: project.picks.filter((_, index) => index !== existingIndex) });
      return;
    }
    if (project.picks.length >= 8) {
      setError('You have reached the maximum of 8 picks.');
      return;
    }
    onChange({ ...project, picks: [...project.picks, pick] });
  }

  function removePick(index) {
    onChange({ ...project, picks: project.picks.filter((_, i) => i !== index) });
  }

  function clearPicks() {
    onChange({ ...project, picks: [] });
  }

  function reorderPick(targetIndex) {
    if (draggedPickIndex === null || draggedPickIndex === targetIndex) return;
    const reorderedPicks = [...project.picks];
    const [draggedPick] = reorderedPicks.splice(draggedPickIndex, 1);
    reorderedPicks.splice(targetIndex, 0, draggedPick);
    onChange({ ...project, picks: reorderedPicks });
  }

  function handlePickDragStart(event, index) {
    event.dataTransfer.effectAllowed = 'move';
    setDraggedPickIndex(index);
  }

  function handlePickDrop(event, index) {
    event.preventDefault();
    reorderPick(index);
    setDraggedPickIndex(null);
  }

  async function copyDescription() {
    try {
      await navigator.clipboard.writeText(getDescription(project.picks.length));
      setDescriptionCopied(true);
      window.setTimeout(() => setDescriptionCopied(false), 1800);
    } catch {
      setError('Could not copy the description.');
    }
  }

  function playPreview() {
    if (isPreviewing || status === 'recording') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = timeline(project.picks.length).total;
    const start = performance.now();

    setIsPreviewing(true);

    function frame(now) {
      const elapsed = now - start;
      renderCanvas(ctx, elapsed, project);
      if (elapsed < total) {
        previewFrameRef.current = requestAnimationFrame(frame);
      } else {
        previewFrameRef.current = null;
        setIsPreviewing(false);
      }
    }

    previewFrameRef.current = requestAnimationFrame(frame);
  }

  async function generate() {
    if (project.picks.length === 0) {
      setError('Add at least 1 pick first.');
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
      setError(err.message || 'Video recording failed.');
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
          aria-label="Video title"
        />
        <div className="project-card-actions">
          <button type="button" onClick={onDuplicate} title="Duplicate">
            ⧉
          </button>
          <button type="button" onClick={onRemove} title="Remove">
            ✕
          </button>
        </div>
      </div>

      <div className="project-body">
        <div className="project-form">
          <label htmlFor={`handle-${project.id}`}>Account name</label>
          <div className="account-field">
            <div className="profile-avatar" aria-hidden="true">⚽</div>
            <input
              id={`handle-${project.id}`}
              type="text"
              value="soccer_picks_144"
              readOnly
            />
          </div>
          <label htmlFor={`disclaimer-${project.id}`}>Footer disclaimer</label>
          <input
            id={`disclaimer-${project.id}`}
            type="text"
            value={project.disclaimer}
            onChange={(e) => updateField('disclaimer', e.target.value)}
          />

          <MatchPicker picks={project.picks} onAddPick={addLivePick} disabled={project.picks.length >= 8} />

          <form onSubmit={addPick} className="pick-form">
            <label htmlFor={`match-${project.id}`}>Match</label>
            <div className="match-teams">
              <input
                id={`home-team-${project.id}`}
                type="text"
                placeholder="Arsenal"
                value={homeTeamInput}
                onChange={(e) => setHomeTeamInput(e.target.value)}
                aria-label="Home team"
              />
              <span aria-hidden="true">-</span>
              <input
                id={`away-team-${project.id}`}
                type="text"
                placeholder="Coventry City"
                value={awayTeamInput}
                onChange={(e) => setAwayTeamInput(e.target.value)}
                aria-label="Away team"
              />
            </div>
            <div className="grid3">
              <div>
                <label htmlFor={`pick-${project.id}`}>Pick</label>
                <input
                  id={`pick-${project.id}`}
                  type="text"
                  placeholder="Ajax wins"
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
                  onBlur={formatOddsInput}
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

          <div className="pick-list-heading">
            <span>Added picks</span>
            <button type="button" className="clear-picks" onClick={clearPicks} disabled={project.picks.length === 0}>
              Clear all
            </button>
          </div>
          <div className="pick-list">
            {project.picks.length === 0 && <div className="empty">No picks added yet.</div>}
            {project.picks.map((p, i) => (
              <div
                className={`pick-row${draggedPickIndex === i ? ' dragging' : ''}`}
                key={i}
                draggable
                onDragStart={(event) => handlePickDragStart(event, i)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handlePickDrop(event, i)}
                onDragEnd={() => setDraggedPickIndex(null)}
              >
                <span className="drag-handle" aria-hidden="true">⋮⋮</span>
                <div className="info">
                  <b>{p.match}</b>
                  {p.pick} · <span className="odds">{p.odds.toFixed(2)}</span>
                </div>
                <button type="button" className="del" onClick={() => removePick(i)} title="Remove">
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="parlay-summary">
            <span>Combined odds ({project.picks.length}/8)</span>
            <b>{project.picks.length ? parlay.toFixed(2) : '—'}</b>
          </div>

          <div className="description-section">
            <div className="description-heading">
              <span>Description</span>
              <button type="button" className="copy-description" onClick={copyDescription}>
                {descriptionCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="description-text">{getDescription(project.picks.length)}</div>
          </div>
        </div>

        <div className="project-preview">
          <div className="phone-frame">
            <div className="phone-screen">
              <canvas ref={canvasRef} width="1080" height="1920" />
              <button
                type="button"
                className="preview-play-button"
                onClick={playPreview}
                disabled={isPreviewing || status === 'recording'}
                aria-label={isPreviewing ? 'Playing preview' : 'Play preview'}
              >
                {isPreviewing ? '❚❚' : '▶'}
              </button>
            </div>
          </div>

          {status === 'recording' && (
            <div className="progress">
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          )}

          <button type="button" className="primary" onClick={generate} disabled={status === 'recording' || isPreviewing}>
            {status === 'recording' ? 'Recording…' : `Generate video (${duration}s)`}
          </button>

          {videoUrl && (
            <a
              className="primary download-link"
              href={videoUrl}
              download={`${slugify(project.title)}-${dateStamp()}.webm`}
            >
              Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProjectCard;
