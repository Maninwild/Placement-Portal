'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ValidationError,
  gradeSubmission,
  validateRegistration,
  validateTestPayload
} = require('../src/domain');

test('student registration normalizes public identity fields', () => {
  const result = validateRegistration({
    name: '  Student One  ',
    email: 'STUDENT@EXAMPLE.COM',
    sapId: 'abc-1234',
    password: 'strong-passphrase',
    role: 'admin'
  });

  assert.deepEqual(result, {
    name: 'Student One',
    email: 'student@example.com',
    sapId: 'ABC-1234',
    password: 'strong-passphrase'
  });
});

test('test validation rejects an answer outside its options', () => {
  assert.throws(
    () => validateTestPayload({
      title: 'Sample Test',
      durationMinutes: 20,
      questions: [{
        questionText: 'Choose one',
        options: ['A', 'B'],
        correctAnswer: 'C',
        marks: 1
      }]
    }),
    ValidationError
  );
});

test('grading uses server-side correct answers and marks', () => {
  const result = gradeSubmission(
    [
      { id: 10, correct_answer: 'Queue', marks: 2 },
      { id: 11, correct_answer: 'SELECT', marks: 1 }
    ],
    { 10: 'Queue', 11: 'UPDATE' }
  );

  assert.deepEqual(result, { score: 2, totalMarks: 3 });
});
