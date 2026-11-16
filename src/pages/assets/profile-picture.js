export function refreshPictures() {
  document.querySelectorAll('.account-link .avatar, #profile-avatar').forEach((avatar) => {
    const image = new Image();
    image.alt = 'Profile picture';
    image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit';
    image.onload = () => avatar.replaceChildren(image);
    image.src = `/api/profile/picture?v=${Date.now()}`;
  });
}

export function setupPictureControls(avatar, fallback) {
  const controls = document.createElement('form');
  controls.className = 'picture-editor';
  controls.innerHTML = `<div class="picture-editor-heading"><div><h3>Profile photo</h3><p>A familiar face for your career workspace.</p></div><span class="picture-format">JPG or PNG · Up to 2 MB</span></div><div class="picture-editor-actions"><button class="button button-secondary" type="button" data-choose>Upload photo</button><button class="picture-remove" type="button" data-remove>Remove</button><input type="file" accept="image/jpeg,image/png" aria-label="Choose profile picture" hidden></div><div class="picture-selection" hidden><img alt="Selected profile photo preview"><div><strong data-filename></strong><span>Preview · Save to update your profile</span></div></div><div class="picture-pending" hidden><button class="button" type="submit">Save photo</button><button class="button button-quiet" type="button" data-cancel>Cancel</button></div><p class="picture-message" role="status" aria-live="polite"></p>`;
  avatar.closest('.profile-identity').after(controls);
  const input = controls.querySelector('input');
  const status = controls.querySelector('[role=status]');
  const selection = controls.querySelector('.picture-selection');
  const pending = controls.querySelector('.picture-pending');
  let previewUrl;
  function reset() {
    input.value = '';
    selection.hidden = true;
    pending.hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  controls.querySelector('[data-choose]').addEventListener('click', () => input.click());
  controls.querySelector('[data-cancel]').addEventListener('click', () => { reset(); status.textContent = ''; });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type)) { reset(); status.textContent = 'Choose a JPG or PNG under 2 MB.'; return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    selection.querySelector('img').src = previewUrl;
    selection.querySelector('[data-filename]').textContent = file.name;
    selection.hidden = false;
    pending.hidden = false;
    status.textContent = '';
  });
  async function save(remove) {
    const file = input.files[0];
    if (!remove && (!file || file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type))) { status.textContent = 'Choose a JPG or PNG under 2 MB.'; return; }
    controls.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    status.textContent = 'Saving…';
    try {
      const body = new FormData();
      if (file) body.append('picture', file);
      const response = await fetch('/api/profile/picture', { method: remove ? 'DELETE' : 'POST', credentials: 'same-origin', headers: { 'X-Profile-Picture': '1' }, ...(remove ? {} : { body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Picture could not be saved.');
      if (remove) document.querySelectorAll('.account-link .avatar, #profile-avatar').forEach((node) => { node.textContent = fallback; });
      else refreshPictures();
      reset();
      status.textContent = result.message;
    } catch (error) { status.textContent = error.message; }
    finally { controls.querySelectorAll('button').forEach((button) => { button.disabled = false; }); }
  }
  controls.addEventListener('submit', (event) => { event.preventDefault(); save(false); });
  controls.querySelector('[data-remove]').addEventListener('click', () => save(true));
}
