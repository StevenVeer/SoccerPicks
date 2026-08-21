export function pickMimeType() {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

// Records a canvas element by re-running renderFn(ctx, t, project) every frame
// for the duration given by timelineFn(project.picks.length).total, then
// resolves with the resulting video Blob. Each call owns its own stream and
// MediaRecorder, so several projects can record at the same time.
export function recordCanvasVideo(canvas, project, timelineFn, renderFn, onProgress) {
  return new Promise((resolve, reject) => {
    if (!canvas || !canvas.captureStream || !window.MediaRecorder) {
      reject(new Error('Video-opname wordt niet ondersteund in deze browser. Open dit dashboard in Chrome.'));
      return;
    }

    const ctx = canvas.getContext('2d');
    const tl = timelineFn(project.picks.length);
    const stream = canvas.captureStream(30);
    const mimeType = pickMimeType();

    let recorder;
    try {
      const options = { videoBitsPerSecond: 8_000_000 };
      if (mimeType) options.mimeType = mimeType;
      recorder = new MediaRecorder(stream, options);
    } catch (err) {
      reject(err);
      return;
    }

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = (e) => reject(e.error || new Error('Video recording failed.'));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      resolve(blob);
    };

    recorder.start();
    const start = performance.now();

    function frame(now) {
      const t = now - start;
      renderFn(ctx, t, project);
      if (onProgress) onProgress(Math.min(t / tl.total, 1));
      if (t < tl.total) {
        requestAnimationFrame(frame);
      } else {
        recorder.stop();
      }
    }
    requestAnimationFrame(frame);
  });
}
