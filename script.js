/* ADR Chart Checklist - Script */
(function () {
  'use strict';

  const { jsPDF } = window.jspdf;

  /* ================================================================
     Directory handle persistence (File System Access API)
     ================================================================ */
  let dirHandle = null;

  async function restoreDirectory() {
    if (!('showDirectoryPicker' in window)) return;
    try {
      const stored = localStorage.getItem('adr_dir_name');
      if (stored) {
        document.getElementById('dirDisplay').textContent = stored + '  (re-authorize below)';
      }
    } catch (_) { /* ignore */ }
  }

  async function chooseDirectory() {
    if (!('showDirectoryPicker' in window)) {
      alert('Your browser does not support the File System Access API.\nPDFs will download to your default Downloads folder.');
      return;
    }
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      localStorage.setItem('adr_dir_name', dirHandle.name);
      document.getElementById('dirDisplay').textContent = dirHandle.name;
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  }

  document.getElementById('chooseDirBtn').addEventListener('click', chooseDirectory);
  restoreDirectory();

  /* ================================================================
     Dynamic ADR Claim Date rows
     ================================================================ */
  const claimContainer = document.getElementById('claimDatesContainer');
  const addClaimBtn = document.getElementById('addClaimDate');

  addClaimBtn.addEventListener('click', function () {
    const entry = document.createElement('div');
    entry.className = 'date-entry';
    entry.innerHTML =
      '<input class="field-input claim-date" type="date" name="claimDate[]">' +
      '<button type="button" class="btn-remove" title="Remove">&times;</button>';
    claimContainer.appendChild(entry);

    entry.querySelector('.btn-remove').addEventListener('click', function () {
      entry.style.opacity = '0';
      entry.style.transform = 'translateX(-8px)';
      entry.style.transition = 'all 0.2s ease';
      setTimeout(() => entry.remove(), 200);
    });
  });

  /* ================================================================
     Reset
     ================================================================ */
  document.getElementById('resetBtn').addEventListener('click', function () {
    if (!confirm('Reset all fields?')) return;
    document.getElementById('adrForm').reset();
    // Remove extra date rows
    const entries = claimContainer.querySelectorAll('.date-entry');
    entries.forEach((e, i) => { if (i > 0) e.remove(); });
  });

  /* ================================================================
     Helpers: format date from input[type=date] to MM/DD/YY
     ================================================================ */
  function fmtDate(val) {
    if (!val) return '';
    const d = new Date(val + 'T00:00:00');
    if (isNaN(d)) return val;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return mm + '/' + dd + '/' + yy;
  }

  /* ================================================================
     Gather form data
     ================================================================ */
  function gatherData() {
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const chk = (id) => document.getElementById(id)?.checked || false;

    // Claim dates (array of individual dates)
    const dateInputs = document.querySelectorAll('.claim-date');
    const claimDates = [];
    dateInputs.forEach(input => {
      if (input.value) {
        claimDates.push(fmtDate(input.value));
      }
    });

    return {
      patientName:        val('patientName'),
      socDate:            fmtDate(val('socDate')),
      activeOrDischarged: val('activeOrDischarged'),
      claimDates:         claimDates,
      certPeriodStart:    fmtDate(val('certPeriodStart')),
      certPeriodEnd:      fmtDate(val('certPeriodEnd')),
      // Checked fields
      f2fReferral:       { value: val('f2fReferral'),       checked: chk('chk_f2fReferral') },
      orders485:         { value: val('orders485'),         checked: chk('chk_orders485') },
      snOasisSoc:        { value: val('snOasisSoc'),        checked: chk('chk_snOasisSoc') },
      snOasisRoc:        { value: val('snOasisRoc'),        checked: chk('chk_snOasisSoc') },
      revisits:          val('revisits'),
      recerts:           { value: val('recerts'),           checked: chk('chk_recerts') },
      tfr6:              val('tfr6'),
      dcOasis:           val('dcOasis'),
      // PT
      ptChecked:         chk('chk_pt'),
      ptIE:              val('ptIE'),
      ptNA:              chk('ptNA'),
      ptRVNotes:         val('ptRVNotes'),
      ptDC:              val('ptDC'),
      ptSummary:         val('ptSummary'),
      // OT
      otChecked:         chk('chk_ot'),
      otIE:              val('otIE'),
      otRVNotes:         val('otRVNotes'),
      otDC:              val('otDC'),
      otSummary:         val('otSummary'),
      // ST
      stChecked:         chk('chk_st'),
      stIE:              val('stIE'),
      stRVNotes:         val('stRVNotes'),
      stDC:              val('stDC'),
      stSummary:         val('stSummary'),
      // No-check fields
      hhaPoc:            val('hhaPoc'),
      electronicSig:     val('electronicSig'),
      docusigned:        val('docusigned'),
      abn:               val('abn'),
      // Checked fields
      adrLetter:         { value: val('adrLetter'),         checked: chk('chk_adrLetter') },
      ub:                { value: val('ub'),                checked: chk('chk_ub') },
      oasisTransmittals: { value: val('oasisTransmittals'), checked: chk('chk_oasisTransmittals') },
      physicianSigLog:   { value: val('physicianSigLog'),   checked: chk('chk_physicianSigLog') },
      coverLetter:       { value: val('coverLetter'),       checked: chk('chk_coverLetter') },
      coordNotes:        { value: val('coordNotes'),        checked: chk('chk_coordNotes') },
      // Tracking
      spreadsheet:       chk('chk_spreadsheet'),
      checklist:         chk('chk_checklist'),
      folder:            chk('chk_folder'),
      email:             chk('chk_email'),
    };
  }

  /* ================================================================
     Build filename: PATIENTNAME_ADR_MMDDYYYY.pdf
     ================================================================ */
  function buildFilename(data) {
    const name = data.patientName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'UNKNOWN';
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    return name.toUpperCase() + '_ADR_' + mm + dd + yyyy + '.pdf';
  }

  /* ================================================================
     PDF helpers
     ================================================================ */
  function drawCheck(doc, x, y, checked) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.rect(x, y, 3.5, 3.5);
    if (checked) {
      doc.setLineWidth(0.6);
      doc.line(x + 0.6, y + 1.8, x + 1.4, y + 2.8);
      doc.line(x + 1.4, y + 2.8, x + 3, y + 0.7);
    }
  }

  /* ================================================================
     Generate PDF
     ================================================================ */
  function generatePDF(data) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pw = 215.9;
    const leftM = 16;
    let y = 18;
    const lineH = 7;

    // ---- helpers ----
    function pageCheck(need) {
      if (y + (need || 0) > 270) { doc.addPage(); y = 18; }
    }

    // Row with checkbox
    function rowChk(label, value, checked) {
      pageCheck(lineH);
      drawCheck(doc, leftM, y - 2.5, checked);
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', leftM + 5.5, y);
      const lw = doc.getTextWidth(label + ':  ');
      doc.setFont('helvetica', 'normal');
      doc.text(value || '', leftM + 5.5 + lw, y);
      y += lineH;
    }

    // Row without checkbox (plain label: value)
    function rowPlain(label, value) {
      pageCheck(lineH);
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', leftM, y);
      const lw = doc.getTextWidth(label + ':  ');
      doc.setFont('helvetica', 'normal');
      doc.text(value || '', leftM + lw, y);
      y += lineH;
    }

    // Section divider
    function divider() {
      pageCheck(8);
      y += 2;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(leftM, y, pw - leftM, y);
      y += 5;
    }

    // ---- Title ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ADR CHART CHECKLIST', pw / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);

    // ---- Patient Info (no checkboxes) ----
    rowPlain('Patient Name', data.patientName);
    rowPlain('SOC Date', data.socDate + (data.activeOrDischarged ? '    |    ' + data.activeOrDischarged : ''));

    // Claim dates
    rowPlain('ADR Claim Dates', data.claimDates.join(', '));

    // Cert period
    const certStr = (data.certPeriodStart || data.certPeriodEnd)
      ? (data.certPeriodStart + ' - ' + data.certPeriodEnd)
      : '';
    rowPlain('Cert Period', certStr);

    divider();

    // ---- Orders & Documents ----
    rowChk('F2F Referral Documents', data.f2fReferral.value, data.f2fReferral.checked);
    rowChk('485/Supplemental Orders', data.orders485.value, data.orders485.checked);

    // Notes
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const notes = [
      '* If orders are signed manually > Physician Signature Attestation needed',
      '* If orders are not dated: HCHB "Process Order" print screen needed',
      '* If orders are signed via HCHB Portal > HCHB "Process Order" print screen needed'
    ];
    notes.forEach(n => {
      pageCheck(5);
      doc.text(n, leftM + 5.5, y);
      y += 4.5;
    });
    doc.setFontSize(10);
    y += 1;

    divider();

    // ---- SN / OASIS ----
    pageCheck(lineH);
    drawCheck(doc, leftM, y - 2.5, data.snOasisSoc.checked);
    doc.setFont('helvetica', 'bold');
    doc.text('SN/OASIS: SOC:', leftM + 5.5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.snOasisSoc.value || '', leftM + 40, y);
    doc.setFont('helvetica', 'bold');
    doc.text('ROC:', leftM + 80, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.snOasisRoc.value || '', leftM + 92, y);
    y += lineH;

    rowPlain('Revisits', data.revisits);
    rowChk('Recerts', data.recerts.value, data.recerts.checked);
    rowPlain('TFR #6', data.tfr6);
    rowPlain('DC OASIS', data.dcOasis);

    divider();

    // ---- Therapy ----
    function therapyRow(prefix, ie, na, rvNotes, dc, summary, checked) {
      pageCheck(lineH);
      drawCheck(doc, leftM, y - 2.5, checked);
      doc.setFont('helvetica', 'bold');
      doc.text(prefix + ':', leftM + 5.5, y);
      doc.setFont('helvetica', 'normal');
      let x = leftM + 14;
      doc.text('I/E: ' + (ie || ''), x, y);
      x += 25;
      if (na) { doc.text('N/A', x, y); }
      x += 12;
      doc.text('R/V Notes: ' + (rvNotes || ''), x, y);
      x += 55;
      doc.text('DC: ' + (dc || ''), x, y);
      x += 25;
      doc.text('Summary: ' + (summary || ''), x, y);
      y += lineH;
    }

    therapyRow('PT', data.ptIE, data.ptNA ? 'N/A' : '', data.ptRVNotes, data.ptDC, data.ptSummary, data.ptChecked);
    therapyRow('OT', data.otIE, '', data.otRVNotes, data.otDC, data.otSummary, data.otChecked);
    therapyRow('ST', data.stIE, '', data.stRVNotes, data.stDC, data.stSummary, data.stChecked);

    rowPlain('HHA POC and Duty Sheets', data.hhaPoc);

    divider();

    // ---- Additional Documents ----
    rowChk('ADR Letter', data.adrLetter.value, data.adrLetter.checked);
    rowChk('UB', data.ub.value, data.ub.checked);
    rowChk('OASIS Transmittals', data.oasisTransmittals.value, data.oasisTransmittals.checked);
    rowPlain('Electronic Signature P&P', data.electronicSig);
    rowPlain('DocuSigned/Bold Sign Certificates', data.docusigned);
    rowPlain('ABN', data.abn);
    rowChk('Physician Signature Log', data.physicianSigLog.value, data.physicianSigLog.checked);
    rowChk('Cover Letter', data.coverLetter.value, data.coverLetter.checked);
    rowChk('Coordination Notes/Missed Visit Notes', data.coordNotes.value, data.coordNotes.checked);

    // ---- Tracking ----
    y += 4;
    pageCheck(lineH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const trackItems = [
      { label: 'Spreadsheet', checked: data.spreadsheet },
      { label: 'Checklist',   checked: data.checklist },
      { label: 'Folder',      checked: data.folder },
      { label: 'Email',       checked: data.email },
    ];
    let tx = leftM;
    trackItems.forEach(item => {
      drawCheck(doc, tx, y - 2.5, item.checked);
      doc.text(item.label, tx + 5, y);
      tx += 38;
    });

    return doc;
  }

  /* ================================================================
     Save handler
     ================================================================ */
  document.getElementById('saveBtn').addEventListener('click', async function () {
    const data = gatherData();
    const filename = buildFilename(data);
    const doc = generatePDF(data);

    if (dirHandle) {
      try {
        const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          const pdfBlob = doc.output('blob');
          await writable.write(pdfBlob);
          await writable.close();
          showToast('Saved to ' + dirHandle.name + '/' + filename);
          return;
        }
      } catch (e) {
        console.warn('Directory save failed, falling back to download.', e);
      }
    }

    doc.save(filename);
    showToast('Downloaded ' + filename);
  });

  /* ================================================================
     Toast
     ================================================================ */
  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '28px',
        left: '50%',
        transform: 'translateX(-50%) translateY(10px)',
        background: '#1a1a1a',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '500',
        zIndex: '9999',
        opacity: '0',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'none',
        border: '1px solid rgba(183, 28, 80, 0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 0 12px rgba(183, 28, 80, 0.1)',
      });
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 3000);
  }

  /* ================================================================
     Arrow-key navigation between inputs
     ================================================================ */
  (function () {
    function getFocusableFields() {
      return Array.from(
        document.querySelectorAll(
          '#adrForm input:not([type="checkbox"]):not([type="hidden"]), #adrForm select'
        )
      ).filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

      var active = document.activeElement;
      if (!active || !active.closest('#adrForm')) return;
      if (active.tagName !== 'INPUT' && active.tagName !== 'SELECT') return;
      if (active.type === 'checkbox') return;

      var fields = getFocusableFields();
      var idx = fields.indexOf(active);
      if (idx === -1) return;

      e.preventDefault();

      if (e.key === 'ArrowDown') {
        var next = fields[idx + 1];
        if (next) next.focus();
      } else {
        var prev = fields[idx - 1];
        if (prev) prev.focus();
      }
    });
  })();

})();
