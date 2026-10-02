const requestFormPanel = document.getElementById("requestFormPanel");
const requestsHistoryCard = document.getElementById("requestsHistoryCard");
const documentRequestForm = document.getElementById("documentRequestForm");
const requestDocumentRows = document.getElementById("requestDocumentRows");
const requestRequirementsList = document.getElementById("requestRequirementsList");
const requestReleaseMethod = document.getElementById("requestReleaseMethod");
const requestPaymentMethod = document.getElementById("requestPaymentMethod");
const requestPurposeInput = document.getElementById("requestPurpose");
const defaultPurposePlaceholder = "e.g. Scholarship application, employment, transfer";
requestPurposeInput.placeholder = defaultPurposePlaceholder;
const dateReleaseDisplay = document.getElementById("dateReleaseDisplay");
const requestFormMessage = document.getElementById("requestFormMessage");
const requestsBody = document.getElementById("requestsBody");
const requestSteps = [...document.querySelectorAll("[data-request-step]")];
const requestStepIndicators = [...document.querySelectorAll("[data-step-indicator]")];
const requestSuccess = document.getElementById("requestSuccess");
const maxCopiesPerDocument = 5;
const trackingQrValidityMs = 7 * 24 * 60 * 60 * 1000;
const softCopyDocuments = new Set(["certification of grades", "certificate of registration"]);
const requirementFiles = new Map();
const confirmedRequirementRows = new Set();
const maxRequirementFileSizeBytes = 3 * 1024 * 1024;

document.querySelectorAll(".doc-item").forEach(item => {
  const name = item.querySelector(".doc-card h3").innerText.trim().toLowerCase();
  if (softCopyDocuments.has(name)) return;

  item.querySelectorAll(".doc-card-meta .meta-check").forEach(method => {
    if (method.innerText.replace("check_circle", "").trim().toLowerCase() === "softcopy") {
      method.remove();
    }
  });
});

const catalogItems = [...document.querySelectorAll(".doc-grid .doc-item")];
const gradesDocument = catalogItems.find(item =>
  item.querySelector(".doc-card h3").innerText.trim().toLowerCase() === "certification of grades"
);
const registrationDocument = catalogItems.find(item =>
  item.querySelector(".doc-card h3").innerText.trim().toLowerCase() === "certificate of registration"
);
if (gradesDocument && registrationDocument) gradesDocument.after(registrationDocument);

const catalogDocuments = [...document.querySelectorAll(".doc-item")].map((item, index) => {
  const metadata = [...item.querySelectorAll(".doc-card-meta p")]
    .map(paragraph => paragraph.innerText.replace("check_circle", "").trim());
  const requirements = [];
  const releaseMethods = [];
  let section = "";

  metadata.forEach(line => {
    if (line === "Requirements:") {
      section = "requirements";
      return;
    }
    if (line === "Available Released Method:") {
      section = "methods";
      return;
    }
    if (line.startsWith("Processing Days:")) {
      section = "";
      return;
    }
    if (line.endsWith(":")) {
      section = "";
      return;
    }
    if (section === "requirements" && line) requirements.push(line);
    if (section === "methods" && line) releaseMethods.push(line);
  });

  const name = item.querySelector(".doc-card h3").innerText.trim();
  const priceText = item.querySelector(".doc-price").innerText;
  return {
    id: `document-${index}`,
    name,
    price: Number(priceText.replace(/[^\d.]/g, "")),
    processing: metadata.find(line => line.startsWith("Processing Days:"))?.replace("Processing Days:", "").trim() || "Same day",
    requirements,
    releaseMethods: releaseMethods
      .map(method => method.toLowerCase().includes("hardcopy") ? "Hardcopy" : "Softcopy")
      .filter(method => method !== "Softcopy" || softCopyDocuments.has(name.toLowerCase()))
  };
});

let activeStep = 1;
let latestSubmission = null;
let requestNotificationTimeout;
let trackingQrExpiryTimeout;

function currentAccountKey() {
  return localStorage.getItem("colmPortalUser")
    || sessionStorage.getItem("colmPortalUser")
    || "guest";
}

function requestsStorageKey() {
  return "colmDocumentRequests";
}

function currentPortalRole() {
  return document.getElementById("studentRole")?.textContent || "Student";
}

function loadAllRequests() {
  try {
    return JSON.parse(localStorage.getItem(requestsStorageKey()) || "[]");
  } catch {
    return [];
  }
}

function saveRequests(requests) {
  localStorage.setItem(requestsStorageKey(), JSON.stringify(requests));
}

function loadRequests() {
  const requests = loadAllRequests();
  return currentPortalRole() === "Student"
    ? requests.filter(request => request.studentUsername === currentAccountKey())
    : requests;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function dateReleaseForProcessing(processing) {
  const range = processing.match(/(\d+)\s*-\s*(\d+)/);
  const days = range ? [Number(range[1]), Number(range[2])] : [0, 0];
  const dates = days.map(dayCount => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + dayCount);
    return date;
  });
  return {
    start: dates[0],
    end: dates[1],
    label: days[0] === days[1]
      ? formatDate(dates[0])
      : `${formatDate(dates[0])} – ${formatDate(dates[1])}`
  };
}

function selectedDocuments() {
  return [...requestDocumentRows.querySelectorAll(".request-document-row")].flatMap(row => {
    const document = catalogDocuments.find(item => item.id === row.querySelector(".request-document-select").value);
    const quantity = Number(row.querySelector(".request-quantity").value);
    return document && Number.isInteger(quantity) && quantity > 0 && quantity <= maxCopiesPerDocument
      ? [{ ...document, requestRowId: row.dataset.requestRowId, quantity, lineTotal: document.price * quantity, dateRelease: dateReleaseForProcessing(document.processing) }]
      : [];
  });
}

function requirementFileKey(item, requirementIndex) {
  return `${item.requestRowId}:${requirementIndex}`;
}

function hasExcessCopies() {
  return [...requestDocumentRows.querySelectorAll(".request-quantity")]
    .some(input => Number(input.value) > maxCopiesPerDocument);
}

function purposeValidationError(value) {
  const purpose = value.trim();
  if (purpose.length < 3) return "Please enter a purpose with at least 3 characters.";

  const letters = purpose.match(/[a-z]/gi) || [];
  const vowels = purpose.match(/[aeiou]/gi) || [];
  if (!letters.length || /(.)\1{4,}/i.test(purpose)) {
    return "Please enter a meaningful purpose, not random characters.";
  }
  if (letters.length >= 8 && vowels.length / letters.length < 0.16) {
    return "Please enter a meaningful purpose, not random characters.";
  }
  return "";
}

function duplicateDocumentSelect() {
  const selectedIds = new Set();
  for (const select of requestDocumentRows.querySelectorAll(".request-document-select")) {
    if (!select.value) continue;
    if (selectedIds.has(select.value)) return select;
    selectedIds.add(select.value);
  }
  return null;
}

function syncDocumentOptions() {
  const selectedIds = new Set([...requestDocumentRows.querySelectorAll(".request-document-select")]
    .map(select => select.value)
    .filter(Boolean));

  requestDocumentRows.querySelectorAll(".request-document-select").forEach(select => {
    [...select.options].forEach(option => {
      option.disabled = Boolean(option.value)
        && option.value !== select.value
        && selectedIds.has(option.value);
    });
  });
}

function requestTotal(items = selectedDocuments()) {
  return items.reduce((sum, item) => sum + item.lineTotal, 0);
}

function makeDocumentRow(documentId = "") {
  const row = document.createElement("div");
  const selectId = `request-document-${crypto.randomUUID()}`;
  row.className = "request-document-row";
  row.dataset.requestRowId = crypto.randomUUID();
  row.innerHTML = `
    <div class="request-field request-document-field">
      <label for="${selectId}">Requested document</label>
      <select class="request-document-select" id="${selectId}" required>
        <option value="">-- Choose a document --</option>
        ${catalogDocuments.map(item => `<option value="${item.id}">${item.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</option>`).join("")}
      </select>
    </div>
    <div class="request-field request-quantity-field">
      <label for="${selectId}-quantity">Number of copies</label>
      <input class="request-quantity" id="${selectId}-quantity" type="number" min="1" max="${maxCopiesPerDocument}" step="1" value="1" required>
    </div>
    <div class="request-row-meta">
      <div><span>Unit price</span><strong class="request-unit-price">—</strong></div>
      <div><span>Date Release</span><strong class="request-row-release">Choose a document</strong></div>
      <div><span>Fee assessment</span><strong class="request-line-total">—</strong></div>
    </div>
    <button class="request-remove-btn" type="button" aria-label="Remove document"><span class="material-symbol">delete</span></button>
  `;
  row.querySelector(".request-document-select").value = documentId;
  return row;
}

function addDocumentRow(documentId = "") {
  requestDocumentRows.append(makeDocumentRow(documentId));
  updateRequestSummary();
}

function syncReleaseMethods(items = selectedDocuments()) {
  const commonMethods = items.length
    ? items[0].releaseMethods.filter(method => items.every(item => item.releaseMethods.includes(method)))
    : [];
  const currentMethod = requestReleaseMethod.value;
  requestReleaseMethod.innerHTML = commonMethods.length
    ? commonMethods.map(method => `<option value="${method}">${method}</option>`).join("")
    : '<option value="">Choose a document first</option>';
  requestReleaseMethod.disabled = commonMethods.length === 0;
  if (commonMethods.includes(currentMethod)) {
    requestReleaseMethod.value = currentMethod;
  } else {
    requestReleaseMethod.value = commonMethods[0] || "";
  }
  requestReleaseMethod.parentElement.hidden = commonMethods.length === 1;
}

function dateReleaseLabel(items = selectedDocuments()) {
  if (!items.length) return "Choose a document first";
  const earliest = new Date(Math.min(...items.map(item => item.dateRelease.start.getTime())));
  const latest = new Date(Math.max(...items.map(item => item.dateRelease.end.getTime())));
  return earliest.getTime() === latest.getTime()
    ? formatDate(earliest)
    : `${formatDate(earliest)} – ${formatDate(latest)}`;
}

function updateRequestSummary() {
  syncDocumentOptions();
  const items = selectedDocuments();
  requestDocumentRows.querySelectorAll(".request-document-row").forEach(row => {
    const item = catalogDocuments.find(document => document.id === row.querySelector(".request-document-select").value);
    const quantity = Number(row.querySelector(".request-quantity").value) || 0;
    row.querySelector(".request-unit-price").textContent = item ? formatMoney(item.price) : "—";
    row.querySelector(".request-row-release").textContent = item ? dateReleaseForProcessing(item.processing).label : "—";
    row.querySelector(".request-line-total").textContent = item && quantity > 0 ? formatMoney(item.price * quantity) : "—";
    row.querySelector(".request-remove-btn").disabled = false;
  });
  document.getElementById("requestTotal").textContent = formatMoney(requestTotal(items));
  syncReleaseMethods(items);
  dateReleaseDisplay.textContent = dateReleaseLabel(items);
  renderRequirements(items);
}

function renderRequirements(items) {
  const groups = items.map(item => `
    <section class="request-requirement-group">
      <h4>${item.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</h4>
      <ul>${item.requirements.map((requirement, requirementIndex) => {
        const key = requirementFileKey(item, requirementIndex);
        const inputId = `requirement-file-${item.requestRowId}-${requirementIndex}`;
        const file = requirementFiles.get(key);
        return `<li class="request-requirement-item">
          <div class="request-requirement-heading">
            <strong>${escapeHtml(requirement)}</strong>
            <span class="request-required-badge">Required</span>
          </div>
          <p class="request-requirement-description">Upload a file that satisfies this requirement.</p>
          <input class="request-required-file" id="${inputId}" type="file" data-requirement-key="${escapeHtml(key)}" accept=".pdf,.jpg,.jpeg,.png" ${file ? 'data-file-selected=""' : ""} required aria-label="Upload ${escapeHtml(requirement)} for ${escapeHtml(item.name)}">
          <label class="request-requirement-dropzone${file ? " has-file" : ""}" for="${inputId}" data-input-id="${inputId}">
            <span class="material-symbol request-dropzone-icon" aria-hidden="true">cloud_upload</span>
            <strong>Click or drag file here to upload</strong>
            <span class="request-requirement-formats">Allowed formats: PDF, JPG, JPEG, PNG (Max 3 MB)</span>
            <span class="request-required-file-name">${file ? escapeHtml(file.name) : "No file selected"}</span>
          </label>
        </li>`;
      }).join("")}</ul>
      <label class="request-confirm-option"><input type="checkbox" class="request-requirement-confirm" data-request-row-id="${escapeHtml(item.requestRowId)}" ${confirmedRequirementRows.has(item.requestRowId) ? "checked" : ""}> I have reviewed these requirements.</label>
    </section>
  `).join("");
  requestRequirementsList.innerHTML = groups || '<p class="request-date-note">Choose documents in Step 1 to see their requirements.</p>';
  updateReviewRequestButton();
}

function showRequestStep(step) {
  activeStep = step;
  requestSteps.forEach(section => { section.hidden = Number(section.dataset.requestStep) !== step; });
  requestStepIndicators.forEach(indicator => {
    const number = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("active", number === step);
    indicator.classList.toggle("complete", number < step);
  });
  clearRequestNotification();
}

function clearRequestNotification() {
  window.clearTimeout(requestNotificationTimeout);
  requestFormMessage.setAttribute("role", "status");
  requestFormMessage.textContent = "";
}

function showRequestNotification(message) {
  requestFormMessage.setAttribute("role", "alert");
  requestFormMessage.textContent = message;
  window.clearTimeout(requestNotificationTimeout);
  requestNotificationTimeout = window.setTimeout(() => {
    requestFormMessage.textContent = "";
    requestFormMessage.setAttribute("role", "status");
    requestNotificationTimeout = null;
  }, 5000);
}
function startRequest(prefillDocument = "") {
  document.querySelector('.nav-item[data-page="My Requests"], .nav-item[data-page="All Requests"]')?.click();
  requestFormPanel.hidden = false;
  requestsHistoryCard.hidden = true;
  requestSuccess.hidden = true;
  documentRequestForm.hidden = false;
  documentRequestForm.reset();
  requestPurposeInput.placeholder = defaultPurposePlaceholder;
  requestPurposeInput.removeAttribute("aria-invalid");
  requirementFiles.clear();
  confirmedRequirementRows.clear();
  requestDocumentRows.replaceChildren();
  addDocumentRow(prefillDocument);
  requestPurposeInput.value = "";
  showRequestStep(1);
}

function closeRequestForm() {
  requestFormPanel.hidden = true;
  requestsHistoryCard.hidden = false;
  requestSuccess.hidden = true;
  documentRequestForm.hidden = false;
}

function requirementsAreConfirmed() {
  const confirmations = [...requestRequirementsList.querySelectorAll(".request-requirement-confirm")];
  return confirmations.length > 0 && confirmations.every(checkbox => checkbox.checked);
}

function requiredFilesAreUploaded() {
  return [...requestRequirementsList.querySelectorAll(".request-required-file")]
    .every(input => requirementFiles.has(input.dataset.requirementKey));
}

function updateReviewRequestButton() {
  const reviewButton = document.getElementById("reviewRequestBtn");
  if (reviewButton) reviewButton.disabled = false;
}

async function requirementFileValidationError(file) {
  if (!file.size) return "The selected file is empty.";
  if (file.size > maxRequirementFileSizeBytes) return "The selected file must be 3 MB or smaller.";

  const extension = file.name.split(".").pop().toLowerCase();
  const signatures = {
    pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
    jpg: [0xff, 0xd8, 0xff],
    jpeg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  };
  const expectedSignature = signatures[extension];
  if (!expectedSignature) return "Choose a PDF, JPG, JPEG, or PNG file.";

  const bytes = new Uint8Array(await file.slice(0, expectedSignature.length).arrayBuffer());
  return expectedSignature.every((byte, index) => bytes[index] === byte)
    ? ""
    : "The file content does not match its extension.";
}

function fillReview(items) {
  const purpose = document.getElementById("requestPurpose").value.trim();
  const requiredFiles = items.flatMap(item => item.requirements.map((requirement, requirementIndex) => {
    const file = requirementFiles.get(requirementFileKey(item, requirementIndex));
    return file ? `${item.name} - ${requirement}: ${file.name}` : null;
  }).filter(Boolean));
  const files = requiredFiles;
  document.getElementById("reviewPurpose").textContent = purpose;
  document.getElementById("reviewReleaseMethod").textContent = requestReleaseMethod.value;
  document.getElementById("reviewPaymentMethod").textContent = requestPaymentMethod.value;
  document.getElementById("reviewReleaseDate").textContent = dateReleaseLabel(items);
  document.getElementById("reviewAttachments").textContent = files.length ? files.join(", ") : "None";
  document.getElementById("requestReviewRows").innerHTML = items.map(item => `
    <tr>
      <td>${item.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</td>
      <td>${item.quantity}</td>
      <td>${formatMoney(item.price)}</td>
      <td>${formatMoney(item.lineTotal)}</td>
      <td>${item.dateRelease.label}</td>
    </tr>
  `).join("");
  document.getElementById("reviewTotal").textContent = formatMoney(requestTotal(items));
  return { purpose, paymentMethod: requestPaymentMethod.value, files };
}

function trackingNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return `COLM-${stamp}-${suffix}`;
}

function renderTrackingQrCode(request) {
  const qrContainer = document.getElementById("requestTrackingQrCode");
  const qrStatus = document.getElementById("requestQrStatus");
  const downloadButton = document.getElementById("downloadTrackingQr");
  const expiresAt = new Date(new Date(request.submittedAt).getTime() + trackingQrValidityMs);
  window.clearTimeout(trackingQrExpiryTimeout);
  qrContainer.replaceChildren();
  downloadButton.disabled = true;
  downloadButton.dataset.expiresAt = expiresAt.toISOString();

  if (Date.now() >= expiresAt.getTime()) {
    qrStatus.textContent = `This QR expired on ${formatDate(expiresAt)}.`;
    return;
  }

  if (typeof window.QRCode !== "function") {
    qrStatus.textContent = "QR generation is unavailable. Keep your tracking number above.";
    return;
  }

  const payload = [
    `Tracking Number: ${request.tracking}`,
    `QR Valid Until: ${expiresAt.toISOString()}`,
    "Documents: Name | Date Release | PHP per copy | Copies",
    ...request.items.map(item => `${item.name} | ${item.dateRelease.replace(/[–—]/g, "-")} | ${item.price} | ${item.quantity}`)
  ].join("\n");

  try {
    new window.QRCode(qrContainer, {
      text: payload,
      width: 220,
      height: 220,
      colorDark: "#123c2d",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
    downloadButton.disabled = false;
    qrStatus.textContent = `Valid until ${formatDate(expiresAt)}. Scan to read the request details.`;
    trackingQrExpiryTimeout = window.setTimeout(() => {
      downloadButton.disabled = true;
      qrStatus.textContent = `This QR expired on ${formatDate(expiresAt)}.`;
    }, expiresAt.getTime() - Date.now());
  } catch {
    qrContainer.textContent = "QR unavailable";
    qrStatus.textContent = "QR generation failed. Keep your tracking number above.";
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function requestActionMarkup(request, item, itemIndex) {
  const requestId = escapeHtml(request.tracking);
  const paymentStatus = request.paymentStatus || "Pending";
  const role = currentPortalRole();

  if (role === "Cashier" && paymentStatus !== "Paid") {
    return itemIndex === 0
      ? `<button class="request-table-action" type="button" data-request-action="mark-paid" data-request-id="${requestId}">Mark paid</button>`
      : "—";
  }

  if (role === "Registrar" && paymentStatus === "Paid" && !item.releaseDate) {
    if (request.releaseMethod === "Softcopy") {
      return `<input class="request-release-file" type="file" accept=".pdf,.jpg,.jpeg,.png" data-request-id="${requestId}" data-item-index="${itemIndex}" aria-label="Choose released document" hidden><button class="request-table-action" type="button" data-request-action="upload-release" data-request-id="${requestId}" data-item-index="${itemIndex}">Attach softcopy</button>`;
    }
    return `<button class="request-table-action" type="button" data-request-action="mark-released" data-request-id="${requestId}" data-item-index="${itemIndex}">Mark released</button>`;
  }

  if (role === "Student") {
    const canDownload = paymentStatus === "Paid"
      && request.releaseMethod === "Softcopy"
      && item.releaseDate
      && item.releasedFile?.dataUrl;
    return canDownload
      ? `<a class="request-table-action" href="${escapeHtml(item.releasedFile.dataUrl)}" download="${escapeHtml(item.releasedFile.name)}">Download</a>`
      : "—";
  }

  return "—";
}

function renderRequestHistory() {
  const requests = loadRequests();
  if (!requests.length) {
    requestsBody.innerHTML = '<tr><td colspan="8" class="requests-empty">No requests found.</td></tr>';
    return;
  }
  requestsBody.innerHTML = requests.flatMap(request => request.items.map((item, itemIndex) => `
    <tr>
      <td>${escapeHtml(request.tracking)}</td>
      <td>${escapeHtml(request.studentName || request.studentUsername || "Student")}</td>
      <td>${escapeHtml(item.name)} <span class="request-history-copies">× ${item.quantity}</span></td>
      <td>${formatMoney(item.lineTotal)}</td>
      <td>${item.releaseDate ? escapeHtml(formatDate(new Date(item.releaseDate))) : escapeHtml(item.dateRelease || "Pending review")}</td>
      <td>${escapeHtml(request.paymentStatus || "Pending")}</td>
      <td>${escapeHtml(request.paymentMethod || "Cash")}</td>
      <td>${escapeHtml(request.status)}</td>
      <td>—</td>
      <td>${requestActionMarkup(request, item, itemIndex)}</td>
    </tr>
  `)).join("");
}

function updateRequestRecord(tracking, update) {
  const requests = loadAllRequests();
  const request = requests.find(item => item.tracking === tracking);
  if (!request) return null;
  update(request);
  saveRequests(requests);
  renderRequestHistory();
  return request;
}

requestsBody.addEventListener("click", event => {
  const button = event.target.closest("[data-request-action]");
  if (!button) return;
  const tracking = button.dataset.requestId;
  const itemIndex = Number(button.dataset.itemIndex);

  if (button.dataset.requestAction === "mark-paid" && currentPortalRole() === "Cashier") {
    updateRequestRecord(tracking, request => {
      request.paymentStatus = "Paid";
      request.paidAt = new Date().toISOString();
      request.status = "Ready for release";
    });
    return;
  }

  if (button.dataset.requestAction === "mark-released" && currentPortalRole() === "Registrar") {
    updateRequestRecord(tracking, request => {
      request.items[itemIndex].releaseDate = new Date().toISOString();
      request.status = request.items.every(item => item.releaseDate) ? "Released" : "Partially released";
    });
    return;
  }

  if (button.dataset.requestAction === "upload-release" && currentPortalRole() === "Registrar") {
    button.parentElement.querySelector(".request-release-file")?.click();
  }
});

requestsBody.addEventListener("change", event => {
  const input = event.target.closest(".request-release-file");
  const file = input?.files?.[0];
  if (!input || !file) return;
  if (file.size > 2 * 1024 * 1024) {
    window.alert("Released files must be 2 MB or smaller in this local demo.");
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    updateRequestRecord(input.dataset.requestId, request => {
      const item = request.items[Number(input.dataset.itemIndex)];
      item.releaseDate = new Date().toISOString();
      item.releasedFile = { name: file.name, dataUrl: reader.result };
      request.status = request.items.every(document => document.releaseDate) ? "Released" : "Partially released";
    });
  });
  reader.readAsDataURL(file);
});

function moveToStep(nextStep) {
  const duplicateSelect = duplicateDocumentSelect();
  if (duplicateSelect) {
    showRequestStep(1);
    showRequestNotification("Each document can only be selected once. Choose a different document for each row.");
    duplicateSelect.focus();
    return;
  }
  if (hasExcessCopies()) {
    showRequestStep(1);
    showRequestNotification(`You can request a maximum of ${maxCopiesPerDocument} copies per document.`);
    return;
  }
  const items = selectedDocuments();
  if (!items.length || items.length !== requestDocumentRows.children.length) {
    showRequestStep(1);
    showRequestNotification("Choose a document and valid number of copies for every row.");
    return;
  }
  if (nextStep >= 2 && !requestReleaseMethod.value) {
    showRequestStep(1);
    showRequestNotification("The selected documents do not share a release method. Submit them in separate requests.");
    return;
  }
  if (nextStep >= 3) {
    const purposeError = purposeValidationError(requestPurposeInput.value);
    if (purposeError) {
      showRequestStep(2);
      requestPurposeInput.setAttribute("aria-invalid", "true");
      requestPurposeInput.focus();
      if (requestPurposeInput.value.trim()) {
        requestPurposeInput.placeholder = defaultPurposePlaceholder;
        showRequestNotification(purposeError);
      } else {
        requestPurposeInput.value = "";
        requestPurposeInput.placeholder = "Please enter a specific purpose";
      }
      return;
    }
    requestPurposeInput.removeAttribute("aria-invalid");
    requestPurposeInput.placeholder = defaultPurposePlaceholder;
  }
  if (nextStep >= 4 && !requiredFilesAreUploaded()) {
    showRequestStep(3);
    showRequestNotification("Attach a file for every listed requirement before continuing.");
    requestRequirementsList.querySelector(".request-required-file:not([data-file-selected])")?.focus();
    return;
  }
  if (nextStep >= 4 && !requirementsAreConfirmed()) {
    showRequestStep(3);
    showRequestNotification("Confirm that you have reviewed the listed requirements for every selected document.");
    return;
  }
  if (nextStep === 4) fillReview(items);
  showRequestStep(nextStep);
}

document.getElementById("addDocumentRow").addEventListener("click", () => addDocumentRow());
document.getElementById("startNewRequestBtn").addEventListener("click", () => startRequest());
document.getElementById("cancelRequestForm").addEventListener("click", closeRequestForm);
document.getElementById("viewMyRequests").addEventListener("click", closeRequestForm);
requestPurposeInput.addEventListener("input", event => {
  if (purposeValidationError(event.target.value)) return;
  event.target.removeAttribute("aria-invalid");
  event.target.placeholder = defaultPurposePlaceholder;
});
document.querySelectorAll('.nav-item[data-page="My Requests"], .nav-item[data-page="All Requests"], [data-page-action="My Requests"]').forEach(link => {
  link.addEventListener("click", renderRequestHistory);
});
document.getElementById("copyTrackingNumber").addEventListener("click", async () => {
  if (!latestSubmission) return;
  try {
    await navigator.clipboard.writeText(latestSubmission.tracking);
    document.getElementById("copyTrackingNumber").textContent = "Copied";
  } catch {
    document.getElementById("copyTrackingNumber").textContent = latestSubmission.tracking;
  }
});

document.getElementById("downloadTrackingQr").addEventListener("click", () => {
  const downloadButton = document.getElementById("downloadTrackingQr");
  const expiresAt = new Date(downloadButton.dataset.expiresAt);
  const qrStatus = document.getElementById("requestQrStatus");
  if (!latestSubmission || Date.now() >= expiresAt.getTime()) {
    downloadButton.disabled = true;
    qrStatus.textContent = `This QR expired on ${formatDate(expiresAt)}.`;
    return;
  }

  const canvas = document.querySelector("#requestTrackingQrCode canvas");
  if (!canvas) {
    qrStatus.textContent = "QR image is not ready to download.";
    return;
  }

  const link = document.createElement("a");
  link.download = `${latestSubmission.tracking}-QR.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

document.querySelectorAll("[data-next-step]").forEach(button => {
  button.addEventListener("click", () => moveToStep(Number(button.dataset.nextStep)));
});

document.querySelectorAll("[data-previous-step]").forEach(button => {
  button.addEventListener("click", () => showRequestStep(Number(button.dataset.previousStep)));
});

requestDocumentRows.addEventListener("change", event => {
  if (event.target.matches(".request-document-select, .request-quantity")) updateRequestSummary();
});

requestDocumentRows.addEventListener("input", event => {
  if (event.target.matches(".request-quantity")) updateRequestSummary();
});

requestDocumentRows.addEventListener("click", event => {
  const removeButton = event.target.closest(".request-remove-btn");
  if (!removeButton) return;
  const row = removeButton.closest(".request-document-row");
  if (requestDocumentRows.children.length === 1) {
    row.querySelector(".request-document-select").value = "";
    row.querySelector(".request-quantity").value = "1";
  } else {
    row.remove();
  }
  updateRequestSummary();
});

requestRequirementsList.addEventListener("change", async event => {
  const fileInput = event.target.closest(".request-required-file");
  if (fileInput) {
    const file = fileInput.files[0];
    const key = fileInput.dataset.requirementKey;
    if (!file) {
      requirementFiles.delete(key);
      fileInput.nextElementSibling.classList.remove("has-file");
      fileInput.nextElementSibling.querySelector(".request-required-file-name").textContent = "No file selected";
      updateReviewRequestButton();
      return;
    }
    fileInput.toggleAttribute("data-validating", true);
    updateReviewRequestButton();
    const validationError = await requirementFileValidationError(file);
    if (!fileInput.isConnected || fileInput.files[0] !== file) return;
    fileInput.removeAttribute("data-validating");
    if (validationError) {
      fileInput.value = "";
      showRequestNotification(validationError);
      updateReviewRequestButton();
      return;
    }
    requirementFiles.set(key, file);
    fileInput.toggleAttribute("data-file-selected", true);
    fileInput.nextElementSibling.classList.add("has-file");
    fileInput.nextElementSibling.querySelector(".request-required-file-name").textContent = file.name;
    clearRequestNotification();
    updateReviewRequestButton();
    return;
  }

  const confirmation = event.target.closest(".request-requirement-confirm");
  if (!confirmation) return;
  if (confirmation.checked) confirmedRequirementRows.add(confirmation.dataset.requestRowId);
  else confirmedRequirementRows.delete(confirmation.dataset.requestRowId);
});

requestRequirementsList.addEventListener("dragover", event => {
  const dropzone = event.target.closest(".request-requirement-dropzone");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.add("drag-active");
});

requestRequirementsList.addEventListener("dragleave", event => {
  const dropzone = event.target.closest(".request-requirement-dropzone");
  if (!dropzone || dropzone.contains(event.relatedTarget)) return;
  dropzone.classList.remove("drag-active");
});

requestRequirementsList.addEventListener("drop", event => {
  const dropzone = event.target.closest(".request-requirement-dropzone");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.remove("drag-active");
  const file = event.dataTransfer?.files?.[0];
  const fileInput = document.getElementById(dropzone.dataset.inputId);
  if (!file || !fileInput) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
});

document.querySelectorAll(".doc-request-btn").forEach(button => {
  button.addEventListener("click", () => {
    const name = button.closest(".doc-item").querySelector(".doc-card h3").innerText.trim();
    const document = catalogDocuments.find(item => item.name === name);
    startRequest(document?.id || "");
  });
});

documentRequestForm.addEventListener("submit", event => {
  event.preventDefault();
  if (activeStep !== 4) return;
  const purposeError = purposeValidationError(requestPurposeInput.value);
  if (purposeError) {
    showRequestStep(2);
    requestPurposeInput.setAttribute("aria-invalid", "true");
    requestPurposeInput.focus();
    if (requestPurposeInput.value.trim()) {
      requestPurposeInput.placeholder = defaultPurposePlaceholder;
      showRequestNotification(purposeError);
    } else {
      requestPurposeInput.value = "";
      requestPurposeInput.placeholder = "Please enter a specific purpose";
    }
    return;
  }
  const duplicateSelect = duplicateDocumentSelect();
  if (duplicateSelect) {
    showRequestStep(1);
    showRequestNotification("Each document can only be selected once. Choose a different document for each row.");
    duplicateSelect.focus();
    return;
  }
  if (!requiredFilesAreUploaded()) {
    showRequestStep(3);
    showRequestNotification("Attach a file for every listed requirement before continuing.");
    requestRequirementsList.querySelector(".request-required-file:not([data-file-selected])")?.focus();
    return;
  }
  if (!requirementsAreConfirmed()) {
    showRequestStep(3);
    showRequestNotification("Confirm that you have reviewed the listed requirements for every selected document.");
    return;
  }
  if (hasExcessCopies()) {
    showRequestStep(1);
    showRequestNotification(`You can request a maximum of ${maxCopiesPerDocument} copies per document.`);
    return;
  }
  const items = selectedDocuments();
  const { purpose, paymentMethod, files } = fillReview(items);
  const tracking = trackingNumber();
  const request = {
    tracking,
    submittedAt: new Date().toISOString(),
    studentUsername: currentAccountKey(),
    studentName: document.getElementById("profileName").textContent,
    studentId: document.getElementById("profileId").textContent,
    purpose,
    releaseMethod: requestReleaseMethod.value,
    paymentMethod,
    status: "Pending Payment",
    paymentStatus: "Pending",
    total: requestTotal(items),
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      dateRelease: item.dateRelease.label,
      releaseDate: null,
      releasedFile: null
    })),
    attachments: files
  };
  const savedRequests = loadRequests();
  savedRequests.unshift(request);
  saveRequests(savedRequests);
  renderRequestHistory();
  latestSubmission = request;
  document.getElementById("requestTrackingNumber").textContent = tracking;
  document.getElementById("successTotal").textContent = formatMoney(request.total);
  documentRequestForm.hidden = true;
  requestSuccess.hidden = false;
  showRequestStep(5);
  renderTrackingQrCode(request);
});

document.getElementById("requestAgainBtn")?.addEventListener("click", () => startRequest());

renderRequestHistory();
addDocumentRow();
showRequestStep(1);