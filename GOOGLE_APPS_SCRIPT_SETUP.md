# Google Apps Script email setup (free-tier approach)

This project uses GitHub Pages for the free static front end and Google Apps Script for sending the result summary plus a real `.html` report attachment to both the administrator and candidate. It does **not** use a Google Sheet or central results database.

## A. Configure the script

1. Sign in to the Google account that should send the emails.
2. Visit https://script.google.com/ and choose **New project**.
3. Open the project's default `Code.gs`, replace its contents with the `Code.gs` file from this project.
4. At the top of `Code.gs`, change:
   `const ADMIN_EMAIL = "REPLACE_WITH_YOUR_ADMIN_EMAIL@example.com";`
   to the email address that should receive every result.
5. Save the project with a name such as `NEET PG Mock Test Result Sender`.
6. In the function dropdown, select `checkMailQuota` and click **Run**. Review and grant the requested permission to send email from your account. This function is only a quota check; it does not send an email.
7. Open **Deploy → New deployment**.
8. Click the gear/type selector and choose **Web app**.
9. Set **Execute as** to **Me** (the owner/deployer).
10. Set **Who has access** to **Anyone** so students do not need to sign into Google. If your account does not offer this setting, the public endpoint cannot be used in this way from that account.
11. Click **Deploy**, authorize if prompted, then copy the Web app URL ending in `/exec`. Do not use the `/dev` testing URL for the public website.

## B. Connect GitHub Pages

1. Open `config.js` in the project.
2. Replace `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with the copied `/exec` URL.
3. Change `enabled: false` to `enabled: true`.
4. Save and upload the updated files to the root of your GitHub repository.
5. In GitHub, open **Settings → Pages**, select `main` and `/(root)`, and publish.
6. Open the live site, complete a short test with your own email address, submit, and check the admin and candidate inboxes plus Spam/Junk.
7. The email should contain `NEET-PG-Mock-Result.html` as an attachment. Open the attachment in a browser to review the answer-by-answer report.

## C. Update an existing deployment

When you edit `Code.gs`, save it and use **Deploy → Manage deployments → Edit**. Select a new version and deploy. The public `/exec` URL normally remains the same when editing an existing deployment. Re-test after changes.

## D. Important behavior and limitations

- Two email recipients are used per submission: one admin email and one candidate email. The script attaches the HTML report to both.
- The script does not create a Google Sheet, save a Drive file, or intentionally persist result records. Google may still retain execution logs/metadata, and email copies remain in recipients' mailboxes.
- The browser uses a cross-origin `no-cors` request to send the payload to Apps Script. The browser cannot read the server's response, so the page can report only that the request was dispatched—not prove the emails reached the inbox. Confirm with test emails and monitor **Apps Script → Executions**.
- If the same candidate email submits again within the 90-second cooldown, the server rejects the second attempt. This is a basic duplicate/abuse guard, not strong authentication.
- This sends emails as the Google account that owns the Apps Script deployment. The candidate cannot choose the admin destination.

## E. Cost and quotas

Apps Script and GitHub Pages have free options. Google can change quotas and terms. Current official documentation lists a consumer-account MailApp quota of **100 email recipients per day**; each test sends to two recipients, so the theoretical maximum under that quota is about 50 submissions/day, often less after other usage. Google Workspace quotas differ. Check current limits before a large event:
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/reference/mail/mail-app
- https://developers.google.com/apps-script/guides/web

## F. Security — do not skip this before public launch

1. **Public endpoint abuse risk:** because students need anonymous access, anyone who obtains the `/exec` URL can attempt to call it. The script has input validation, a payload limit and a basic email cooldown, but these are not robust anti-abuse controls. A malicious user could still consume your email quota. For a public/high-traffic release, add a CAPTCHA/anti-bot verification and stronger rate limiting before publishing widely.
2. **Owner account protection:** the script sends mail using the owner's authority. Never put a Gmail password, OAuth token, SMTP secret or private key in `config.js` or any GitHub file.
3. **Answer key exposure:** the question bank and correct answers are downloaded to the student's browser. This is for practice and self-assessment, not a secure or proctored examination.
4. **No central result database:** no Sheet/DB is created, but emails are records and the mail provider processes them. Explain this to students and obtain any required consent.
5. **Personal data:** collect only what you need. Candidate name/email and their answer report may be sensitive educational information. Use a clear privacy notice and follow your institution's policy and applicable Indian data-protection requirements.
6. **Delivery is not guaranteed:** quota exhaustion, Google policy checks, invalid addresses and spam filtering can stop or delay delivery. Keep the local download report available.
7. **Report size:** very large question banks create large HTML attachments and request payloads. This starter has a payload limit; test the full report size before using a large exam.
8. **Do not use the same endpoint as a secure exam API:** client-side answers and score data can be modified. The backend emails the submitted score; it cannot independently prove that the score is honest.

## Troubleshooting

- **No email arrives:** open Apps Script → **Executions** and inspect recent runs. Check the fixed `ADMIN_EMAIL`, quota, permissions, and deployment version.
- **Script says unauthorized:** run `checkMailQuota` in the editor and grant MailApp permission, then redeploy.
- **Page says not configured:** confirm `enabled: true` and a correct `/exec` URL in `config.js`.
- **Candidate does not receive email:** verify the candidate address, Spam/Junk, and daily quota.
- **Need to stop public sending:** edit the deployment access or disable/delete the web-app deployment. Changing the front-end button alone is not enough to secure a publicly exposed endpoint.
