/* MEDPATH STUDY HUB — Option A convenience login (not secure authentication).
 * Set LOGIN_USERNAME and LOGIN_PASSWORD below. Public JavaScript is visible to visitors.
 */
(function () {
  "use strict";
  const LOGIN_USERNAME = "admin"; // Change this
  const LOGIN_PASSWORD = "medpathadmin@123"; // Change this before publishing
  const SESSION_KEY = "medpathAdminLoggedIn";

  function isAdminPage() {
    return /(?:^|\/)admin\.html$/i.test(window.location.pathname);
  }

  if (isAdminPage()) {
    if (sessionStorage.getItem(SESSION_KEY) !== "yes") {
      window.location.replace("login.html");
      return;
    }
    // Wait until the admin page's button exists before wiring up logout.
    document.addEventListener("DOMContentLoaded", function () {
      const logoutButton = document.getElementById("adminLogoutBtn");
      if (logoutButton) {
        logoutButton.addEventListener("click", function () {
          sessionStorage.removeItem(SESSION_KEY);
          window.location.replace("login.html");
        });
      }
    });
    return;
  }

  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const error = document.getElementById("loginError");
    if (username === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "yes");
      window.location.href = "admin.html";
    } else {
      error.textContent = "Incorrect username or password. Please try again.";
      document.getElementById("password").value = "";
      document.getElementById("password").focus();
    }
  });
})();
