"""
VAANI Broadcast Mailer
──────────────────────────────────────────────────────────────────────
Minimal Python backend that receives a POST from the VAANI compose
window and sends it as an email via Microsoft 365 SMTP.

Endpoints
  POST /send-email   { "to", "subject", "message" }  → sends the mail
  GET  /health       → { "ok": true }

Run
  pip install flask python-dotenv
  python vaani_mailer.py
──────────────────────────────────────────────────────────────────────
"""

import base64
import os
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from flask import Flask, jsonify, make_response, request

load_dotenv()

# ── SMTP config (from .env) ───────────────────────────────────────────
MAIL_HOST           = os.getenv("MAIL_HOST", "smtp.office365.com")
EMAIL_PORT          = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS       = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_HOST_USER     = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")

# ── Server config ─────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", 5050))

# ── Flask app ─────────────────────────────────────────────────────────
app = Flask(__name__)


# ── CORS ─────────────────────────────────────────────────────────────
# Intercept every OPTIONS preflight before it reaches any route
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        resp.headers["Access-Control-Allow-Origin"]  = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Max-Age"]       = "86400"
        return resp

# Stamp CORS origin on every non-OPTIONS response too
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


# ── SMTP helper ───────────────────────────────────────────────────────
def send_smtp(to_addrs: list, subject: str, message: str, attachments: list = None) -> None:
    """Send a plain-text + HTML email with optional WAV attachments via Office 365 SMTP."""
    # Use "mixed" so we can combine alternative text/html with file attachments
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = f"Pi One Data <{EMAIL_HOST_USER}>"
    msg["To"]      = ", ".join(to_addrs)

    # Wrap text + HTML in their own "alternative" part
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(message, "plain", "utf-8"))

    # Split sections on double newline — each starts with a flag + language label
    sections = message.split("\n\n")
    sections_html = ""
    for section in sections:
        lines = section.strip().splitlines()
        if not lines:
            continue
        header = lines[0]          # e.g. "🇬🇧 English (Original)"
        body   = "\n".join(lines[1:]).strip()
        sections_html += f"""
        <div style="margin-bottom:20px;padding:14px 16px;
                    background:#f8fafc;border-left:3px solid #1f2b5c;border-radius:4px">
          <div style="font-weight:600;font-size:13px;color:#1f2b5c;margin-bottom:6px">{header}</div>
          <div style="white-space:pre-wrap;font-size:14px;color:#0f172a;line-height:1.6">{body}</div>
        </div>"""

    html_body = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;
                color:#0f172a;max-width:620px;line-height:1.6">
      <h2 style="margin:0 0 20px;font-size:16px;color:#1f2b5c;
                 padding-bottom:12px;border-bottom:2px solid #e2e8f0">{subject}</h2>
      {sections_html}
      <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
      <p style="font-size:12px;color:#94a3b8;margin:0">
        Sent via VAANI Localisation Engine · Pi One Data
      </p>
    </div>"""
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    msg.attach(alt)

    # Attach each voice WAV (base64-encoded from the browser)
    for att in (attachments or []):
        try:
            wav_data = base64.b64decode(att["data"])
            part = MIMEBase("audio", "wav")
            part.set_payload(wav_data)
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition", "attachment",
                filename=att.get("filename", "voice.wav")
            )
            msg.attach(part)
        except Exception as e:
            print(f"[mailer] skipped attachment '{att.get('filename')}': {e}")

    with smtplib.SMTP(MAIL_HOST, EMAIL_PORT, timeout=15) as server:
        server.ehlo()
        if EMAIL_USE_TLS:
            server.starttls()
            server.ehlo()
        server.login(EMAIL_HOST_USER, EMAIL_HOST_PASSWORD)
        server.sendmail(EMAIL_HOST_USER, to_addrs, msg.as_string())


# ── Routes ────────────────────────────────────────────────────────────

@app.route("/send-email", methods=["POST"])
def send_email():
    data        = request.get_json(silent=True) or {}
    to_raw      = data.get("to", "")
    to_list     = to_raw if isinstance(to_raw, list) else [str(to_raw).strip()]
    to_list     = [t.strip() for t in to_list if t.strip()]
    subject     = str(data.get("subject", "")).strip()
    message     = str(data.get("message", "")).strip()
    attachments = data.get("attachments") or []

    if not to_list:
        return jsonify({"ok": False, "error": "'to' is required"}), 400
    if not subject:
        return jsonify({"ok": False, "error": "'subject' is required"}), 400
    if not message:
        return jsonify({"ok": False, "error": "'message' is required"}), 400
    if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
        return jsonify({"ok": False, "error": "SMTP credentials not configured"}), 503

    try:
        send_smtp(to_list, subject, message, attachments)
        print(f"[mailer] ✓ sent → {', '.join(to_list)} | {subject[:60]} | {len(attachments)} attachment(s)")
        return jsonify({"ok": True})
    except smtplib.SMTPAuthenticationError:
        return jsonify({"ok": False, "error": "SMTP auth failed — check EMAIL_HOST_PASSWORD"}), 500
    except smtplib.SMTPException as exc:
        return jsonify({"ok": False, "error": f"SMTP error: {exc}"}), 500
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok":      True,
        "service": "VAANI Broadcast Mailer",
        "smtp":    MAIL_HOST,
        "user":    EMAIL_HOST_USER or "(not set)"
    })


# ── Boot ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
        print("[mailer] WARNING: SMTP credentials missing")
    else:
        print(f"[mailer] SMTP ready — {EMAIL_HOST_USER} → {MAIL_HOST}:{EMAIL_PORT}")
    print(f"[mailer] Listening on http://0.0.0.0:{PORT}")

    try:
        from waitress import serve
        print("[mailer] Using waitress (production WSGI server)")
        serve(app, host="0.0.0.0", port=PORT, threads=4)
    except ImportError:
        print("[mailer] waitress not installed — falling back to Flask dev server")
        print("[mailer] Run: pip install waitress")
        app.run(host="0.0.0.0", port=PORT, debug=False)
