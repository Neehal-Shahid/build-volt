# Project Structure

Directory structure of the project (ignoring node_modules, dist, .git, etc.).

```text
build-Bolt/
├── client
│   ├── public
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src
│   │   ├── admin
│   │   │   ├── activityLog.js
│   │   │   ├── admin.css
│   │   │   ├── AdminActivity.jsx
│   │   │   ├── AdminApiModel.jsx
│   │   │   ├── AdminComms.jsx
│   │   │   ├── AdminDbHealth.jsx
│   │   │   ├── AdminOverview.jsx
│   │   │   ├── AdminPayments.jsx
│   │   │   ├── AdminPlatformStats.jsx
│   │   │   ├── AdminRevenue.jsx
│   │   │   ├── AdminSettings.jsx
│   │   │   ├── AdminStores.jsx
│   │   │   ├── adminUi.jsx
│   │   │   └── useToast.js
│   │   ├── assets
│   │   ├── auth
│   │   │   ├── Alert.jsx
│   │   │   ├── auth.css
│   │   │   ├── AuthLayout.jsx
│   │   │   ├── OtpInput.jsx
│   │   │   ├── PasswordField.jsx
│   │   │   ├── PasswordStrength.jsx
│   │   │   ├── SubmitButton.jsx
│   │   │   └── TextField.jsx
│   │   ├── components
│   │   │   ├── GlobalLoading.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── Reveal.jsx
│   │   ├── context
│   │   │   ├── AdminAuthContext.jsx
│   │   │   └── AuthContext.jsx
│   │   ├── dashboard
│   │   │   ├── ui
│   │   │   │   ├── Alert.jsx
│   │   │   │   ├── Badge.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   ├── PageHeader.jsx
│   │   │   │   ├── Skeleton.jsx
│   │   │   │   └── StatCard.jsx
│   │   │   ├── AccountTab.jsx
│   │   │   ├── AnalyticsTab.jsx
│   │   │   ├── BillingTab.jsx
│   │   │   ├── dashboard.css
│   │   │   ├── DemoCheckout.jsx
│   │   │   ├── EmbedTab.jsx
│   │   │   ├── HelpTab.jsx
│   │   │   ├── OverviewTab.jsx
│   │   │   ├── PlaceholderTab.jsx
│   │   │   ├── ProductsTab.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── StoreSetupGate.jsx
│   │   │   ├── StoreSyncTab.jsx
│   │   │   ├── Topbar.jsx
│   │   │   └── WidgetSettingsTab.jsx
│   │   ├── hooks
│   │   │   └── useReveal.js
│   │   ├── landing
│   │   │   ├── Faq.jsx
│   │   │   ├── Features.jsx
│   │   │   ├── FinalCta.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Hero.jsx
│   │   │   ├── HowItWorks.jsx
│   │   │   ├── landing.css
│   │   │   ├── LocalStrip.jsx
│   │   │   ├── Logo.jsx
│   │   │   ├── Pricing.jsx
│   │   │   ├── PurposeStrip.jsx
│   │   │   ├── Showcase.jsx
│   │   │   └── WidgetPreview.jsx
│   │   ├── lib
│   │   │   ├── api.js
│   │   │   └── catalogMode.js
│   │   ├── pages
│   │   │   ├── Admin.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── ResetPassword.jsx
│   │   │   ├── Signup.jsx
│   │   │   └── Verify.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env
│   ├── .gitignore
│   ├── .oxlintrc.json
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   └── vite.config.js
├── plugin
│   └── buildbot-woocommerce
│       ├── buildbot-woocommerce.php
│       └── readme.txt
├── server
│   ├── lib
│   │   ├── auth.js
│   │   ├── demoCards.js
│   │   ├── paymentMode.js
│   │   ├── pluginArtifacts.js
│   │   ├── pluginAuth.js
│   │   ├── products.js
│   │   └── wooCategories.js
│   ├── public
│   │   ├── buildbot-woocommerce.zip
│   │   └── plugin-update.json
│   ├── routes
│   │   ├── admin.js
│   │   ├── adminAdvanced.js
│   │   ├── auth.js
│   │   ├── billing.js
│   │   ├── plugin.js
│   │   ├── products.js
│   │   ├── recommend.js
│   │   └── store.js
│   ├── scripts
│   │   ├── build-plugin.js
│   │   ├── phase11-smoke.js
│   │   └── regression-p0-p10.js
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── cron.js
│   ├── database.js
│   ├── email.js
│   ├── index.js
│   ├── local.db
│   ├── package-lock.json
│   ├── package.json
│   ├── widget-test.html
│   ├── widget.css
│   └── widget.js
├── .gitignore
├── cursor_phase_1_file_review.md
├── DEPLOYMENT_GUIDE.md
├── generate_tree.js
├── PAYMENT_TEST_CARDS.md
├── REACT_REBUILD_HANDOFF.md
└── REACT_REBUILD_PROGRESS.md
```
