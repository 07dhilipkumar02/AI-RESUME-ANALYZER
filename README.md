# AI Resume Analyzer

Score a resume against a specific job description, the way an ATS and a recruiter would read it.

Upload a PDF or DOCX resume, paste a job description, and get:

- **ATS score (0–100)** built from three transparent parts:
  - **Keyword match (45%)**: required and nice-to-have skills extracted from the job description by an LLM, then matched word-for-word in the resume (spelling variants such as `Node.js` / `NodeJS` included), like real ATS keyword filters.
  - **Semantic fit (35%)**: cosine similarity between Gemini embeddings of the resume and the job description.
  - **ATS formatting (20%)**: eight structural checks (contact details, standard section headings, dates, measurable results, length).
- **Gap analysis**: matched, missing and nice-to-have skills.
- **Prioritised improvements** and **bullet-point rewrites** that never invent numbers (they insert `[X%]` placeholders instead).
- **Job recommendations** using **MongoDB Atlas Vector Search** over embedded job descriptions.
- **Accounts and history**: JWT authentication, saved analyses, pagination, delete.

The LLM only extracts skills and writes feedback; every score is computed deterministically in code (`backend/src/services/scoring.js`, covered by unit tests).

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS v4, Axios |
| Backend | Node.js, Express 5, Mongoose, Multer (in-memory uploads), Zod validation, Helmet, rate limiting |
| AI | Google Gemini (`gemini-3.8-flash` for analysis, `gemini-embedding-2` for embeddings) via `@google/genai` with structured JSON output |
| Database | MongoDB Atlas with a Vector Search index |
| Auth | JWT + bcrypt |

## How it works

```
Resume (PDF/DOCX) ─► text extraction ─┐
                                      ├─► Gemini LLM ─► required/preferred skills, feedback, rewrites
Job description ──────────────────────┤
                                      └─► Gemini embeddings ─► semantic similarity
                                                     │
              keyword match + semantic fit + formatting checks ─► ATS score
                                                     │
              resume embedding ─► Atlas $vectorSearch over jobs ─► recommendations
```

Resume files are processed in memory and never written to disk; only the extracted text is stored.

## Setup

Prerequisites: Node.js 20+, a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (M0 works), and a free [Gemini API key](https://aistudio.google.com/apikey).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Fill in `.env`: `MONGODB_URI`, `JWT_SECRET` (a long random string) and `GEMINI_API_KEY`.

Load the sample job descriptions and create the vector index:

```bash
npm run seed:jobs
```

Start the API:

```bash
npm run dev               # http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev               # http://localhost:5173
```

### Tests

```bash
cd backend
npm test
```

## Vector Search index

`npm run seed:jobs` creates the index automatically. To create it by hand in Atlas (Atlas Search > Create Index > JSON editor, collection `jobs`), name it `job_vector_index` and use:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" }
  ]
}
```

Without the index (for example on a local MongoDB), recommendations fall back to in-app cosine similarity.

## API

All `/api/analyses` routes need `Authorization: Bearer <token>`.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/auth/me` | Current user |
| POST | `/api/analyses` | Multipart: `resume` file, `jobDescription`, optional `jobTitle`, `company` |
| GET | `/api/analyses?page=1&limit=10` | Your analyses |
| GET | `/api/analyses/:id` | One analysis |
| GET | `/api/analyses/:id/recommendations` | Matching jobs via vector search |
| DELETE | `/api/analyses/:id` | Delete an analysis |
| GET | `/api/health` | Health check |

## Configuration

Model names are set in `backend/.env` (`GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`), so a model rename needs no code change. All AI calls live in `backend/src/services/ai.js`; switching to another provider means reimplementing that one file.

Each user can run 10 analyses per 15 minutes to protect the free-tier quota.
