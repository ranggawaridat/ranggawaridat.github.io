/**
 * KAS Bintang Nusantara
 * Website Landing Page
 */


/* =========================================
   DOM ELEMENTS
========================================= */

const yearElement = document.getElementById("year");

const toastElement = document.getElementById("toast");

const downloadButton = document.getElementById("downloadButton");


/* =========================================
   COPYRIGHT YEAR
========================================= */

function updateCopyrightYear() {
  if (!yearElement) return;

  const currentYear = new Date().getFullYear();

  yearElement.textContent = currentYear;
}


/* =========================================
   TOAST NOTIFICATION
========================================= */

let toastTimeout;

function showToast(message, duration = 3000) {
  if (!toastElement) return;

  clearTimeout(toastTimeout);

  toastElement.textContent = message;

  toastElement.classList.add("show");

  toastTimeout = setTimeout(() => {
    toastElement.classList.remove("show");
  }, duration);
}


/* =========================================
   DOWNLOAD HANDLER
========================================= */

function setupDownloadButton() {
  if (!downloadButton) return;

  downloadButton.addEventListener("click", () => {
    showToast("Membuka unduhan KAS Bintang Nusantara...");
  });
}


/* =========================================
   INITIALIZATION
========================================= */

function init() {
  updateCopyrightYear();

  setupDownloadButton();
}

init();