const React = require('react');
const ReactPDF = require('@react-pdf/renderer');
const fs = require('fs');
const path = require('path');

const { Document, Page, Text, View, StyleSheet } = ReactPDF;

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 25,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e3a8a',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 6,
  },
  bulletItem: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#334155',
    marginLeft: 15,
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  }
});

// Helper component for structured sections
function PdfSection({ title, children }) {
  const childrenArray = Array.isArray(children) ? children : [children];
  return React.createElement(
    View,
    { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, title),
    ...childrenArray
  );
}

// 1. Instagram Document
const InstagramDoc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.header }, "YaySchedule - Instagram & Creative Guide"),
    React.createElement(Text, { style: styles.subtitle }, "Created by Mahesh Arora • Visual Pitch & Engagement Strategy"),
    
    React.createElement(
      PdfSection,
      { title: "1. Brand Identity & Aesthetic Pitch" },
      React.createElement(Text, { style: styles.bodyText }, "YaySchedule is a stunning, premium, glassmorphic personal assistant application. It brings organization to life with custom gradients, vibrant accent colors, and a clean dark mode interface. Perfect for creators, designers, and students who value aesthetic productivity."),
      React.createElement(Text, { style: styles.bodyText }, "Key Brand Message: \"Organization shouldn't look boring. Ditch the messy journals and embrace the ultimate aesthetic dashboard.\"")
    ),

    React.createElement(
      PdfSection,
      { title: "2. Reels & Stories Engagement Hooks" },
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 \"The clean desk aesthetic but for your phone. Here is how I organize my life with YaySchedule.\""),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 \"Stop writing reminders in 5 different apps. Type /reminder buy coffee in chat, and watch it automatically saved.\""),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 \"Aesthetic calendar matching: Drag and drop your tasks in dark mode. Pure satisfaction.\"")
    ),

    React.createElement(
      PdfSection,
      { title: "3. Visual Content Ideas" },
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Carousel: 5 Steps to Building an Aesthetic Second Brain (featuring YaySchedule's TippTap editor)."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Story: Before vs. After organizing the week using the interactive calendar."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Video: Showcasing offline command mode (typing /event with internet turned off).")
    ),

    React.createElement(
      PdfSection,
      { title: "4. Suggested Captions & Hashtags" },
      React.createElement(Text, { style: styles.bodyText }, "Caption: \"Taking control of my schedule has never looked this good. YaySchedule lets me organize my calendar, write rich notes, and set offline reminders with simple slash commands. 🚀 ✨\""),
      React.createElement(Text, { style: styles.bodyText }, "Hashtags: #YaySchedule #AestheticProductivity #SecondBrain #DigitalPlanner #OrganizedLife #DarkModeTheme #PWAApp #DeskAesthetic")
    ),
    
    React.createElement(Text, { style: styles.footer }, "YaySchedule | Instagram & Creative Guide • Page 1")
  )
);

// 2. LinkedIn Document
const LinkedInDoc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.header }, "YaySchedule - Professional & Business Profile"),
    React.createElement(Text, { style: styles.subtitle }, "Created by Mahesh Arora • Value Proposition & Professional Highlights"),
    
    React.createElement(
      PdfSection,
      { title: "1. Professional Summary" },
      React.createElement(Text, { style: styles.bodyText }, "YaySchedule is a local-first, mobile-responsive Progressive Web Application (PWA) engineered to act as a centralized dashboard for events, reminders, and knowledge management. By leveraging local databases and cloud replication layers, it provides zero-latency interactions and reliable offline operation.")
    ),

    React.createElement(
      PdfSection,
      { title: "2. Key Innovations & Business Value" },
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Local-First Storage Architecture: Uses Dexie.js (IndexedDB wrapper) for sub-millisecond local reads/writes, ensuring the app remains usable even under zero-connectivity scenarios."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Real-time Cloud Replication: Connects to a secure Supabase sync layer to unify data state across client devices without risking data-loss on new device initialization."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Hybrid NLP Interface: Incorporates an offline-friendly natural language parser (Chrono-node + Compromise) alongside Gemini/OpenRouter AI providers to parse tasks seamlessly.")
    ),

    React.createElement(
      PdfSection,
      { title: "3. Resume / Profile Description Template" },
      React.createElement(Text, { style: styles.bodyText }, "Mahesh Arora | Lead Software Engineer"),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Architected and deployed YaySchedule, a cross-device synced PWA scheduler & organizer supporting offline-first transactions."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Integrated natural language processing libraries (Chrono-node, Compromise) and Gemini/OpenRouter LLMs to enable grammar-corrected, conversational scheduling tools."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Implemented a robust data sync protocol with Supabase PostgreSQL to prevent empty client overrides during connection restoration.")
    ),

    React.createElement(Text, { style: styles.footer }, "YaySchedule | Professional Profile & Highlights • Page 1")
  )
);

// 3. Technical Document
const TechnicalDoc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.header }, "YaySchedule - Technical Documentation"),
    React.createElement(Text, { style: styles.subtitle }, "System Architecture, Data Sync Protocol & NLP Engine Details"),
    
    React.createElement(
      PdfSection,
      { title: "1. Core Technology Stack" },
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Frontend Framework: Next.js (App Router, Turbopack, React 19) for fast server-side optimization and static prerendering."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Local Database Layer: Dexie.js (wrapper for IndexedDB) providing full transactional support, schema migrations, and queries in-browser."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Cloud Synchronization: Supabase (PostgreSQL client) with realtime triggers and structured sync logs."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Text Editor & Calendar: TippTap rich text framework and FullCalendar core wrapper.")
    ),

    React.createElement(
      PdfSection,
      { title: "2. The Local-First Sync Safeguard" },
      React.createElement(Text, { style: styles.bodyText }, "To solve the data loss issue when adding a new/empty device, the client sync logic in 'lib/db/sync.ts' blocks automatic pushes if the device has never performed an initial pull. It checks 'last_sync_pull' in LocalStorage; if missing, it forces a pull and merges records locally using UUID comparison before initiating any server push.")
    ),

    React.createElement(
      PdfSection,
      { title: "3. Intent Classification & Offline NLP Pipeline" },
      React.createElement(Text, { style: styles.bodyText }, "When a message is typed in the assistant chat:"),
      React.createElement(Text, { style: styles.bulletItem }, "1. Prefix Check: Checks if the input starts with '/note', '/reminder', or '/event'."),
      React.createElement(Text, { style: styles.bulletItem }, "2. Provider Check: If the user has configured Gemini or OpenRouter, it calls the LLM with formatting prompts to correct spelling, polish grammar, and output JSON details."),
      React.createElement(Text, { style: styles.bulletItem }, "3. Offline Fallback: If offline or keys are absent, it routes input to 'Chrono-node' (extracts dates/times) and 'Compromise' (normalizes and cleans titles), saving the structured item instantly in DexieDB.")
    ),

    React.createElement(
      PdfSection,
      { title: "4. Deployment & PWA Configuration" },
      React.createElement(Text, { style: styles.bodyText }, "The project is deployed on Vercel with CNAME alias to 'www.yayschedule.com'. HTTPS is automatically managed via Let's Encrypt certificates. Service workers cached resources locally, allowing users to add the app to their mobile home screen with the custom-designed brand icon.")
    ),

    React.createElement(Text, { style: styles.footer }, "YaySchedule | System Architecture Specifications • Page 1")
  )
);

// 4. Myself Document
const MyselfDoc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.header }, "YaySchedule - Mahesh Arora's Guide"),
    React.createElement(Text, { style: styles.subtitle }, "Personal Developer Manual, Maintenance Cheat-Sheet & Commands"),
    
    React.createElement(
      PdfSection,
      { title: "1. Core Philosophy" },
      React.createElement(Text, { style: styles.bodyText }, "YaySchedule is your custom-built personal cockpit. It was created to combine high-end aesthetics, premium typography, absolute privacy, and offline capabilities. You own the code, you own the domain, and you control where your sync data goes.")
    ),

    React.createElement(
      PdfSection,
      { title: "2. Maintenance & Commands" },
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Local Run: Run 'npm run dev' to start local development server at http://localhost:3000."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Production Build: Run 'npm run build' to confirm typescript compilation and generate static routes."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 Deploy: Run 'npx vercel --prod --yes' to immediately update the live website.")
    ),

    React.createElement(
      PdfSection,
      { title: "3. Slash Commands Quick Reference" },
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 '/reminder Buy groceries tomorrow at 5 PM' -> Adds reminder, parsed with correct grammar."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 '/event Product Launch meeting next Monday 10:00' -> Creates a calendar event."),
      React.createElement(Text, { style: styles.bulletItem }, "\u2022 '/note Design Ideas' -> Opens/creates a note with the specified title.")
    ),

    React.createElement(
      PdfSection,
      { title: "4. Backup Strategy" },
      React.createElement(Text, { style: styles.bodyText }, "Always go to Settings -> click 'Export Backup' to save a JSON copy of your local data. Keep your Supabase credentials secure. Since the repository is pushed to GitHub, you will never lose your project files as long as you maintain your account credentials.")
    ),

    React.createElement(Text, { style: styles.footer }, "YaySchedule | Owner & Developer Manual • Page 1")
  )
);

// Output Directory
const outputDir = path.join(__dirname, '..', 'project-info');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate the PDFs
async function generateAll() {
  console.log('Generating PDFs...');
  try {
    await ReactPDF.renderToFile(InstagramDoc, path.join(outputDir, 'yay-schedule-instagram.pdf'));
    console.log('Generated yay-schedule-instagram.pdf');
    
    await ReactPDF.renderToFile(LinkedInDoc, path.join(outputDir, 'yay-schedule-linkedin.pdf'));
    console.log('Generated yay-schedule-linkedin.pdf');
    
    await ReactPDF.renderToFile(TechnicalDoc, path.join(outputDir, 'yay-schedule-technical.pdf'));
    console.log('Generated yay-schedule-technical.pdf');
    
    await ReactPDF.renderToFile(MyselfDoc, path.join(outputDir, 'yay-schedule-myself.pdf'));
    console.log('Generated yay-schedule-myself.pdf');
    
    console.log('PDF generation complete!');
  } catch (e) {
    console.error('Error generating PDFs:', e);
  }
}

generateAll();
