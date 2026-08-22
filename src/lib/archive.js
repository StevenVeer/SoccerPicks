export async function archiveProject(project, media) {
  if (!project?.clientId) return null;
  try {
    const formData = new FormData();
    formData.append('clientId', project.clientId);
    formData.append('title', project.title || '');
    formData.append('handle', project.handle || '');
    formData.append('disclaimer', project.disclaimer || '');
    formData.append('posted', project.status === 'posted' ? 'true' : 'false');
    formData.append('postedDate', project.postedDate || '');
    formData.append('result', project.result === 'hit' ? 'true' : project.result === 'miss' ? 'false' : '');
    formData.append('picks', JSON.stringify(project.picks || []));
    if (media?.videoBlob) formData.append('video', media.videoBlob, 'video.webm');
    if (media?.overviewBlob) formData.append('overview', media.overviewBlob, 'overview.png');

    const response = await fetch('/api/archive', { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Archive request failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Archiving project failed, local storage is unaffected:', error);
    return null;
  }
}
