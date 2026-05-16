# **App Name**: BDM Compass

## Core Features:

- User Authentication & Access Control: Secure user login via Firebase Authentication, with automatic role-based routing (BDM vs. Leader) determined by user profiles stored in Firestore.
- BDM Personal Performance Dashboard: A mobile-first dashboard for individual BDMs to view their own secure KPIs, revenue trends, and read-only coaching notes pulled from Firestore.
- Leader Team Performance Dashboard: A comprehensive dashboard for Leaders to monitor all BDMs' performance statistics, trends, and to add coaching notes, all powered by Firestore data.
- Secure Coaching Notes Management: Allows Leaders to create coaching notes for BDMs, which are securely stored in Firestore with strict access controls. BDMs can view only their own notes.
- Personal Scorecard PDF Tool: A tool for individual BDMs to generate and download a personalized PDF scorecard of their performance data, compiled from their Firestore records via a Cloud Function.
- Executive Report PDF Tool: A tool for Leaders to trigger and download comprehensive executive PDF performance reports for the entire team, aggregating data from Firestore via a Cloud Function.

## Style Guidelines:

- Primary color: Deep professional violet (#3F364C) to convey trust and enterprise-grade professionalism, balanced with analytical focus.
- Background color: A very light, desaturated violet (#F7F6F8) providing a clean, spacious backdrop that aids readability and reduces cognitive load.
- Accent color: A brighter, vibrant blue-violet (#6666CC) to highlight interactive elements, calls-to-action, and key data points, creating clear visual hierarchy.
- All text will use 'Inter', a grotesque-style sans-serif font known for its modernity, neutrality, and excellent readability across all screen sizes, suitable for both headlines and body text.
- Utilize a consistent set of minimalist, solid or outlined icons that are functional and easily understandable, supporting clarity in data representation and navigation without unnecessary adornment.
- Employ a responsive, mobile-first grid-based layout for dashboards, ensuring optimal organization and display of data across devices, avoiding horizontal scrolling on mobile.
- Implement subtle, functional animations for state changes, data loading, and transitions between views to enhance the perceived performance and user experience without causing distraction.