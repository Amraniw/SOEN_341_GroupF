document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resumeForm');
  const fileInput = document.getElementById('resumeFile');
  if (!form || !fileInput) return;

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const dropZone = document.getElementById('dropZone');
  const selectedFile = document.getElementById('selectedFile');
  const uploadButton = document.getElementById('uploadButton');
  const status = document.getElementById('uploadStatus');
  const uploadedResume = document.getElementById('uploadedResume');
  const deleteButton = document.querySelector('[data-delete-resume]');
  const deleteLabel = document.querySelector('[data-delete-label]');
  const readinessRing = document.querySelector('.readiness-ring');
  let activeFile = null;
  let deleteConfirmationTimeout = null;

  const storedUser = sessionStorage.getItem('careerconnect.user');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      const initials = user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
      document.querySelectorAll('[data-user-display]').forEach((element) => { element.textContent = user.name; });
      document.querySelectorAll('[data-user-first-name]').forEach((element) => { element.textContent = user.name.split(/\s+/)[0]; });
      document.querySelectorAll('[data-user-initials]').forEach((element) => { element.textContent = initials; });
    } catch (error) {
      sessionStorage.removeItem('careerconnect.user');
    }
  }

  const dateElement = document.querySelector('[data-current-date]');
  if (dateElement) {
    dateElement.textContent = new Intl.DateTimeFormat('en-CA', {
      month: 'long', day: 'numeric', year: 'numeric',
    }).format(new Date());
  }

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `alert alert--${type}`;
    status.hidden = false;
  }

  function clearStatus() {
    status.hidden = true;
    status.textContent = '';
    status.className = 'alert';
  }

  function formatUploadTime(timestamp) {
    const normalizedTimestamp = timestamp.includes('T')
      ? timestamp
      : `${timestamp.replace(' ', 'T')}Z`;
    const uploadDate = new Date(normalizedTimestamp);

    if (Number.isNaN(uploadDate.getTime())) return 'Upload date unavailable';

    return `Uploaded ${new Intl.DateTimeFormat('en-CA', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(uploadDate)}`;
  }

  function resetDeleteConfirmation() {
    window.clearTimeout(deleteConfirmationTimeout);
    deleteConfirmationTimeout = null;
    deleteButton.classList.remove('is-confirming');
    deleteLabel.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', 'Delete uploaded resume');
  }

  function renderResume(resume) {
    const hasResume = Boolean(resume);
    const readiness = hasResume ? 100 : 60;

    resetDeleteConfirmation();
    uploadedResume.hidden = !hasResume;
    document.querySelector('[data-resume-status]').textContent = hasResume ? 'Resume ready' : 'Ready to upload';
    document.querySelector('[data-next-milestone]').textContent = hasResume ? 'Explore opportunities' : 'Add your resume';
    document.querySelector('[data-resume-check]').classList.toggle('is-complete', hasResume);
    document.querySelector('[data-readiness-value]').textContent = readiness;
    document.querySelector('[data-readiness-title]').textContent = hasResume ? 'Profile ready' : 'A strong start';
    document.querySelector('[data-readiness-copy]').textContent = hasResume
      ? 'Your account and resume are ready for future opportunities.'
      : 'Upload your resume to complete the foundation of your CareerConnect profile.';
    readinessRing.style.setProperty('--readiness-progress', `${readiness}%`);
    readinessRing.setAttribute('aria-label', `Profile readiness: ${readiness} percent`);

    if (hasResume) {
      uploadedResume.querySelector('[data-uploaded-name]').textContent = resume.originalName;
      uploadedResume.querySelector('[data-uploaded-time]').textContent = formatUploadTime(resume.uploadedAt);
    }
  }

  async function loadCurrentResume() {
    try {
      const result = await window.CareerConnectAPI.request('/api/resumes/current');
      renderResume(result.resume);
    } catch (error) {
      showStatus(error.message, 'error');
      if (error.status === 401) {
        const signInLink = document.createElement('a');
        signInLink.href = '../auth/login.html';
        signInLink.textContent = 'Sign in again';
        status.append(' ', signInLink, '.');
      }
    }
  }

  function clearSelection() {
    activeFile = null;
    fileInput.value = '';
    selectedFile.hidden = true;
    uploadButton.disabled = true;
    dropZone.classList.remove('has-file');
  }

  function selectFile(file) {
    clearStatus();
    if (!file) return clearSelection();

    const isPdf = file.type === 'application/pdf' && file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      clearSelection();
      showStatus('Choose a PDF file. Other file types are not supported.', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      clearSelection();
      showStatus('Your resume is larger than 5 MB. Choose a smaller PDF.', 'error');
      return;
    }

    activeFile = file;
    selectedFile.querySelector('[data-file-name]').textContent = file.name;
    selectedFile.querySelector('[data-file-size]').textContent = formatFileSize(file.size);
    selectedFile.hidden = false;
    uploadButton.disabled = false;
    dropZone.classList.add('has-file');
  }

  fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
  document.querySelector('[data-remove-file]').addEventListener('click', clearSelection);

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
    });
  });
  dropZone.addEventListener('drop', (event) => selectFile(event.dataTransfer.files[0]));

  deleteButton.addEventListener('click', async () => {
    if (!deleteButton.classList.contains('is-confirming')) {
      deleteButton.classList.add('is-confirming');
      deleteLabel.textContent = 'Confirm delete';
      deleteButton.setAttribute('aria-label', 'Confirm deletion of uploaded resume');
      deleteConfirmationTimeout = window.setTimeout(resetDeleteConfirmation, 5000);
      return;
    }

    window.clearTimeout(deleteConfirmationTimeout);
    deleteButton.disabled = true;
    deleteButton.setAttribute('aria-busy', 'true');
    clearStatus();

    try {
      await window.CareerConnectAPI.request('/api/resumes/current', { method: 'DELETE' });
      clearSelection();
      renderResume(null);
      showStatus('Resume deleted. Upload a new PDF whenever you are ready.', 'success');
    } catch (error) {
      showStatus(error.message, 'error');
      if (error.status === 404) renderResume(null);
    } finally {
      deleteButton.disabled = false;
      deleteButton.setAttribute('aria-busy', 'false');
      resetDeleteConfirmation();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeFile) {
      showStatus('Select a PDF resume before uploading.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('resume', activeFile);
    uploadButton.disabled = true;
    uploadButton.classList.add('is-loading');
    uploadButton.setAttribute('aria-busy', 'true');
    clearStatus();

    try {
      const result = await window.CareerConnectAPI.request('/api/resumes', {
        method: 'POST',
        body: formData,
      });
      showStatus('Resume uploaded successfully. Your workspace is ready.', 'success');
      renderResume(result.resume);
      clearSelection();
    } catch (error) {
      showStatus(error.message, 'error');
      if (error.status === 401) {
        const signInLink = document.createElement('a');
        signInLink.href = '../auth/login.html';
        signInLink.textContent = 'Sign in again';
        status.append(' ', signInLink, '.');
      }
    } finally {
      uploadButton.classList.remove('is-loading');
      uploadButton.setAttribute('aria-busy', 'false');
      uploadButton.disabled = !activeFile;
    }
  });

  loadCurrentResume();
});
