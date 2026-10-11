/**
 * Standservice in Google Apps Script.
 * Database: een Google Sheet met de tabbladen "Opdrachten" en "Tijdlijn". Dat is de Sheet waar dit script aan
 * vastzit, of anders een Sheet die setup() zelf aanmaakt (het ID komt dan in eigenschap SHEET_ID).
 * Inlogcodes staan in de Script-eigenschappen (Projectinstellingen), niet in deze code:
 *   CODE_KLANT, CODE_TEAM, CODE_ADMIN   – de drie inlogcodes, elk anders (controleer met checkSetup)
 *   TEAM_EMAIL                           – optioneel: e-mailadres(sen) van het team voor een e-mail bij een nieuwe opdracht
 *   NTFY_TOPIC                           – optioneel: ntfy.sh-onderwerp voor het serviceteam (nieuwe opdracht, opmerking van de klant)
 *   NTFY_TOPIC_KLANT                     – optioneel: ntfy.sh-onderwerp voor de klant (statuswijziging, opmerking van het team)
 */

const ROLES = {
  klant: { name: 'Klant', prop: 'CODE_KLANT' },
  team: { name: 'Serviceteam', prop: 'CODE_TEAM' },
  admin: { name: 'Beheerder', prop: 'CODE_ADMIN' },
};
const STATUSES = ['Nieuw', 'In behandeling', 'Afgerond', 'Geannuleerd'];
const ORDER_HEADERS = ['id', 'stands', 'omschrijving', 'status', 'aangemaakt', 'gewijzigd'];
const EVENT_HEADERS = ['id', 'opdracht', 'wie', 'soort', 'tekst', 'tijdstip'];
const SESSION_DAYS = 180; // zo lang blijft een apparaat ingelogd
const CACHE_SECONDS = 6 * 60 * 60;
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
  const token = Utilities.getUuid() + Utilities.getUuid();
  const session = { role: role, exp: Date.now() + SESSION_DAYS * 86400000, code: hash_(codes[role]) };
  const props = PropertiesService.getScriptProperties();
  cleanSessions_(props);
  props.setProperty('sess:' + token, JSON.stringify(session));
  cache.put('s:' + token, JSON.stringify(session), CACHE_SECONDS);
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
  PropertiesService.getScriptProperties().deleteProperty('sess:' + token);
}

// Een sessie blijft geldig tot hij verloopt, tot iemand uitlogt, of tot de code van dat account verandert.
function hash_(text) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text)));
}

function cleanSessions_(props) {
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess:') !== 0) return;
    try { if (JSON.parse(all[k]).exp < Date.now()) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

function role_(token) {
  if (!token) throw new Error('SESSIE_VERLOPEN');
  const cache = CacheService.getScriptCache();
  let raw = cache.get('s:' + token);
  if (!raw) {
    raw = PropertiesService.getScriptProperties().getProperty('sess:' + token);
    if (raw) cache.put('s:' + token, raw, CACHE_SECONDS);
  }
  let session = null;
  try { session = raw && JSON.parse(raw); } catch (e) {}
  const codes = codes_();
  if (!session || session.exp < Date.now() || !codes[session.role] || hash_(codes[session.role]) !== session.code) {
    logout(token);
    throw new Error('SESSIE_VERLOPEN');
  }
  return session.role;
}

const isStaff_ = function (role) { return role === 'team' || role === 'admin'; };

// ---------- Meldingen ----------

/** Geeft het ntfy-onderwerp van het team terug, alleen aan het serviceteam en de beheerder. */
function getNotifySetup(token) {
  if (!isStaff_(role_(token))) return null;
  const topic = (PropertiesService.getScriptProperties().getProperty('NTFY_TOPIC') || '').trim();
  // Een ntfy-onderwerp bestaat alleen uit letters, cijfers, - en _.
  return { topic: /^[A-Za-z0-9_-]{1,64}$/.test(topic) ? topic : '', invalid: !!topic && !/^[A-Za-z0-9_-]{1,64}$/.test(topic) };
}

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
  if (isStaff_(role)) throw new Error('Alleen de klant dient opdrachten in.');
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
    notifyKlant_('Opdracht #' + id + ': ' + status, 'Stand ' + found.values[1] + ' staat nu op ' + status + '.');
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
    if (isStaff_(role)) notifyKlant_('Opmerking bij opdracht #' + id, tekst);
    else notifyTeam_('Opmerking van de klant bij #' + id, tekst);
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

// Telefoonmelding via ntfy.sh. Werkt alleen als de eigenschap (NTFY_TOPIC of NTFY_TOPIC_KLANT) is ingesteld.
function notify_(prop, title, message) {
  const topic = PropertiesService.getScriptProperties().getProperty(prop);
  if (!topic) return;
  const headers = { Title: title, Tags: 'wrench' };
  try { headers.Click = ScriptApp.getService().getUrl(); } catch (e) {}
  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + encodeURIComponent(topic.trim()), {
      method: 'post',
      payload: String(message).slice(0, 500),
      headers: headers,
      muteHttpExceptions: true,
    });
  } catch (e) {
    console.warn('Telefoonmelding niet verstuurd: ' + e);
  }
}

function notifyTeam_(title, message) {
  notify_('NTFY_TOPIC', title, message);
  mailTeam_(title, message);
}

// E-mail naar het team, als eigenschap TEAM_EMAIL is ingesteld (meerdere adressen scheiden met een komma).
function mailTeam_(title, message) {
  const to = (PropertiesService.getScriptProperties().getProperty('TEAM_EMAIL') || '').trim();
  if (!to) return;
  let url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  try {
    MailApp.sendEmail({
      to: to,
      subject: 'Standservice: ' + title,
      body: message + (url ? '\n\nOpen Standservice: ' + url : ''),
      name: 'Standservice',
    });
  } catch (e) {
    console.warn('E-mail niet verstuurd: ' + e);
  }
}
function notifyKlant_(title, message) { notify_('NTFY_TOPIC_KLANT', title, message); }

// Zorgt dat Sheets tekst als tekst bewaart: geen formules (=, +, -, @) en geen standnummers die een getal worden.
function text_(value) {
  return "'" + String(value);
}
