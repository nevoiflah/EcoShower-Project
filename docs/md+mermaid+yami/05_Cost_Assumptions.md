# EcoShower - Cost Calculation Assumptions
## הנחות יסוד לחישוב עלויות

---

## 1. הנחות כלליות

### 1.1 היקף המערכת
| פרמטר | ערך | הסבר |
|-------|-----|------|
| מספר משתמשים | 500 | משתמשים רשומים פעילים |
| מספר מכשירים | 600 | ~1.2 מכשירים למשתמש |
| מכשירים מקוונים | 70% | 420 מכשירים online בו-זמנית |

### 1.2 דפוסי שימוש
| פרמטר | ערך | הסבר |
|-------|-----|------|
| מקלחות למשתמש/יום | 2 | בוקר וערב |
| ימי שימוש בחודש | 30 | כל יום |
| סה"כ מקלחות/חודש | 30,000 | 500 × 2 × 30 |

### 1.3 נפח נתונים
| פרמטר | ערך | הסבר |
|-------|-----|------|
| הודעות telemetry/מקלחת | 60 | כל 2 שניות × 2 דקות |
| גודל הודעה ממוצע | 200 bytes | JSON payload |
| סה"כ הודעות IoT/חודש | 1,800,000 | 30,000 × 60 |

---

## 2. חישוב לפי שירות

### 2.1 Amazon DynamoDB

**הנחות:**
- On-demand capacity mode (לא provisioned)
- Point-in-time recovery מופעל
- אין DAX (cache)

**חישוב:**
| פעולה | כמות/חודש | יחידות | מחיר/יחידה | סה"כ |
|-------|-----------|--------|------------|------|
| Write requests | 2,000,000 | WRU (1M) | $1.25 | $2.50 |
| Read requests | 5,000,000 | RRU (1M) | $0.25 | $1.25 |
| Storage | 5 GB | GB | $0.25 | $1.25 |
| Backup | 5 GB | GB | $0.10 | $0.50 |
| **סה"כ DynamoDB** | | | | **$5.50** |

**הסבר:**
- Writes: telemetry + sessions + updates = ~2M
- Reads: dashboard + history + real-time = ~5M
- Storage: גודל ממוצע לרשומה 500 bytes × מספר רשומות

---

### 2.2 AWS Lambda

**הנחות:**
- Runtime: Python 3.11
- Memory: 256 MB
- Average duration: 200ms

**חישוב:**
| Function | Invocations/חודש | Duration (ms) | Memory (MB) | GB-seconds |
|----------|-----------------|---------------|-------------|------------|
| ProcessTelemetry | 1,800,000 | 200 | 256 | 92,160 |
| API Handler | 500,000 | 150 | 256 | 19,200 |
| **סה"כ** | 2,300,000 | | | 111,360 |

| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| Requests (מעבר ל-1M חינם) | 1,300,000 | $0.20/1M | $0.26 |
| GB-seconds (מעבר ל-400K חינם) | 0 | $0.0000166667 | $0.00 |
| **סה"כ Lambda** | | | **$0.26** |

**הערה:** רוב השימוש נכנס ב-Free Tier

---

### 2.3 AWS IoT Core

**הנחות:**
- פרוטוקול: MQTT
- QoS: 1
- Connection time: 24/7

**חישוב:**
| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| Connectivity (minutes) | 18,144,000 | $0.08/1M | $1.45 |
| Messages | 1,800,000 | $1.00/1M | $1.80 |
| Rules triggered | 1,800,000 | $0.15/1M | $0.27 |
| **סה"כ IoT Core** | | | **$3.52** |

**הסבר Connectivity:**
- 420 devices × 60 min × 24 hrs × 30 days = 18,144,000 minutes

---

### 2.4 Amazon API Gateway

**הנחות:**
- REST API
- Average payload: 2 KB

**חישוב:**
| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| API calls | 500,000 | $3.50/1M | $1.75 |
| Data transfer | 1 GB | $0.09/GB | $0.09 |
| **סה"כ API Gateway** | | | **$1.84** |

---

### 2.5 Amazon Cognito

**הנחות:**
- User Pool with email verification
- 500 MAU (Monthly Active Users)

**חישוב:**
| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| MAUs (first 50K free) | 500 | $0.00 | $0.00 |
| **סה"כ Cognito** | | | **$0.00** |

---

### 2.6 Amazon SNS

**הנחות:**
- Push notifications (mobile)
- Email notifications

**חישוב:**
| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| Mobile push (first 1M free) | 60,000 | $0.00 | $0.00 |
| Email | 5,000 | $2.00/1000 | $10.00 |
| **סה"כ SNS** | | | **$10.00** |

**הערה:** 2 push notifications × 30,000 sessions = 60,000

---

### 2.7 Amazon S3

**הנחות:**
- Frontend static files: 50 MB
- Standard storage class

**חישוב:**
| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| Storage | 0.05 GB | $0.023/GB | $0.00 |
| GET requests | 100,000 | $0.0004/1000 | $0.04 |
| **סה"כ S3** | | | **$0.04** |

---

### 2.8 Amazon CloudFront

**הנחות:**
- Data transfer: 10 GB/month
- Requests: 100,000/month

**חישוב:**
| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| Data transfer (first 1TB) | 10 GB | $0.085/GB | $0.85 |
| HTTPS requests | 100,000 | $0.01/10K | $0.10 |
| **סה"כ CloudFront** | | | **$0.95** |

---

### 2.9 Amazon CloudWatch

**הנחות:**
- Basic logs only
- 5 custom metrics
- 2 alarms

**חישוב:**
| פריט | כמות | מחיר | סה"כ |
|------|------|------|------|
| Log ingestion | 5 GB | $0.50/GB | $2.50 |
| Log storage | 5 GB | $0.03/GB | $0.15 |
| Custom metrics | 5 | $0.30/metric | $1.50 |
| Alarms | 2 | $0.10/alarm | $0.20 |
| **סה"כ CloudWatch** | | | **$4.35** |

---

## 3. סיכום עלויות חודשיות

| שירות | עלות חודשית |
|-------|-------------|
| DynamoDB | $5.50 |
| Lambda | $0.26 |
| IoT Core | $3.52 |
| API Gateway | $1.84 |
| Cognito | $0.00 |
| SNS | $10.00 |
| S3 | $0.04 |
| CloudFront | $0.95 |
| CloudWatch | $4.35 |
| **סה"כ** | **$26.46** |

---

## 4. תרחישי Scale

### 4.1 תרחיש קטן (100 משתמשים)
| שירות | עלות |
|-------|------|
| סה"כ | ~$8/month |

### 4.2 תרחיש בינוני (500 משתמשים) - ברירת מחדל
| שירות | עלות |
|-------|------|
| סה"כ | ~$26/month |

### 4.3 תרחיש גדול (2,000 משתמשים)
| שירות | עלות |
|-------|------|
| סה"כ | ~$85/month |

### 4.4 תרחיש Enterprise (10,000 משתמשים)
| שירות | עלות |
|-------|------|
| סה"כ | ~$350/month |

---

## 5. הערות נוספות

### 5.1 Free Tier
- AWS מציעה שנה ראשונה עם Free Tier
- Lambda: 1M requests + 400K GB-seconds חינם
- DynamoDB: 25GB storage + 25 WCU/RCU חינם
- IoT Core: ללא Free Tier

### 5.2 חיסכון אפשרי
- Reserved capacity ל-DynamoDB: ~30% חיסכון
- Savings Plans ל-Lambda: ~17% חיסכון
- Spot instances אם יש EC2: ~70% חיסכון

### 5.3 עלויות נסתרות אפשריות
- Data transfer בין regions
- VPC endpoints
- WAF/Shield
- Support plan

---

## 6. פירוט עלויות מלא
ניתן למצוא פירוט מלא בקובץ המצורף: **EcoShowerEstimate.pdf**

---

## 7. אחריות

המחירים מבוססים על תעריפי AWS נכון לדצמבר 2025 עבור region **eu-north-1 (Stockholm)**.
המחירים עשויים להשתנות. יש לבדוק את התעריפים העדכניים באתר AWS.

