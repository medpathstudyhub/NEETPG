/**
 * NEET PG-style Mock Test — Google Apps Script email endpoint
 * No spreadsheet, Drive file, or central results database is used.
 *
 * IMPORTANT: Change ADMIN_EMAIL before deploying.
 * Deploy as: Execute as "Me"; Who has access: "Anyone".
 * The endpoint is public, so the server validates inputs, applies a basic cooldown,
 * and always sends the admin copy to the fixed address below (never a client-supplied admin).
 */

const ADMIN_EMAIL = "medpathstudyhub@gmail.com";
const APP_NAME = "NEET PG-Style Mock Test";
const MAX_PAYLOAD_CHARS = 180000;
const COOLDOWN_SECONDS = 90;

function doGet() {
  return ContentService
    .createTextOutput("NEET PG mock test email endpoint is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return output_({ ok: false, message: "Empty request." });
    }
    const raw = e.postData.contents;
    if (raw.length > MAX_PAYLOAD_CHARS) {
      return output_({ ok: false, message: "Report is too large." });
    }

    const data = JSON.parse(raw);
    const name = cleanText_(data.candidateName, 100);
    const candidateEmail = cleanEmail_(data.candidateEmail);
    const submittedAt = cleanText_(data.submittedAt, 100);
    const score = cleanText_(data.score, 40);
    const maxScore = cleanText_(data.maxScore, 40);
    const correct = cleanText_(data.correct, 20);
    const incorrect = cleanText_(data.incorrect, 20);
    const unanswered = cleanText_(data.unanswered, 20);
    const manualReview = cleanText_(data.manualReview, 20);
    const questionCount = cleanText_(data.questionCount, 20);
    const reportHtml = String(data.resultHtml || "");
    const submissionId = cleanText_(data.submissionId, 100);

    if (!name || !isValidEmail_(candidateEmail) || !score || !maxScore) {
      return output_({ ok: false, message: "Missing or invalid candidate/result fields." });
    }
    if (!isValidEmail_(ADMIN_EMAIL) || ADMIN_EMAIL.indexOf("REPLACE_WITH_") === 0) {
      return output_({ ok: false, message: "Admin email is not configured in Code.gs." });
    }
    if (!reportHtml || reportHtml.length > MAX_PAYLOAD_CHARS) {
      return output_({ ok: false, message: "Missing or oversized HTML report." });
    }

    // Basic duplicate/cooldown guard. This is abuse reduction, not strong authentication.
    const cache = CacheService.getScriptCache();
    const emailKey = "submit_" + digest_(candidateEmail.toLowerCase());
    if (cache.get(emailKey)) {
      return output_({ ok: false, message: "Please wait before submitting another result from this email." });
    }
    const nonceKey = submissionId ? "nonce_" + digest_(submissionId) : "";
    if (nonceKey && cache.get(nonceKey)) {
      return output_({ ok: false, message: "This submission was already received." });
    }
    cache.put(emailKey, "1", COOLDOWN_SECONDS);
    if (nonceKey) cache.put(nonceKey, "1", 21600);

    const subject = "Mock test result: " + name + " — " + score + "/" + maxScore;
    const plainSummary =
      APP_NAME + " — Result Summary\n\n" +
      "Candidate: " + name + "\n" +
      "Candidate email: " + candidateEmail + "\n" +
      "Submitted: " + submittedAt + "\n" +
      "Score: " + score + " / " + maxScore + "\n" +
      "Correct: " + correct + "\n" +
      "Incorrect: " + incorrect + "\n" +
      "Unanswered: " + unanswered + "\n" +
      "Manual review: " + manualReview + "\n" +
      "Questions: " + questionCount + "\n\n" +
      "The full question-by-question HTML report is attached.\n" +
      "Practice tool only; not an official NBEMS/NBE result.";

    const safeFileName = "NEET-PG-Mock-Result.html";
    const attachment = Utilities.newBlob(reportHtml, "text/html", safeFileName);
    const htmlSummary =
      "<h2>" + escapeHtml_(APP_NAME) + " — Result Summary</h2>" +
      "<p><b>Candidate:</b> " + escapeHtml_(name) + "<br>" +
      "<b>Candidate email:</b> " + escapeHtml_(candidateEmail) + "<br>" +
      "<b>Submitted:</b> " + escapeHtml_(submittedAt) + "</p>" +
      "<p><b>Score:</b> " + escapeHtml_(score) + " / " + escapeHtml_(maxScore) + "<br>" +
      "<b>Correct:</b> " + escapeHtml_(correct) + "<br>" +
      "<b>Incorrect:</b> " + escapeHtml_(incorrect) + "<br>" +
      "<b>Unanswered:</b> " + escapeHtml_(unanswered) + "<br>" +
      "<b>Manual review:</b> " + escapeHtml_(manualReview) + "<br>" +
      "<b>Questions:</b> " + escapeHtml_(questionCount) + "</p>" +
      "<p>The full question-by-question HTML report is attached.</p>" +
      "<p><i>Practice tool only; not an official NBEMS/NBE result.</i></p>";

    // The admin recipient is fixed in this server-side script.
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: subject,
      body: plainSummary,
      htmlBody: htmlSummary,
      replyTo: candidateEmail,
      name: APP_NAME,
      attachments: [attachment.copyBlob()]
    });

    // Candidate gets a separate email with the same report attached.
    MailApp.sendEmail({
      to: candidateEmail,
      subject: "Your mock test result — " + score + "/" + maxScore,
      body: plainSummary,
      htmlBody: htmlSummary,
      name: APP_NAME,
      attachments: [attachment.copyBlob()]
    });

    return output_({ ok: true, message: "Result emails queued." });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return output_({ ok: false, message: "Could not process submission." });
  }
}

function cleanText_(value, maxLength) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}

function cleanEmail_(value) {
  return String(value == null ? "" : value).trim().slice(0, 254);
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function digest_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return bytes.map(function(b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
}

function escapeHtml_(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

function output_(object) {
  return ContentService.createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run manually in the Apps Script editor once to authorize MailApp. */
function checkMailQuota() {
  Logger.log("Remaining email recipients today: " + MailApp.getRemainingDailyQuota());
}
