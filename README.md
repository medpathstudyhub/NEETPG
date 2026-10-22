# NEET PG CBT-style Mock Test — Version 2

## What's changed
- More exam-like desktop layout: dark examination header, timer, question panel, right-side question palette, candidate panel, review status and submit button.
- Adjustable question text size.
- Multiple question types with browser-side answer evaluation where feasible.
- Image support using local relative paths.
- Downloadable standalone HTML result with summary, response, answer key and explanations.
- No central results database.

**Important:** this is inspired by general computer-based examination layouts. It is not the official NBEMS/NBE interface. Actual NEET PG is principally a single-best-answer MCQ examination; the other formats below are custom practice formats, not a claim about official exam question types.

## MEDPATH Study Hub navigation
- `index.html` is the new MEDPATH STUDY HUB front page with year tabs.
- `index2.html` is the preserved NEET PG quiz entry page. It accepts `?subject=Physiology` and `?subject=Physiology&topic=Neurotransmitters` for preselected subject/topic practice.
- `topics.html` is the separate Topic Directory Explorer. A subject shows a topic directory when questions contain a `topic` field; subjects with no topics go directly to subject practice.
- Admin manual entry and Excel/CSV imports support the optional `Topic` field. The import workbook included in the ZIP has a `Topic` column.

## Start locally
Extract the ZIP, then open `index.html`. If browser restrictions affect local images, run a local web server in this folder (`python -m http.server 8000`) and visit `http://localhost:8000`.

## Publish on GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, `app.js`, `questions.js`, `config.js`, `README.md`, and the `images` folder.
3. Repository Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save.
4. Open the URL shown by GitHub Pages. It can take a few minutes to publish.

## Add a question
Open `questions.js`. Each question is one object inside `window.QUESTION_BANK=[ ... ]`. Add a comma between objects. Fields vary by type. `correctIndex` is zero-based (0 = A).

### Supported formats
| Type | `type` value | How answer is stored |
|---|---|---|
| Single-answer MCQ | `mcq` | `options`, `correctIndex` |
| Multiple response | `multiple_response` | `options`, `correctAnswers: [0,2]` |
| True/False | `true_false` | `correctAnswer: "true"` or `"false"` |
| Short answer | `short_answer` | `acceptedAnswers: ["answer","alternate"]` |
| Numeric | `numeric` | `correctNumeric`, optional `tolerance`, `unit` |
| Matching | `matching` | `leftItems`, `rightItems`, `correctPairs` |
| Hotspot | `hotspot` | `image`, `hotspot: {x:50,y:50,r:12}` percentages |
| Drag-and-drop | `drag_drop` | `dragItems`, `dropZones`, `correctDrops` |
| Essay | `essay` | response is stored for report; manually mark it |
| Fill in blanks | `fill_blanks` | text uses `{{1}}`, `{{2}}`; `blanks: ["answer1","answer2"]` |
| Select from list | `select_list` | `listOptions`, `correctValue` |
| Drag words | `drag_words` | `wordBank`, `correctWord` |
| Sequence/order | `sequence` | `sequenceItems`, `correctSequence` |

### Image questions
1. Create a folder named `images` next to `index.html`.
2. Copy your image into that folder, e.g. `heart-diagram.png`.
3. In a question object add `image: "images/heart-diagram.png"`.
4. Optional: add `imageCaption: "Diagram of the heart"` and `imageAlt: "Anatomical heart diagram"`.
5. Upload the image folder to GitHub along with the project. File names and letter case must match exactly.
6. For a hotspot question, set `type: "hotspot"` and define the target as percentage coordinates: `hotspot: {x: 50, y: 50, r: 10}`. x/y are percentages across the displayed image and r is the allowed distance in percentage points. Verify coordinates at the actual display size.

Example image MCQ:
```
{
  id: 15,
  type: "mcq",
  subject: "Anatomy",
  text: "Identify the structure marked in the image.",
  image: "images/anatomy-diagram.png",
  imageAlt: "Anatomical diagram with an arrow",
  imageCaption: "Study the arrow before choosing.",
  options: ["Aorta", "Pulmonary artery", "Vena cava", "Azygos vein"],
  correctIndex: 0,
  explanation: "Explain the identifying anatomical features here.",
  marks: 4,
  negative: 1
}
```
Do not use images unless you have permission. Use clear, legible diagrams and provide useful alt text.

## Google Apps Script email delivery (recommended free setup)

This version uses Google Apps Script `MailApp` rather than EmailJS. Configure `Code.gs` and `config.js` by following `GOOGLE_APPS_SCRIPT_SETUP.md`. The script sends the result summary and attaches the full HTML report to both the fixed admin address and candidate address. It does not create a Google Sheet or central results database.

Google Apps Script public web apps have quotas and a public endpoint can be abused. Read the security section in `GOOGLE_APPS_SCRIPT_SETUP.md` before public launch. The endpoint is suitable for a free practice project, not a secure high-stakes examination.

## Important limitations
- Questions and answer keys are downloaded to the browser and can be inspected; this is not suitable for high-stakes/proctored exams.
- No central database means no instructor dashboard or central result recovery.
- Essays are not automatically graded; review manually. Short answer matching is exact after case/outer-space normalization; provide variants in `acceptedAnswers`.
- Matching/sequence are auto-graded; ensure the correct mapping/order is entered carefully.
- This project is a starter framework. Test all question formats on desktop and mobile and validate the question bank before use.

## Version 4 — Student and Admin pages separated
- `index.html` is the student page. Students enter their name/email/duration and press **I am ready to begin**; they do not see Excel import controls.
- `admin.html` is the separate question-bank manager. Open it directly as `/admin.html` on GitHub Pages.
- Import the Excel/CSV bank in the admin page. It checks duplicate question text and lets you download `questions.js`.
- To make the imported questions available to all students, replace the repository's `questions.js` with the downloaded file and commit/publish the change in GitHub.
- The admin page imports common MCQ, multiple-response, true/false, short-answer, fill-in-the-blanks, numeric, select-list and essay rows. Rows using specialised matching/hotspot/sequence/drag-and-drop formats are skipped by this simplified importer rather than being silently converted incorrectly. Add those formats directly to `questions.js` using the structures documented above, or request a type-specific importer update.

### Security and storage caveat
GitHub Pages is static hosting. There is no server-side admin authentication and no shared database. The `/admin.html` page is not password-protected; do not consider its URL a security boundary. Imported questions are not uploaded automatically. Export the bank and publish `questions.js` yourself. Since answer keys are shipped to the browser, this is appropriate for practice, not secure high-stakes exams.

## Version 4 upgrade — section mode and manual question authoring

### Student modes
- **Subject-wise practice:** the subject dropdown is generated from the published question bank and displays each subject's available question count. The test uses all questions for the selected subject.
- **Strict full test:** requires at least 180 questions in `questions.js`, chooses 180 questions, and presents five sequential sections of 36 questions each. Each section has a 42-minute timer. The student can navigate only within the current section; when its timer expires, the app automatically advances and locks the previous section. Total timed duration is 210 minutes (3 hours 30 minutes). The last section's timeout submits the test automatically.
- **Mixed practice:** uses the selected custom duration and all available questions.

The current bundled bank is a small illustrative sample, not 180 questions. Strict mode intentionally will not start until you add at least 180 questions. It does not duplicate questions to pretend the bank is complete. Confirm the bank's clinical accuracy before use.

### Add questions manually in the admin UI
1. Open `admin.html` locally or at your site's `/admin.html` URL.
2. Use **Add a question manually** to enter subject, type, question, options/answer, marks, negative marks, and explanation.
3. The editor assigns an unused `manual-000001`-style ID and blocks duplicate question text. Supported manual types are single-answer MCQ, multiple response, true/false, short answer, and numeric.
4. Click **Download updated questions.js** to export both the existing bank and newly added/imported questions. Keep a backup of the previous file.
5. Replace the repository's `questions.js` with the downloaded file and commit/publish it to GitHub Pages. The browser editor is a local authoring tool, not a shared database; refreshing the admin page before export discards its unsaved session changes.

Excel/CSV import remains available. You can combine imported and manually authored questions in the same admin session, then export one consolidated bank. Always review imported correct answers and explanations before publishing.


## Image reliability tips
Use relative paths like `images/hypoglossal-nerve.jpg` with lowercase filenames and hyphens. The path must match the published file name and case exactly. Upload the image into the `images/` folder and commit it to GitHub along with `questions.js`. JPG/JPEG and PNG are both supported; PNG is not inherently more reliable. PNG is usually suitable for line diagrams and labels; JPG is often smaller for photographs. The quiz now URL-encodes spaces in relative image paths, but avoid spaces and special characters for fewer errors. A broken-image message indicates a missing file/path or filename-case mismatch.


### Topic-wise practice (updated)
The student entry page (`index2.html`) includes four modes: Subject-wise practice, Topic-wise practice, Mixed question practice, and Strict full-length mock test. Topic-wise practice enables the subject and topic dropdowns and filters the eligible questions to records matching both `subject` and `topic`. The topic dropdown is generated from topic values already present in `questions.js`. The number-of-questions field defaults to the maximum available for the current selection (up to 180) and remains editable. Topic directory links open `index2.html` directly in Topic-wise practice. Existing questions without a `topic` remain available in subject-wise and mixed practice.


## Subject-wise topic catalogue (zero-question topics)

The admin page includes a Subject-wise Topic Manager. Select a subject, paste one topic per line, and click Add topics to catalogue. Download `topics.js` and publish it beside `questions.js` to make those topics available on GitHub Pages, including topics with zero questions. Questions can be added later and tagged with a catalogue topic. When publishing, upload both files together.
