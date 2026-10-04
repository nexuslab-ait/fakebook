/**
 * FUTURE FEED · Google Apps Script backend
 * Stores every post as one row in the "Posts" sheet and serves them to the website.
 *
 * To hide a post: tick the box in its "hidden" column, or delete the row.
 * After you change anything in this file: Deploy > Manage deployments > Edit (pencil)
 * > Version: New version > Deploy. The web app URL stays the same.
 */

// Students type this code to post. Change it to anything you like, or set it to '' to switch it off.
const CLASS_CODE = 'FUTURES2050';

const SHEET_NAME = 'Posts';
const HEADERS = ['timestamp', 'id', 'name', 'case', 'year', 'headline', 'image', 'changes', 'quote', 'quoteBy', 'story', 'likes', 'hidden'];
const SCENES = ['coastal_barangay', 'island_livelihoods', 'mountain_village', 'city_neighbourhood', 'farmland'];
const LIMITS = { name: 60, case: 80, headline: 140, image: 600, change: 160, quote: 260, quoteBy: 80, story: 1000 };

/** Run this once from the editor (Run > setup) to create the sheet and its header row. */
function setup() {
  const sh = getSheet_();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#F6C343');
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, HEADERS.length, 140);
  sh.setColumnWidth(6, 280);
  sh.setColumnWidth(11, 360);
}

function doGet() {
  try {
    return json_({ ok: true, posts: readPosts_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Could not read the post.' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (body.action === 'post') return json_(addPost_(body));
    if (body.action === 'like') return json_(like_(String(body.id || '')));
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function addPost_(body) {
  if (CLASS_CODE && String(body.code || '').trim().toUpperCase() !== CLASS_CODE.toUpperCase()) {
    return { ok: false, error: 'That class code is not right. Ask your instructor for the code.' };
  }
  const p = body.post || {};
  const year = parseInt(p.year, 10);
  const changes = (Array.isArray(p.changes) ? p.changes : []).map(function (c) { return clean_(c, LIMITS.change); }).filter(String).slice(0, 5);
  const post = {
    name: clean_(p.name, LIMITS.name),
    case: clean_(p.case, LIMITS.case),
    year: year,
    headline: clean_(p.headline, LIMITS.headline),
    image: cleanImage_(p.image),
    changes: changes,
    quote: clean_(p.quote, LIMITS.quote),
    quoteBy: clean_(p.quoteBy, LIMITS.quoteBy),
    story: clean_(p.story, LIMITS.story),
  };
  if (!post.name || !post.case || !post.headline) return { ok: false, error: 'Please add your name, case area and headline.' };
  if (!(year >= 2026 && year <= 2200)) return { ok: false, error: 'Please choose a future year.' };
  if (changes.length < 3) return { ok: false, error: 'Please list at least 3 changes.' };

  post.id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  post.timestamp = new Date();
  post.likes = 0;
  const sh = getSheet_();
  sh.appendRow([post.timestamp, post.id, safe_(post.name), safe_(post.case), post.year, safe_(post.headline), safe_(post.image),
    JSON.stringify(post.changes), safe_(post.quote), safe_(post.quoteBy), safe_(post.story), 0, false]);
  sh.getRange(sh.getLastRow(), HEADERS.indexOf('hidden') + 1).insertCheckboxes();
  post.timestamp = post.timestamp.toISOString();
  return { ok: true, post: post };
}

function like_(id) {
  if (!id) return { ok: false, error: 'Missing post.' };
  const sh = getSheet_();
  const idCol = HEADERS.indexOf('id') + 1;
  const likesCol = HEADERS.indexOf('likes') + 1;
  const found = sh.getRange(2, idCol, Math.max(sh.getLastRow() - 1, 1), 1).createTextFinder(id).matchEntireCell(true).findNext();
  if (!found) return { ok: false, error: 'Post not found.' };
  const cell = sh.getRange(found.getRow(), likesCol);
  const likes = (Number(cell.getValue()) || 0) + 1;
  cell.setValue(likes);
  return { ok: true, id: id, likes: likes };
}

function readPosts_() {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  const head = values.shift().map(String);
  const col = function (name) { return head.indexOf(name); };
  return values
    .filter(function (r) { return r[col('id')] && !isHidden_(r[col('hidden')]); })
    .map(function (r) {
      let changes = [];
      try { changes = JSON.parse(r[col('changes')]); } catch (err) { changes = String(r[col('changes')] || '').split('\n'); }
      const ts = r[col('timestamp')];
      return {
        id: String(r[col('id')]),
        timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
        name: String(r[col('name')]),
        case: String(r[col('case')]),
        year: Number(r[col('year')]),
        headline: String(r[col('headline')]),
        image: String(r[col('image')]),
        changes: changes.filter(String),
        quote: String(r[col('quote')]),
        quoteBy: String(r[col('quoteBy')]),
        story: String(r[col('story')]),
        likes: Number(r[col('likes')]) || 0,
      };
    })
    .sort(function (a, b) { return a.timestamp < b.timestamp ? 1 : -1; });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function isHidden_(v) {
  return v === true || /^(true|yes|hide|hidden|x)$/i.test(String(v).trim());
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanImage_(v) {
  const s = String(v || '').trim();
  if (s.indexOf('scene:') === 0 && SCENES.indexOf(s.slice(6)) >= 0) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s.slice(0, LIMITS.image);
  return 'scene:coastal_barangay';
}

// Stop text that starts with = + - @ from being read as a spreadsheet formula.
function safe_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
