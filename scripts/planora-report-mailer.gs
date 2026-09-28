// Copy into YOUR Google Apps Script project. Set the three Script Properties
// described in docs/REPORT_EMAIL.md. Never put real values in this source file.
function doPost(e) {
  try {
    var p = PropertiesService.getScriptProperties();
    var data = JSON.parse(e.postData.contents);
    var secret = p.getProperty('PLANORA_MAIL_SECRET');
    if (!secret || secret.length < 32 || data.secret !== secret) throw new Error('Unauthorized');
    if (!/^[0-9a-f-]{36}$/i.test(data.id || '')) throw new Error('Invalid alert ID');
    var recipients = [p.getProperty('AHMED_EMAIL'), p.getProperty('YOUSSEF_EMAIL')];
    if (recipients.some(function (email) { return !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); })) throw new Error('Recipient is missing');
    var code = String(data.courseCode || 'General').slice(0, 80);
    var types = Array.isArray(data.types) ? data.types.join(', ').slice(0, 150) : '';
    var cache = CacheService.getScriptCache();
    if (cache.get(data.id)) return reply_({ ok: true });
    if (data.kind === 'security') {
      if (!['login_success', 'login_blocked'].includes(data.action) || !/^\d{4}-\d\d-\d\dT/.test(data.at || '') || typeof data.ip !== 'string' || data.ip.length > 50 || typeof data.device !== 'string' || data.device.length > 60 || typeof data.claimedUsername !== 'string' || data.claimedUsername.length > 64) throw new Error('Invalid security alert');
      var lines = ['Planora admin sign-in: ' + data.action, 'Time: ' + data.at, 'IP: ' + data.ip, 'Browser / OS: ' + data.device, 'Entered username: ' + data.claimedUsername, 'Admin identity (successful sign-in only): ' + (data.adminName || 'unverified'), '', 'Private security log: https://zc-planora.vercel.app/admin.html'];
      MailApp.sendEmail({ to: recipients.join(','), subject: 'Planora admin security alert', body: lines.join('\n'), name: 'Planora' });
      cache.put(data.id, 'sent', 21600);
      return reply_({ ok: true });
    }
    if (data.kind) throw new Error('Unsupported alert kind');
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: 'Planora: new student data report',
      body: 'A private student report arrived about ' + code + ' (' + types + ').\n\nReview: https://zc-planora.vercel.app/admin.html\nReport ID: ' + data.id,
      name: 'Planora',
    });
    cache.put(data.id, 'sent', 21600);
    return reply_({ ok: true });
  } catch (error) {
    console.error('Planora mailer rejected a request.');
    return reply_({ ok: false });
  }
}

function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
