# AgriSaathi Complete Documentation Package

This package documents the AgriSaathi source tree as inspected on 22 November 2026. It contains the technical report, setup guide, database notes and system diagrams. The source archive excludes `node_modules`, build output, Git metadata and local secrets.

## Contents

- `01_Complete_Project_Documentation.docx` and `.pdf`: academic and handover report.
- `03_Source_Code/AgriSaathi_Source.zip`: source and configuration archive with Firebase web config redacted to placeholders.
- `04_Database_Documentation/Database_Structure.md` and `Sample_Database.json`.
- `06_System_Diagrams/`: Mermaid architecture and workflow diagrams.
- `08_Installation_Guide/Installation_Instructions.md`.

## Important setup note

The repository's Firebase client configuration is currently embedded in `src/firebase.js`; the packaged copy replaces it with placeholders. Configure a Firebase project and replace the placeholders before running that archive. Never add service account keys or production API secrets to client code or source control.

The report distinguishes code-observed behavior from configuration-dependent integrations. Test-case results are marked “Not verified” unless run as part of this documentation task.
