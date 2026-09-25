Wordsmith Followups:

- Turn this repo into a monorepo with individually published script modules and lib modules (main js module + cli runner + reaadme), a separate project within for an api service, a nextjs app for viewing data and running commands (minimal starter with analytics dashboard, data tables, api calls, simple login by email + api key)
- Review and improve our api service's auth and token management, ensuring best practices in security and api development.
- Provide a confguration loader (for all scripts) that determines the data output targets. Create output handlers for postgresql (via drizzleorm, with database studio) or local filesystem (default)
- Prepare a postgresql database development toolkit for creating tables, schemas, client interfaces, migrations, backups, and test data hydration for managing many clients in a multitenant authenticated user data platform. Add a database studio viewer tool. Use drizzle orm and zod. Create a script for boilerplate templates for data entities. Create an enhanced script that uses OpenAI API to generate new data entities

Add data entities for: orgs, users, specific data types for each script module/feature, feature mapping (flags, experiments, product bundles), RBAC/org/role/user-level feature access, usage monitoring and rate limiting, subscriptions, reports generation, account credits

- Create high-level workflows that can be triggered through the app interface that combine/chain/loop different combinations of these scripts to generate end-to-end research workflows for specific, meaningful, high-ROI use cases around marketing, branding, business, competition, sales, customer support/retention/feedback, SEO, and other relevant data-driven strategy and research.
- Create a set of standard reports that each feature can generate, set them up as react components with multiple view options each, and higher-level report page/section components that combine the different sections into complete reports. Allow users to view the reports as web (interactive/live report screens/dashboards) and simple print functionality that produces high quality output.

- Following the same patterns, create a suite of auditing tools. Provide methods and strategies using webscraping and any other existing tools/modules. Write a README.md for each module.

1. Technical Performance Audit

Tools: Google Lighthouse, WebPageTest, Chrome DevTools
Touch Points & Metrics:
• Core Web Vitals (LCP, FID, CLS)
• Time to First Byte (TTFB)
• Total Blocking Time (TBT)
• JavaScript bundle size (check for unused/large scripts)
• Lazy loading of images/media
• Asset caching strategy (Cache-Control headers)
• Mobile responsiveness (viewport settings, touch target sizes)

⸻

2. SEO Audit

Tools: Ahrefs Webmaster Tools, Screaming Frog, Google Search Console, Semrush
Touch Points & Metrics:
• Title tags and meta descriptions (length, uniqueness, relevance)
• Header tag structure (H1, H2 usage and order)
• Keyword placement and density
• Image alt attributes
• Canonical URLs
• Sitemap.xml presence and submission
• robots.txt configuration
• Broken links and 404s
• Backlink profile (authority and spam score)

⸻

3. Accessibility Audit

Tools: Lighthouse, WAVE, axe DevTools
Touch Points & Metrics:
• Color contrast ratios
• Keyboard navigability
• Screen reader compatibility
• ARIA labels and roles
• Alt text for images
• Form labels and field associations
• Skip links and focus indicators

⸻

4. UX & Design Audit

Tools: Manual review, Hotjar/Session Replay (if available), heuristic evaluation
Touch Points & Metrics:
• Visual hierarchy and readability
• Call-to-action clarity and placement
• Navigation structure and usability
• Mobile-first design and consistency
• Page layout responsiveness
• Conversion funnel analysis
• Trust signals (certifications, testimonials, SSL, contact info)

⸻

5. Content Audit

Tools: Manual + SEO tools
Touch Points & Metrics:
• Unique, high-quality copy (non-duplicate, relevant)
• Keyword mapping and coverage
• Blog or content freshness (last updated)
• Tone and brand voice consistency
• Internal linking strategy
• Thin content detection
• Multimedia usage (videos, infographics)

⸻

6. Security Audit

Tools: SSL Labs, SecurityHeaders.com, Chrome DevTools
Touch Points & Metrics:
• HTTPS & SSL certificate validity
• Content Security Policy (CSP) presence
• X-Frame-Options, X-Content-Type-Options, Referrer-Policy headers
• Open ports, known vulnerabilities (manual/server level)
• CMS or plugin version disclosures
• No mixed content warnings
• Secure form handling and email obfuscation

⸻

7. Analytics & Tagging Audit

Tools: Tag Assistant, GA Debugger, GTM Preview Mode
Touch Points & Metrics:
• Google Analytics presence and version (GA4)
• Google Tag Manager presence and config
• Conversion tracking in place (goals/events)
• Facebook Pixel or other retargeting tags
• Cookie consent or GDPR/CCPA compliance notices

⸻

8. Business Alignment Audit

Tools: Manual + brief business research
Touch Points & Metrics:
• Clear business value propositions on homepage
• Easy-to-find contact methods
• Lead generation funnels (quote forms, CTAs, etc.)
• Online scheduling or booking tools
• Social proof (reviews, partnerships, testimonials)
• Match between online offerings and physical services
• E-commerce readiness (product info, carts, payments)

⸻

Optional Bonus: Brand Identity Audit

Touch Points:
• Consistent color, typography, logo use
• Modern, relevant design aesthetic
• Emotional tone fit for target audience
• On-brand photography and visuals

- Estimate cost on a points scale for each operation, external API usage, server costs, data costs, etc. Create a point value tracker/estimator lib, and use it within each module to add up points and estimate queries/operations ahead-of-time, with ability to deduct points used or reject an operation if estimate exceeds current points.

Outside of cursor:

- Look up example SEO reports, name the source, pricing (exact or estimated), link to example (or product site), and comprehensive list of features. Create a comparison table for all results and features. Write a list of every service, naming the feature, benefit, methods/techniques, purpose

- Look up example [web service offering: SEO, review & reputation management, ...]
