// onboarding.js - Interactive logic for ClubVision onboarding wizard

document.addEventListener('DOMContentLoaded', function() {
  function getSiteId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('site_id');
    if (fromQuery && !Number.isNaN(parseInt(fromQuery))) return parseInt(fromQuery);
    const fromStorage = localStorage.getItem('activeSiteId');
    if (fromStorage && !Number.isNaN(parseInt(fromStorage))) return parseInt(fromStorage);
    return 1;
  }
  // Resume onboarding progress from backend
  async function fetchAndResumeProgress() {
    const site_id = getSiteId();
    try {
      const res = await fetch('/api/onboarding/get-progress?site_id=' + site_id);
      const data = await res.json();
      if (data.progress && checklistList) {
        data.progress.forEach((step, idx) => {
          const li = checklistList.querySelector('li[data-step="' + idx + '"] .checkmark');
          if (li) li.textContent = step.complete ? '✔' : '☐';
        });
        updateChecklistMeter();
      }
    } catch (e) {
      console.error('Error fetching onboarding progress:', e);
    }
  }
  fetchAndResumeProgress();
  // Checklist meter and save/resume logic
  const checklistList = document.getElementById('checklistList');
  const checklistProgress = document.getElementById('checklistProgress');
  const checklistPercent = document.getElementById('checklistPercent');
  const saveResumeBtn = document.getElementById('saveResumeBtn');
  const saveResumeFeedback = document.getElementById('saveResumeFeedback');

  function updateChecklistMeter() {
    if (!checklistList || !checklistProgress || !checklistPercent) return;
    const steps = checklistList.querySelectorAll('li');
    let completed = 0;
    steps.forEach(li => {
      if (li.querySelector('.checkmark').textContent === '✔') completed++;
    });
    const percent = Math.round((completed / steps.length) * 100);
    checklistProgress.style.width = percent + '%';
    checklistPercent.textContent = percent + '%';
  }
  updateChecklistMeter();

  if (saveResumeBtn && saveResumeFeedback) {
    saveResumeBtn.onclick = async function() {
      saveResumeBtn.disabled = true;
      saveResumeBtn.textContent = 'Saving...';
      // Gather onboarding progress (for demo, just checklist completion)
      const steps = checklistList.querySelectorAll('li');
      let progress = [];
      steps.forEach(li => {
        progress.push({
          step: li.textContent.trim(),
          complete: li.querySelector('.checkmark').textContent === '✔'
        });
      });
      const site_id = getSiteId();
      try {
        const res = await fetch('/api/onboarding/save-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site_id, progress })
        });
        const data = await res.json();
        if (res.ok && data.saved) {
          saveResumeFeedback.style.display = 'inline';
          saveResumeFeedback.textContent = 'Progress saved!';
          // Mark last checklist item as complete
          const lastCheck = checklistList.querySelector('li[data-step="6"] .checkmark');
          if (lastCheck) lastCheck.textContent = '✔';
          updateChecklistMeter();
        } else {
          saveResumeFeedback.style.display = 'inline';
          saveResumeFeedback.textContent = 'Save failed.';
          saveResumeFeedback.style.color = '#ef4444';
        }
      } catch (e) {
        saveResumeFeedback.style.display = 'inline';
        saveResumeFeedback.textContent = 'Error saving.';
        saveResumeFeedback.style.color = '#ef4444';
      }
      saveResumeBtn.disabled = false;
      saveResumeBtn.textContent = 'Save & Resume Later';
      setTimeout(() => {
        saveResumeFeedback.style.display = 'none';
        saveResumeFeedback.style.color = '#16a34a';
      }, 2500);
    };
  }
  // Quick-start defaults & starter kit logic
  const quickStartTemplate = document.getElementById('quickStartTemplate');
  const loadExampleAnnouncements = document.getElementById('loadExampleAnnouncements');
  const loadSampleEvents = document.getElementById('loadSampleEvents');
  const loadSampleLeaderboard = document.getElementById('loadSampleLeaderboard');
  const guidedImportBtn = document.getElementById('guidedImport');
  const importMembersInput = document.getElementById('importMembers');

  if (quickStartTemplate) {
    quickStartTemplate.onchange = function() {
      alert('Selected template: ' + quickStartTemplate.options[quickStartTemplate.selectedIndex].text);
      // TODO: Call backend to set up selected template
    };
  }
  if (loadExampleAnnouncements) {
    loadExampleAnnouncements.onclick = function() {
      alert('Example announcements loaded!');
      // TODO: Call backend to load example announcements
    };
  }
  if (loadSampleEvents) {
    loadSampleEvents.onclick = function() {
      alert('Sample events loaded!');
      // TODO: Call backend to load sample events
    };
  }
  if (loadSampleLeaderboard) {
    loadSampleLeaderboard.onclick = function() {
      alert('Sample leaderboard loaded!');
      // TODO: Call backend to load sample leaderboard
    };
  }
  if (guidedImportBtn) {
    guidedImportBtn.onclick = function() {
      alert('Guided import started!');
      // TODO: Launch guided import workflow
    };
  }
  if (importMembersInput) {
    importMembersInput.onchange = function() {
      alert('Members CSV selected: ' + importMembersInput.files[0]?.name);
      // TODO: Upload and process CSV
    };
  }
  // Email verification logic
  const sendVerificationBtn = document.querySelector('.field button');
  const emailInput = document.querySelector('input[type=email]');
  const verificationCodeInput = document.getElementById('verificationCode');
  const submitVerificationBtn = document.getElementById('submitVerification');
  const verificationFeedback = document.getElementById('verificationFeedback');

  if (sendVerificationBtn && emailInput) {
    sendVerificationBtn.onclick = async function() {
      if (!emailInput.value) return alert('Please enter an email address first.');
      sendVerificationBtn.disabled = true;
      sendVerificationBtn.textContent = 'Sending...';
      try {
        // Call backend API to send verification code
        const res = await fetch('/api/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput.value })
        });
        if (res.ok) {
          sendVerificationBtn.textContent = 'Sent!';
        } else {
          sendVerificationBtn.textContent = 'Send Verification';
          alert('Failed to send verification email.');
        }
      } catch (e) {
        sendVerificationBtn.textContent = 'Send Verification';
        alert('Error sending verification email.');
      }
      setTimeout(() => {
        sendVerificationBtn.disabled = false;
        sendVerificationBtn.textContent = 'Send Verification';
      }, 3000);
    };
  }

  if (submitVerificationBtn && verificationCodeInput && emailInput && verificationFeedback) {
    submitVerificationBtn.onclick = async function() {
      if (!verificationCodeInput.value) return alert('Enter the code from your email.');
      submitVerificationBtn.disabled = true;
      submitVerificationBtn.textContent = 'Verifying...';
      try {
        // Call backend API to verify code
        const res = await fetch('/api/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput.value, code: verificationCodeInput.value })
        });
        const data = await res.json();
        if (res.ok && data.verified) {
          verificationFeedback.style.display = 'inline';
          verificationFeedback.textContent = 'Verified!';
          verificationFeedback.style.color = '#16a34a';
        } else {
          verificationFeedback.style.display = 'inline';
          verificationFeedback.textContent = 'Invalid code.';
          verificationFeedback.style.color = '#ef4444';
        }
      } catch (e) {
        verificationFeedback.style.display = 'inline';
        verificationFeedback.textContent = 'Error verifying.';
        verificationFeedback.style.color = '#ef4444';
      }
      submitVerificationBtn.disabled = false;
      submitVerificationBtn.textContent = 'Verify';
      setTimeout(() => {
        verificationFeedback.style.display = 'none';
      }, 3000);
    };
  }
  // Color pickers and hex code sync
  // Declare these variables only once at the top
  const primaryColor = document.getElementById('primaryColor');
  const secondaryColor = document.getElementById('secondaryColor');
  const accentColor = document.getElementById('accentColor');
  const primaryHex = document.getElementById('primaryHex');
  const secondaryHex = document.getElementById('secondaryHex');
  const accentHex = document.getElementById('accentHex');
  const dashboardPreview = document.querySelector('.preview-box div:first-child div');
  const kioskPreview = document.querySelector('.preview-box div:last-child div');
  function updatePreview() {
    dashboardPreview.style.background = primaryColor.value;
    kioskPreview.style.background = secondaryColor.value;
    dashboardPreview.style.color = '#fff';
    kioskPreview.style.color = '#fff';
    primaryHex.value = primaryColor.value;
    secondaryHex.value = secondaryColor.value;
    accentHex.value = accentColor.value;
  }
  [primaryColor, secondaryColor, accentColor].forEach(input => {
    input.addEventListener('input', updatePreview);
  });
  [primaryHex, secondaryHex, accentHex].forEach((input, idx) => {
    input.addEventListener('input', function() {
      let val = input.value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        if (idx === 0) primaryColor.value = val;
        if (idx === 1) secondaryColor.value = val;
        if (idx === 2) accentColor.value = val;
        updatePreview();
      }
    });
  });
  updatePreview();
  // Step navigation
  let currentStep = 0;
  const steps = document.querySelectorAll('.wizard-step');
  const progress = document.querySelector('.progress');
  function showStep(idx) {
    steps.forEach((step, i) => {
      step.style.display = i === idx ? 'block' : 'none';
    });
    progress.style.width = ((idx+1)/steps.length*100) + '%';
  }
  showStep(currentStep);

  // Next/Prev buttons
  steps.forEach((step, i) => {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = i < steps.length-1 ? 'Next' : 'Finish';
    nextBtn.className = 'wizard-next';
    nextBtn.style.marginTop = '24px';
    nextBtn.onclick = function() {
      if (i < steps.length-1) showStep(i+1);
      else alert('Onboarding complete!');
    };
    step.appendChild(nextBtn);
    if (i > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.textContent = 'Back';
      prevBtn.className = 'wizard-prev';
      prevBtn.style.marginRight = '12px';
      prevBtn.onclick = function() { showStep(i-1); };
      step.appendChild(prevBtn);
    }
  });

  // Stakeholder invite logic
  const inviteBtn = document.querySelector('.invite-list button');
  const inviteEmail = document.querySelector('.invite-list input[type=email]');
  const inviteRole = document.querySelector('.invite-list select');
  const inviteList = document.querySelector('.invite-list ul');
  inviteBtn.onclick = function() {
    if (inviteEmail.value) {
      const li = document.createElement('li');
      li.textContent = `${inviteEmail.value} (${inviteRole.value})`;
      inviteList.appendChild(li);
      inviteEmail.value = '';
    }
  };

  // Kiosk location logic
  const kioskBtn = document.querySelector('.kiosk-list button');
  const kioskInput = document.querySelector('.kiosk-list input');
  kioskBtn.onclick = function() {
    if (kioskInput.value) {
      const div = document.createElement('div');
      div.textContent = kioskInput.value;
      document.querySelector('.kiosk-list').appendChild(div);
      kioskInput.value = '';
    }
  };

  // Admin invite logic
  const adminBtn = document.querySelector('.admin-list button');
  const adminEmail = document.querySelector('.admin-list input');
  adminBtn.onclick = function() {
    if (adminEmail.value) {
      const div = document.createElement('div');
      div.textContent = adminEmail.value;
      document.querySelector('.admin-list').appendChild(div);
      adminEmail.value = '';
    }
  };

  // Color pickers and hex code sync
  // (removed duplicate declarations)

  // Save & Resume logic
  document.querySelector('.save-resume button').onclick = function() {
    alert('Progress saved! You can resume onboarding later.');
  };
});
