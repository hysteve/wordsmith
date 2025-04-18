Wordsmith Followups:

- Turn this repo into a monorepo with individually published script modules and lib modules (main js module + cli runner + reaadme), a separate project within for an api service, a nextjs app for viewing data and running commands (minimal starter with analytics dashboard, data tables, api calls, simple login by email + api key)
- Review and improve our api service's auth and token management, ensuring best practices in security and api development.
- Provide a confguration loader (for all scripts) that determines the data output targets. Create output handlers for postgresql (via drizzleorm, with database studio) or local filesystem (default)
- Add multi-tenant database tables, schemas, client interfaces, migrations, backups, and test data hydration. Add data entities for: orgs, users, specific data types for each script module/feature,

- Enhance the nextjs app -
