'use strict';

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

function requiredString(value, field, min, max) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function normalizeEmail(value) {
  const email = requiredString(value, 'Email', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Enter a valid email address');
  }
  return email;
}

function validateRegistration(input = {}) {
  const name = requiredString(input.name, 'Name', 2, 100);
  const email = normalizeEmail(input.email);
  const password = requiredString(input.password, 'Password', 8, 128);
  const sapId = requiredString(input.sapId, 'SAP ID', 4, 30).toUpperCase();

  if (!/^[A-Z0-9_-]+$/.test(sapId)) {
    throw new ValidationError('SAP ID may contain only letters numbers hyphens and underscores');
  }

  return { name, email, password, sapId };
}

function validateLogin(input = {}) {
  return {
    identifier: requiredString(input.identifier, 'Email or SAP ID', 4, 254),
    password: requiredString(input.password, 'Password', 8, 128)
  };
}

function validateTestPayload(input = {}) {
  const title = requiredString(input.title, 'Title', 3, 160);
  const durationMinutes = Number(input.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) {
    throw new ValidationError('Duration must be a whole number between 1 and 240 minutes');
  }
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 100) {
    throw new ValidationError('A test must contain between 1 and 100 questions');
  }

  const questions = input.questions.map((question, index) => {
    const questionText = requiredString(question.questionText, `Question ${index + 1}`, 3, 2000);
    const marks = Number(question.marks ?? 1);
    if (!Number.isInteger(marks) || marks < 1 || marks > 100) {
      throw new ValidationError(`Question ${index + 1} marks must be between 1 and 100`);
    }
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) {
      throw new ValidationError(`Question ${index + 1} must have between 2 and 6 options`);
    }
    const options = question.options.map((option) => requiredString(option, 'Option', 1, 500));
    if (new Set(options).size !== options.length) {
      throw new ValidationError(`Question ${index + 1} contains duplicate options`);
    }
    const correctAnswer = requiredString(question.correctAnswer, 'Correct answer', 1, 500);
    if (!options.includes(correctAnswer)) {
      throw new ValidationError(`Question ${index + 1} correct answer must match one option exactly`);
    }
    return { questionText, options, correctAnswer, marks };
  });

  return { title, durationMinutes, questions };
}

function gradeSubmission(questions, answers = {}) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new ValidationError('Answers must be an object keyed by question ID');
  }

  return questions.reduce(
    (result, question) => {
      const marks = Number(question.marks);
      result.totalMarks += marks;
      if (answers[String(question.id)] === question.correct_answer) {
        result.score += marks;
      }
      return result;
    },
    { score: 0, totalMarks: 0 }
  );
}

function parseOptions(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  ValidationError,
  gradeSubmission,
  normalizeEmail,
  parseOptions,
  validateLogin,
  validateRegistration,
  validateTestPayload
};
