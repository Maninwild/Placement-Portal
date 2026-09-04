# Placement Training Portal

A full-stack assessment portal for placement training. Students can register, take timed multiple-choice tests, and review their scores. Teachers can create tests and review student submissions from a protected dashboard.

![Placement Training Portal](public/assets/campus.jpeg)

## Highlights

- Student and teacher role-based access
- Password hashing with bcrypt
- JWT authentication with protected API routes
- Server-side grading so correct answers are never sent with a test
- Parameterized MySQL queries and transactional writes
- Login rate limiting and secure HTTP headers
- Responsive browser interface with no frontend build step
- Environment-based configuration with no committed credentials
- Migration, seed, validation, and test scripts

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MySQL 8 |
| Authentication | JWT and bcrypt |
| Testing | Node.js test runner |

## Project structure

```text
Placement-Portal/
├── migrations/001_schema.sql
├── public/
│   ├── assets/campus.jpeg
│   ├── css/styles.css
│   ├── js/api.js
│   ├── js/student.js
│   ├── js/teacher.js
│   ├── index.html
│   ├── student.html
│   └── teacher.html
├── scripts/
│   ├── migrate.js
│   └── seed.js
├── src/
│   ├── app.js
│   ├── auth.js
│   ├── config.js
│   ├── db.js
│   └── domain.js
├── test/domain.test.js
├── .env.example
├── package.json
└── server.js
```

## Local setup

Requirements: Node.js 20 or newer and MySQL 8 or newer.

1. Clone the repository.

   ```bash
   git clone https://github.com/Maninwild/Placement-Portal.git
   cd Placement-Portal
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Create the database.

   ```sql
   CREATE DATABASE placement_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

4. Copy `.env.example` to `.env` and replace every placeholder. Generate a JWT secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Create the tables and seed the first teacher account.

   ```bash
   npm run migrate
   npm run seed
   ```

6. Start the server and open `http://localhost:3000`.

   ```bash
   npm start
   ```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Express server port |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `CORS_ORIGIN` | Optional allowed frontend origin |
| `SEED_TEACHER_*` | Initial teacher details used only by the seed script |

## Main API routes

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Public student registration |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/me` | Authenticated |
| `GET` | `/api/student/tests` | Student |
| `GET` | `/api/student/tests/:id` | Student |
| `POST` | `/api/student/tests/:id/submit` | Student |
| `GET` | `/api/student/results` | Student |
| `POST` | `/api/teacher/tests` | Teacher or admin |
| `GET` | `/api/teacher/results` | Teacher or admin |

## Security notes

- Do not commit `.env` or real credentials.
- Student registration always creates a student account. Teacher and admin accounts must be created through a trusted administrative process.
- Submitted code is not executed by this application. A production coding judge must use an isolated sandbox with strict resource and network limits.
- Rotate any credential that was ever committed to a public Git history.

## Validation

```bash
npm run check
npm test
```

## License

MIT
