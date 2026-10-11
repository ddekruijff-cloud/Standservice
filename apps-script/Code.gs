/**
 * Standservice in Google Apps Script.
 * Database: een Google Sheet met de tabbladen "Opdrachten" en "Tijdlijn". Dat is de Sheet waar dit script aan
 * vastzit, of anders een Sheet die setup() zelf aanmaakt (het ID komt dan in eigenschap SHEET_ID).
 * Inlogcodes staan in de Script-eigenschappen (Projectinstellingen), niet in deze code:
 *   CODE_KLANT, CODE_TEAM, CODE_ADMIN   – de drie inlogcodes, elk anders (controleer met checkSetup)
 *   NTFY_TOPIC                           – optioneel: ntfy.sh-onderwerp voor een telefoonmelding bij een nieuwe opdracht
 */

const ROLES = {
  klant: { name: 'Klant', prop: 'CODE_KLANT' },
  team: { name: 'Serviceteam', prop: 'CODE_TEAM' },
  admin: { name: 'Beheerder', prop: 'CODE_ADMIN' },
};
const STATUSES = ['Nieuw', 'In behandeling', 'Afgerond', 'Geannuleerd'];
const ORDER_HEADERS = ['id', 'stands', 'omschrijving', 'status', 'aangemaakt', 'gewijzigd'];
const EVENT_HEADERS = ['id', 'opdracht', 'wie', 'soort', 'tekst', 'tijdstip'];
const SESSION_SECONDS = 6 * 60 * 60;
const MAX_FAILED_LOGINS = 10;

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Standservice')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Maakt de tabbladen aan als ze nog niet bestaan. Voer dit één keer uit vanuit de editor. */
function setup() {
  sheet_('Opdrachten', ORDER_HEADERS);
  sheet_('Tijdlijn', EVENT_HEADERS);
  console.log('Klaar. Gegevens staan in: ' + spreadsheet_().getUrl());
}

// ---------- Inloggen ----------

function login(code) {
  const cache = CacheService.getScriptCache();
  const failed = Number(cache.get('failed') || 0);
  if (failed >= MAX_FAILED_LOGINS) {
    throw new Error('Te veel mislukte pogingen. Probeer het over tien minuten opnieuw.');
  }
  const codes = codes_();
  if (!Object.keys(codes).length) {
    throw new Error('Er zijn nog geen inlogcodes ingesteld. Zet CODE_KLANT, CODE_TEAM en CODE_ADMIN in de Script-eigenschappen.');
  }
  const role = Object.keys(codes).find(function (r) { return String(code).trim() === codes[r]; });
  if (!role) {
    cache.put('failed', String(failed + 1), 600);
    throw new Error('Deze code is niet bekend. Controleer de code en probeer het opnieuw.');
  }
  const token = Utilities.getUuid();
  cache.put('s:' + token, role, SESSION_SECONDS);
  return { token: token, role: role, name: ROLES[role].name };
}

// Leest de codes uit de Script-eigenschappen. Spaties en hoofd/kleine letters in de naam maken niet uit.
function codes_() {
  const all = PropertiesService.getScriptProperties().getProperties();
  const byName = {};
  Object.keys(all).forEach(function (k) { byName[k.trim().toUpperCase()] = String(all[k]).trim(); });
  const codes = {};
  Object.keys(ROLES).forEach(function (r) {
    const value = byName[ROLES[r].prop];
    if (value) codes[r] = value;
  });
  return codes;
}

/** Controle vanuit de editor: kies checkSetup en klik op Uitvoeren, en kijk in het uitvoeringslogboek. */
function checkSetup() {
  const codes = codes_();
  Object.keys(ROLES).forEach(function (r) {
    console.log(ROLES[r].prop + ': ' + (codes[r] ? 'ingesteld (' + codes[r].length + ' tekens)' : 'ONTBREEKT'));
  });
  const values = Object.keys(codes).map(function (r) { return codes[r]; });
  if (new Set(values).size !== values.length) console.log('Let op: twee accounts hebben dezelfde code.');
  CacheService.getScriptCache().remove('failed');
  console.log('Teller voor mislukte inlogpogingen is op nul gezet.');
}

function logout(token) {
  CacheService.getScriptCache().remove('s:' + token);
}

function role_(token) {
  const role = token && CacheService.getScriptCache().get('s:' + token);
  if (!role) throw new Error('SESSIE_VERLOPEN');
  return role;
}

const isStaff_ = function (role) { return role === 'team' || role === 'admin'; };

// ---------- Lezen ----------

function listOrders(token) {
  role_(token);
  return rows_('Opdrachten', ORDER_HEADERS)
    .map(toOrder_)
    .sort(function (a, b) { return b.gewijzigd - a.gewijzigd; });
}

function getOrder(token, id) {
  role_(token);
  const order = rows_('Opdrachten', ORDER_HEADERS).map(toOrder_).find(function (o) { return o.id === Number(id); });
  if (!order) throw new Error('Deze opdracht bestaat niet meer.');
  order.tijdlijn = rows_('Tijdlijn', EVENT_HEADERS)
    .filter(function (e) { return Number(e.opdracht) === order.id; })
    .map(function (e) {
      return { id: Number(e.id), wie: e.wie, soort: e.soort, tekst: e.tekst, tijdstip: new Date(e.tijdstip).getTime() };
    })
    .sort(function (a, b) { return b.tijdstip - a.tijdstip || b.id - a.id; });
  return order;
}

// ---------- Schrijven ----------

function createOrder(token, stands, omschrijving) {
  const role = role_(token);
  const clean = cleanOrder_(stands, omschrijving);
  return withLock_(function () {
    const sheet = sheet_('Opdrachten', ORDER_HEADERS);
    const id = nextId_(sheet, 1000);
    const now = new Date();
    sheet.appendRow([id, text_(clean.stands.join(', ')), text_(clean.omschrijving), 'Nieuw', now, now]);
    addEvent_(id, ROLES[role].name, 'created', 'Opdracht ingediend');
    notifyTeam_('Nieuwe opdracht #' + id + ' voor stand ' + clean.stands.join(', '), clean.omschrijving);
    return id;
  });
}

function updateOrder(token, id, stands, omschrijving) {
  const role = role_(token);
  const clean = cleanOrder_(stands, omschrijving);
  return withLock_(function () {
    const found = findOrderRow_(id);
    if (role === 'klant' && found.values[3] !== 'Nieuw') {
      throw new Error('Een opdracht kan alleen gewijzigd worden zolang de status Nieuw is.');
    }
    found.sheet.getRange(found.row, 2, 1, 2).setValues([[text_(clean.stands.join(', ')), text_(clean.omschrijving)]]);
    found.sheet.getRange(found.row, 6).setValue(new Date());
    addEvent_(Number(id), ROLES[role].name, 'edit', 'Opdracht gewijzigd');
  });
}

function setStatus(token, id, status) {
  const role = role_(token);
  if (!isStaff_(role)) throw new Error('Alleen het serviceteam kan de status aanpassen.');
  if (STATUSES.indexOf(status) < 0) throw new Error('Onbekende status.');
  return withLock_(function () {
    const found = findOrderRow_(id);
    if (found.values[3] === status) return;
    found.sheet.getRange(found.row, 4).setValue(status);
    found.sheet.getRange(found.row, 6).setValue(new Date());
    addEvent_(Number(id), ROLES[role].name, 'status', 'Status gewijzigd naar ' + status);
  });
}

function addRemark(token, id, tekst) {
  const role = role_(token);
  tekst = String(tekst || '').trim();
  if (!tekst) throw new Error('Typ eerst een opmerking.');
  return withLock_(function () {
    const found = findOrderRow_(id);
    found.sheet.getRange(found.row, 6).setValue(new Date());
    addEvent_(Number(id), ROLES[role].name, 'remark', tekst);
  });
}

function deleteRemark(token, eventId) {
  if (role_(token) !== 'admin') throw new Error('Alleen de beheerder kan opmerkingen verwijderen.');
  return withLock_(function () {
    const sheet = sheet_('Tijdlijn', EVENT_HEADERS);
    const values = sheet.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (Number(values[i][0]) === Number(eventId) && values[i][3] === 'remark') sheet.deleteRow(i + 1);
    }
  });
}

function deleteOrder(token, id) {
  if (role_(token) !== 'admin') throw new Error('Alleen de beheerder kan opdrachten verwijderen.');
  return withLock_(function () {
    const found = findOrderRow_(id);
    found.sheet.deleteRow(found.row);
    const events = sheet_('Tijdlijn', EVENT_HEADERS);
    const values = events.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (Number(values[i][1]) === Number(id)) events.deleteRow(i + 1);
    }
  });
}

// ---------- Hulpfuncties ----------

function cleanOrder_(stands, omschrijving) {
  const list = String(stands || '')
    .split(/[,\n]/)
    .map(function (s) { return s.trim().toUpperCase(); })
    .filter(function (s, i, all) { return s && all.indexOf(s) === i; });
  omschrijving = String(omschrijving || '').trim();
  if (!list.length || !omschrijving) throw new Error('Vul minstens één standnummer en een omschrijving in.');
  return { stands: list, omschrijving: omschrijving };
}

function toOrder_(r) {
  return {
    id: Number(r.id),
    stands: String(r.stands).split(',').map(function (s) { return s.trim(); }).filter(String),
    omschrijving: r.omschrijving,
    status: r.status,
    aangemaakt: new Date(r.aangemaakt).getTime(),
    gewijzigd: new Date(r.gewijzigd).getTime(),
  };
}

function addEvent_(orderId, wie, soort, tekst) {
  const sheet = sheet_('Tijdlijn', EVENT_HEADERS);
  sheet.appendRow([nextId_(sheet, 1), orderId, wie, soort, text_(tekst), new Date()]);
}

function findOrderRow_(id) {
  const sheet = sheet_('Opdrachten', ORDER_HEADERS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (Number(values[i][0]) === Number(id)) return { sheet: sheet, row: i + 1, values: values[i] };
  }
  throw new Error('Deze opdracht bestaat niet meer.');
}

function nextId_(sheet, start) {
  const last = sheet.getLastRow();
  if (last < 2) return start;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return Number(r[0]) || 0; });
  return Math.max(start - 1, Math.max.apply(null, ids)) + 1;
}

function rows_(name, headers) {
  const values = sheet_(name, headers).getDataRange().getValues();
  return values.slice(1).filter(function (r) { return r[0] !== ''; }).map(function (r) {
    const o = {};
    headers.forEach(function (h, i) { o[h] = r[i]; });
    return o;
  });
}

// De Sheet met de gegevens: de Sheet waar het script aan vastzit, of anders de Sheet uit eigenschap SHEET_ID.
// Bestaat die nog niet, dan maakt het script zelf een Sheet "Standservice gegevens" aan in je Drive.
function spreadsheet_() {
  const active = SpreadsheetApp.getActive();
  if (active) return active;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id.trim());
  const created = SpreadsheetApp.create('Standservice gegevens');
  props.setProperty('SHEET_ID', created.getId());
  console.log('Nieuwe Sheet aangemaakt: ' + created.getUrl());
  return created;
}

function sheet_(name, headers) {
  const ss = spreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function notifyTeam_(title, message) {
  const topic = PropertiesService.getScriptProperties().getProperty('NTFY_TOPIC');
  if (!topic) return;
  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
      method: 'post',
      payload: message,
      headers: { Title: title },
      muteHttpExceptions: true,
    });
  } catch (e) {
    console.warn('Telefoonmelding niet verstuurd: ' + e);
  }
}

// Zorgt dat Sheets tekst als tekst bewaart: geen formules (=, +, -, @) en geen standnummers die een getal worden.
function text_(value) {
  return "'" + String(value);
}
