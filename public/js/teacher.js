'use strict';

(() => {
  const api = window.portalApi;
  let questionNumber = 0;

  const elements = {
    loginView: document.querySelector('#login-view'),
    dashboardView: document.querySelector('#dashboard-view'),
    loginForm: document.querySelector('#login-form'),
    createTestForm: document.querySelector('#create-test-form'),
    searchForm: document.querySelector('#search-form'),
    questionBuilder: document.querySelector('#question-builder'),
    addQuestion: document.querySelector('#add-question'),
    refreshResults: document.querySelector('#refresh-results'),
    resultsBody: document.querySelector('#results-body'),
    logoutButton: document.querySelector('#logout-button'),
    teacherName: document.querySelector('#teacher-name'),
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

  function setAuthenticated(user) {
    elements.loginView.classList.add('hidden');
    elements.dashboardView.classList.remove('hidden');
    elements.logoutButton.classList.remove('hidden');
    elements.teacherName.textContent = user.name;
  }

  function logout(message) {
    api.clearToken();
    elements.dashboardView.classList.add('hidden');
    elements.loginView.classList.remove('hidden');
    elements.logoutButton.classList.add('hidden');
    elements.teacherName.textContent = '';
    if (message) showMessage(message);
  }

  function addQuestionCard() {
    questionNumber += 1;
    const card = document.createElement('section');
    card.className = 'question-card question-builder-card form-stack';
    card.dataset.question = String(questionNumber);

    const heading = document.createElement('h3');
    heading.textContent = `Question ${questionNumber}`;
    const remove = document.createElement('button');
    remove.className = 'remove-question';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => card.remove());

    const questionLabel = document.createElement('label');
    questionLabel.textContent = 'Question text';
    const questionInput = document.createElement('textarea');
    questionInput.className = 'question-text';
    questionInput.required = true;
    questionInput.maxLength = 2000;
    questionLabel.append(questionInput);

    const optionsLabel = document.createElement('label');
    optionsLabel.textContent = 'Options (one per line)';
    const optionsInput = document.createElement('textarea');
    optionsInput.className = 'question-options';
    optionsInput.required = true;
    optionsInput.placeholder = 'Option A\nOption B\nOption C\nOption D';
    optionsLabel.append(optionsInput);

    const row = document.createElement('div');
    row.className = 'form-row';
    const answerLabel = document.createElement('label');
    answerLabel.textContent = 'Correct answer';
    const answerInput = document.createElement('input');
    answerInput.className = 'correct-answer';
    answerInput.required = true;
    answerInput.maxLength = 500;
    answerLabel.append(answerInput);
    const marksLabel = document.createElement('label');
    marksLabel.textContent = 'Marks';
    const marksInput = document.createElement('input');
    marksInput.className = 'question-marks';
    marksInput.type = 'number';
    marksInput.min = '1';
    marksInput.max = '100';
    marksInput.value = '1';
    marksInput.required = true;
    marksLabel.append(marksInput);
    row.append(answerLabel, marksLabel);

    card.append(heading, remove, questionLabel, optionsLabel, row);
    elements.questionBuilder.append(card);
  }

  function collectQuestions() {
    return [...elements.questionBuilder.querySelectorAll('.question-builder-card')].map((card) => ({
      questionText: card.querySelector('.question-text').value,
      options: card.querySelector('.question-options').value
        .split('\n')
        .map((option) => option.trim())
        .filter(Boolean),
      correctAnswer: card.querySelector('.correct-answer').value.trim(),
      marks: Number(card.querySelector('.question-marks').value)
    }));
  }

  function appendCell(row, text, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = text;
    row.append(cell);
  }

  function renderResults(results) {
    elements.resultsBody.replaceChildren();
    if (results.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.className = 'empty-state';
      cell.textContent = 'No matching submissions found.';
      row.append(cell);
      elements.resultsBody.append(row);
      return;
    }

    for (const result of results) {
      const row = document.createElement('tr');
      appendCell(row, `${result.studentName}\n${result.sapId || result.email}`);
      appendCell(row, result.title);
      appendCell(row, `${result.score}/${result.totalMarks}`);
      appendCell(row, new Date(result.submittedAt).toLocaleString());
      elements.resultsBody.append(row);
    }
  }

  async function loadResults(query = '') {
    clearMessage();
    try {
      const result = await api.request(`/api/teacher/results?query=${encodeURIComponent(query)}`);
      renderResults(result.results);
    } catch (error) {
      if (error.status === 401 || error.status === 403) return logout(error.message);
      showMessage(error.message, true);
    }
  }

  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();
    const submitButton = elements.loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(elements.loginForm).entries());
      const result = await api.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!['teacher', 'admin'].includes(result.user.role)) {
        throw new Error('This account does not have teacher access');
      }
      api.setToken(result.token);
      elements.loginForm.reset();
      setAuthenticated(result.user);
      await loadResults();
    } catch (error) {
      api.clearToken();
      showMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  elements.createTestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();
    const questions = collectQuestions();
    if (questions.length === 0) return showMessage('Add at least one question', true);

    const formData = new FormData(elements.createTestForm);
    const submitButton = elements.createTestForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const result = await api.request('/api/teacher/tests', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.get('title'),
          durationMinutes: Number(formData.get('durationMinutes')),
          questions
        })
      });
      elements.createTestForm.reset();
      elements.questionBuilder.replaceChildren();
      questionNumber = 0;
      addQuestionCard();
      showMessage(`Published “${result.title}” with ${result.totalMarks} marks.`);
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  elements.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = new FormData(elements.searchForm).get('query');
    loadResults(query);
  });
  elements.addQuestion.addEventListener('click', addQuestionCard);
  elements.refreshResults.addEventListener('click', () => loadResults());
  elements.logoutButton.addEventListener('click', () => logout('You have been logged out.'));

  async function restoreSession() {
    addQuestionCard();
    if (!api.getToken()) return;
    try {
      const result = await api.request('/api/me');
      if (!['teacher', 'admin'].includes(result.user.role)) {
        return logout('This account does not have teacher access.');
      }
      setAuthenticated(result.user);
      return loadResults();
    } catch {
      return logout('Your session expired. Please sign in again.');
    }
  }

  restoreSession();
})();
