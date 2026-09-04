'use strict';

(() => {
  const api = window.portalApi;
  const state = { test: null, timerId: null, secondsLeft: 0, submitting: false };

  const elements = {
    authView: document.querySelector('#auth-view'),
    dashboardView: document.querySelector('#dashboard-view'),
    testView: document.querySelector('#test-view'),
    loginForm: document.querySelector('#login-form'),
    registerForm: document.querySelector('#register-form'),
    logoutButton: document.querySelector('#logout-button'),
    refreshButton: document.querySelector('#refresh-button'),
    studentName: document.querySelector('#student-name'),
    welcomeHeading: document.querySelector('#welcome-heading'),
    testList: document.querySelector('#test-list'),
    resultList: document.querySelector('#result-list'),
    testForm: document.querySelector('#test-form'),
    testTitle: document.querySelector('#test-title'),
    questionList: document.querySelector('#question-list'),
    timer: document.querySelector('#timer'),
    cancelTest: document.querySelector('#cancel-test'),
    message: document.querySelector('#message')
  };

  function showMessage(text, isError = false) {
    elements.message.textContent = text;
    elements.message.classList.toggle('error', isError);
    elements.message.classList.remove('hidden');
  }

  function clearMessage() {
    elements.message.classList.add('hidden');
  }

  function setView(name) {
    elements.authView.classList.toggle('hidden', name !== 'auth');
    elements.dashboardView.classList.toggle('hidden', name !== 'dashboard');
    elements.testView.classList.toggle('hidden', name !== 'test');
    elements.logoutButton.classList.toggle('hidden', name === 'auth');
  }

  function stopTimer() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = null;
  }

  function logout(message) {
    stopTimer();
    api.clearToken();
    state.test = null;
    elements.studentName.textContent = '';
    setView('auth');
    if (message) showMessage(message);
  }

  async function authenticate(path, form) {
    clearMessage();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const result = await api.request(path, { method: 'POST', body: JSON.stringify(payload) });
      if (result.user.role !== 'student') throw new Error('Use the teacher portal for this account');
      api.setToken(result.token);
      form.reset();
      await openDashboard(result.user);
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  }

  function createEmptyState(text) {
    const paragraph = document.createElement('p');
    paragraph.className = 'empty-state';
    paragraph.textContent = text;
    return paragraph;
  }

  function renderTests(tests) {
    elements.testList.replaceChildren();
    if (tests.length === 0) {
      elements.testList.append(createEmptyState('No active tests are available yet.'));
      return;
    }

    for (const test of tests) {
      const card = document.createElement('article');
      card.className = 'list-card';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = test.title;
      const meta = document.createElement('span');
      meta.textContent = `${test.durationMinutes} minutes · ${test.totalMarks} marks`;
      copy.append(title, meta);
      const button = document.createElement('button');
      button.className = 'button small primary';
      button.type = 'button';
      button.textContent = 'Start';
      button.addEventListener('click', () => startTest(test.id));
      card.append(copy, button);
      elements.testList.append(card);
    }
  }

  function renderResults(results) {
    elements.resultList.replaceChildren();
    if (results.length === 0) {
      elements.resultList.append(createEmptyState('Your submitted tests will appear here.'));
      return;
    }

    for (const result of results) {
      const card = document.createElement('article');
      card.className = 'list-card';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = result.title;
      const meta = document.createElement('span');
      meta.textContent = new Date(result.submittedAt).toLocaleString();
      copy.append(title, meta);
      const score = document.createElement('strong');
      score.textContent = `${result.score}/${result.totalMarks}`;
      card.append(copy, score);
      elements.resultList.append(card);
    }
  }

  async function loadDashboardData() {
    clearMessage();
    try {
      const [tests, results] = await Promise.all([
        api.request('/api/student/tests'),
        api.request('/api/student/results')
      ]);
      renderTests(tests.tests);
      renderResults(results.results);
    } catch (error) {
      if (error.status === 401 || error.status === 403) return logout(error.message);
      showMessage(error.message, true);
    }
  }

  async function openDashboard(user) {
    elements.studentName.textContent = user.name;
    elements.welcomeHeading.textContent = `Welcome ${user.name}`;
    setView('dashboard');
    await loadDashboardData();
  }

  function renderQuestions(questions) {
    elements.questionList.replaceChildren();
    questions.forEach((question, index) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'question-card';
      const legend = document.createElement('legend');
      legend.textContent = `${index + 1}. ${question.questionText} (${question.marks} mark${question.marks === 1 ? '' : 's'})`;
      const options = document.createElement('div');
      options.className = 'option-list';

      question.options.forEach((optionText) => {
        const label = document.createElement('label');
        label.className = 'option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `question-${question.id}`;
        input.value = optionText;
        const text = document.createElement('span');
        text.textContent = optionText;
        label.append(input, text);
        options.append(label);
      });

      fieldset.append(legend, options);
      elements.questionList.append(fieldset);
    });
  }

  function updateTimer() {
    const minutes = Math.floor(state.secondsLeft / 60);
    const seconds = state.secondsLeft % 60;
    elements.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    elements.timer.classList.toggle('warning', state.secondsLeft <= 60);
    if (state.secondsLeft <= 0) {
      stopTimer();
      submitTest(true);
    }
    state.secondsLeft -= 1;
  }

  async function startTest(id) {
    clearMessage();
    try {
      const result = await api.request(`/api/student/tests/${id}`);
      state.test = result.test;
      state.secondsLeft = result.test.durationMinutes * 60;
      elements.testTitle.textContent = result.test.title;
      renderQuestions(result.test.questions);
      setView('test');
      updateTimer();
      state.timerId = window.setInterval(updateTimer, 1000);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function submitTest(autoSubmitted = false) {
    if (!state.test || state.submitting) return;
    state.submitting = true;
    stopTimer();
    const submitButton = elements.testForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const answers = {};
    for (const question of state.test.questions) {
      const selected = elements.testForm.querySelector(`input[name="question-${question.id}"]:checked`);
      if (selected) answers[question.id] = selected.value;
    }

    try {
      const result = await api.request(`/api/student/tests/${state.test.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers })
      });
      const prefix = autoSubmitted ? 'Time ended. Test submitted.' : 'Test submitted.';
      state.test = null;
      setView('dashboard');
      await loadDashboardData();
      showMessage(`${prefix} Score: ${result.score}/${result.totalMarks}`);
    } catch (error) {
      showMessage(error.message, true);
      setView('dashboard');
    } finally {
      state.submitting = false;
      submitButton.disabled = false;
    }
  }

  elements.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    authenticate('/api/auth/login', elements.loginForm);
  });
  elements.registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    authenticate('/api/auth/register', elements.registerForm);
  });
  elements.logoutButton.addEventListener('click', () => logout('You have been logged out.'));
  elements.refreshButton.addEventListener('click', loadDashboardData);
  elements.cancelTest.addEventListener('click', () => {
    if (window.confirm('Cancel this attempt? Your answers will not be saved.')) {
      stopTimer();
      state.test = null;
      setView('dashboard');
    }
  });
  elements.testForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitTest(false);
  });

  async function restoreSession() {
    if (!api.getToken()) return setView('auth');
    try {
      const result = await api.request('/api/me');
      if (result.user.role !== 'student') return logout('Use the teacher portal for this account.');
      return openDashboard(result.user);
    } catch {
      return logout('Your session expired. Please sign in again.');
    }
  }

  restoreSession();
})();
