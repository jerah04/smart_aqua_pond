# SMART Aqua Pond Development Instructions

## Project location and structure

The application root is:

`C:\xampp\htdocs\repos\smart_aqua_pond`

- `frontend/` contains the Next.js App Router application.
- `backend/` contains the Express API and MySQL connection.
- `backend/database/schema.sql` contains the database schema and starter data.
- `requirements.md` is the source of truth for product requirements.

## Required technology conventions

- Keep the frontend in Next.js, React, TypeScript, Tailwind CSS, and lucide-react.
- Keep the backend in Node.js, Express, mysql2, cors, and dotenv.
- Use parameterized SQL queries.
- Preserve the existing REST endpoint naming and response conventions unless a requirement explicitly changes them.
- Keep UI, request handling, and database access concerns separated.
- Use environment variables for database credentials, API URLs, ports, and allowed frontend origins.

## Ammonia feature exclusion

The ammonia sensor feature is intentionally excluded from this project. Do not add or restore:

- An ammonia sensor or ammonia ingestion flow
- Ammonia fields in new API contracts or frontend types
- Ammonia dashboard metrics, alerts, thresholds, or automation
- Ammonia-related acceptance criteria or user instructions

When extending water-quality monitoring, use only the supported parameters defined in `requirements.md`: temperature, pH, dissolved oxygen, and turbidity.

## Prototype and safety rules

- Clearly label simulated readings, camera analysis, and fallback data.
- Database updates for aerators, pumps, or feeders must not be described as proof that physical equipment operated.
- Do not add automatic treatment, water changes, veterinary diagnosis, or unsupervised fish-health decisions.
- Physical actuator integration requires authenticated device communication, fail-safe behavior, emergency shutoff, and human safety review.
- Do not expose secrets or internal error details to browser clients.

## Validation workflow

Before handing off a change:

1. Read the relevant README, requirements, schema, and implementation files.
2. Run the applicable frontend build or lint command.
3. Run the backend with a configured test environment when API behavior changes.
4. Check that changed Markdown files are present and readable.
5. Remove temporary diagnostic files.
6. Do not commit or push changes unless explicitly requested.
