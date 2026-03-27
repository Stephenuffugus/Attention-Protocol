# SWS Attention Protocol — REST API Specification
## Version 1.0 | Base URL: https://api.swsprotocol.com/v1
### SWS Strategic Media LLC | Patent Pending: SWS-PROV-001

---

## AUTHENTICATION

All API requests require authentication via API key header:

```
X-SWS-API-Key: your_api_key_here
X-SWS-Client-ID: your_client_id
```

API keys are issued during pilot onboarding. Each key is scoped to a single client and rate-limited.

---

## ENDPOINTS

### POST /sessions

Submit a session's attention data for processing and receipt generation.

**Request:**
```json
{
  "session_id": "a1b2c3d4e5f6...",
  "client_id": "qualtrics_pilot_001",
  "started_at": 1711540800000,
  "ended_at": 1711541100000,
  "duration_ms": 300000,
  "interaction_count": 47,
  "hashes": [
    {
      "hash": "e3b0c44298fc1c149afbf4c8996fb924...",
      "event_type": "idle_drip",
      "timestamp": 1711540900000,
      "quality_tier": "passive"
    }
  ],
  "behavioral": {
    "timing_cv": 0.82,
    "fitts_r": 0.54,
    "scroll_fixations": 6,
    "micro_pause_avg_ms": 420,
    "touch_variance": 1.3,
    "hicks_compliance": 0.68
  }
}
```

**Response (201 Created):**
```json
{
  "receipt_id": "rcpt_m3k7p9_abc123",
  "session_id": "a1b2c3d4e5f6...",
  "focus_score": 72,
  "human_confidence": 0.84,
  "quality_tier": "active",
  "hash_count": 3,
  "verified_attention_minutes": 5.0,
  "verdict": "verified_human_active_engagement",
  "receipt_hash": "7d865e959b2466918c9863afca942d...",
  "created_at": "2026-03-27T14:30:00Z"
}
```

---

### GET /sessions/{session_id}

Retrieve full session data and verification receipt.

**Response (200 OK):**
```json
{
  "session_id": "a1b2c3d4e5f6...",
  "client_id": "qualtrics_pilot_001",
  "duration_ms": 300000,
  "interaction_count": 47,
  "focus_score": 72,
  "human_confidence": 0.84,
  "quality_tier": "active",
  "behavioral": {
    "timing_cv": 0.82,
    "fitts_r": 0.54,
    "scroll_fixations": 6,
    "micro_pause_avg_ms": 420,
    "touch_variance": 1.3,
    "hicks_compliance": 0.68
  },
  "hashes": [...],
  "receipt": {
    "receipt_id": "rcpt_m3k7p9_abc123",
    "receipt_hash": "7d865e959b2466918c...",
    "verification_url": "https://api.swsprotocol.com/v1/receipts/rcpt_m3k7p9_abc123/verify"
  },
  "created_at": "2026-03-27T14:30:00Z"
}
```

---

### GET /sessions

List sessions with filters and pagination.

**Query Parameters:**

| Param | Type | Description |
|-------|------|------------|
| `from` | ISO 8601 | Start date |
| `to` | ISO 8601 | End date |
| `min_focus_score` | number | Minimum Focus Score (0-100) |
| `quality_tier` | string | Filter by tier (deep/active/passive/background) |
| `verdict` | string | Filter by verdict |
| `limit` | number | Results per page (default 50, max 500) |
| `offset` | number | Pagination offset |
| `sort` | string | Sort field (created_at, focus_score, duration_ms) |
| `order` | string | asc or desc |

**Response (200 OK):**
```json
{
  "sessions": [...],
  "total": 1247,
  "limit": 50,
  "offset": 0,
  "has_more": true
}
```

---

### GET /receipts/{receipt_id}

Retrieve a cryptographic attention receipt.

**Response (200 OK):**
```json
{
  "receipt_id": "rcpt_m3k7p9_abc123",
  "receipt_version": "1.0",
  "protocol": "SWS Proof of Attention Protocol",
  "issuer": "SWS Strategic Media LLC",
  "generated_at": "2026-03-27T14:30:00Z",
  "subject_id": "anon_abc123",
  "engagement": {
    "duration_ms": 300000,
    "focus_score": 72,
    "quality_tier": "active",
    "interaction_count": 47,
    "interactions_per_minute": 9.4
  },
  "human_verification": {
    "composite_score": 0.84,
    "timing_entropy": 0.78,
    "fitts_compliance": 0.68,
    "hicks_compliance": 0.62,
    "scroll_saccade": 0.75,
    "micro_pause": 0.71,
    "touch_variance": 0.65,
    "verdict": "verified_human_active_engagement"
  },
  "proof": {
    "hash_count": 3,
    "algorithm": "SHA-256",
    "receipt_hash": "7d865e959b2466918c..."
  },
  "privacy": {
    "no_content_recorded": true,
    "no_pii_collected": true,
    "coppa_compliant": true,
    "scif_eligible": true
  }
}
```

---

### POST /receipts/verify

Independently verify a receipt's cryptographic integrity.

**Request:**
```json
{
  "receipt": { ... }
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "reason": "hash_matches",
  "verified_at": "2026-03-27T14:35:00Z"
}
```

---

### GET /analytics/summary

Aggregate analytics for a date range.

**Query Parameters:** `from`, `to`

**Response (200 OK):**
```json
{
  "period": { "from": "2026-03-01", "to": "2026-03-27" },
  "total_sessions": 12847,
  "total_hashes": 89432,
  "total_verified_minutes": 42716,
  "avg_focus_score": 64,
  "avg_human_confidence": 0.78,
  "tier_distribution": {
    "deep": 2847,
    "active": 6123,
    "passive": 3201,
    "background": 676
  },
  "top_events": [
    { "event_type": "idle_drip", "count": 34521 },
    { "event_type": "page_visit", "count": 12847 },
    { "event_type": "tab_return", "count": 8764 }
  ],
  "verdicts": {
    "verified_human_deep_engagement": 2847,
    "verified_human_active_engagement": 6123,
    "likely_human_passive": 3201,
    "possible_automation_detected": 676
  }
}
```

---

### GET /analytics/quality

Quality metrics over time (daily granularity).

**Response (200 OK):**
```json
{
  "daily": [
    {
      "date": "2026-03-27",
      "sessions": 487,
      "avg_focus_score": 68,
      "avg_human_confidence": 0.81,
      "avg_timing_cv": 0.74,
      "avg_interactions_per_minute": 8.2,
      "deep_pct": 22,
      "active_pct": 48,
      "passive_pct": 25,
      "background_pct": 5
    }
  ]
}
```

---

### POST /webhooks

Register a webhook for real-time event notifications.

**Request:**
```json
{
  "url": "https://your-server.com/sws-webhook",
  "events": ["session.complete", "receipt.generated", "quality.below_threshold"],
  "secret": "your_webhook_secret"
}
```

**Webhook Payload (delivered via POST to your URL):**
```json
{
  "event": "session.complete",
  "timestamp": "2026-03-27T14:30:00Z",
  "data": {
    "session_id": "a1b2c3d4e5f6...",
    "focus_score": 72,
    "human_confidence": 0.84,
    "quality_tier": "active"
  },
  "signature": "sha256=abc123..."
}
```

Signatures use HMAC-SHA256 with your webhook secret. Verify by computing `HMAC-SHA256(secret, raw_body)` and comparing to the signature header.

**Retry Policy:** Failed deliveries retry with exponential backoff — 1min, 5min, 30min, 2hr, 12hr. After 5 failures, the webhook is disabled and the client is notified.

---

### GET /clients/{client_id}/usage

Usage and billing data for the current period.

**Response (200 OK):**
```json
{
  "client_id": "qualtrics_pilot_001",
  "plan": "professional",
  "period": { "from": "2026-03-01", "to": "2026-03-31" },
  "usage": {
    "sessions": 12847,
    "hashes_generated": 89432,
    "receipts_generated": 12847,
    "api_calls": 34521
  },
  "billing": {
    "rate_per_session": 0.03,
    "current_period_cost": 385.41,
    "revenue_split": {
      "user_share": 269.79,
      "developer_share": 111.77,
      "protocol_fee": 3.85
    }
  },
  "limits": {
    "sessions_per_day": 100000,
    "api_calls_per_minute": 1000
  }
}
```

---

## RATE LIMITS

| Tier | Requests/Minute | Sessions/Day |
|------|----------------|-------------|
| Pilot (free) | 100 | 10,000 |
| Starter | 500 | 50,000 |
| Professional | 1,000 | 500,000 |
| Enterprise | Custom | Custom |

Rate limit headers returned on every response:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1711541160
```

---

## ERROR CODES

| Code | Meaning | Description |
|------|---------|------------|
| 400 | Bad Request | Invalid payload structure or missing required fields |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | API key not authorized for this resource |
| 404 | Not Found | Session or receipt ID not found |
| 409 | Conflict | Duplicate session_id submission |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Contact support |
| 503 | Service Unavailable | Temporary maintenance |

**Error Response Format:**
```json
{
  "error": {
    "code": 400,
    "type": "validation_error",
    "message": "Missing required field: session_id",
    "field": "session_id"
  }
}
```

---

## SDK INTEGRATION OPTIONS

| Language | Package | Installation |
|----------|---------|-------------|
| JavaScript (browser) | `attention-protocol.js` | `<script src="..."></script>` |
| JavaScript (B2B) | `sws-client.js` | `<script src="..." data-client-id="..."></script>` |
| Node.js | `@sws/attention-protocol` | `npm install @sws/attention-protocol` |
| Python | `sws-attention` | `pip install sws-attention` |
| REST | Any language | Standard HTTP + JSON |

---

*API Specification v1.0 — SWS Proof of Attention Protocol*
*SWS Strategic Media LLC | Patent Pending: SWS-PROV-001*
