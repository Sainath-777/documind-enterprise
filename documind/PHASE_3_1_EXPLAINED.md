# Phase 3.1 Explained: Quotas & Rate Limiting

This document provides a breakdown of all the changes made during Phase 3.1 of the DocuMind project. The goal of this phase was to ensure that the system is 'production-ready' by protecting it from abuse and keeping track of how much each user (tenant) is using the system.

---

## 1. The 'Big Picture' (Simplified)

Imagine you own a **Gym**. 
- **Rate Limiting** is the **Turnstile** at the front door. It ensures that 1,000 people don't try to squeeze through the door at the exact same second. If too many try, the turnstile locks and says 'Wait a minute.'
- **Quotas** are like a **Monthly Membership**. If your membership only allows 10 visits a month, and you try to come in for the 11th time, the receptionist says 'Sorry, you have used up your limit for this month.'
- **Usage Tracking** is the **Sign-in Sheet**. It records every time someone walks in or uses a trainer so you know who to bill at the end of the month.

---

## 2. File-by-File Breakdown

### [NEW] pp/services/quotas/rate_limiter.py
*   **Simplified**: This is the 'Turnstile' logic. It checks if a specific user has clicked a button too many times in the last minute.
*   **Technical**: Implements a **Redis Sliding Window**. It uses a Redis key 
atelimit:{tenant_id}:{endpoint}. Every time a request comes in, it increments that number. If the number is higher than the limit (e.g., 100), it throws a 429 Too Many Requests error. It uses an EXPIRE command so the 'memory' of these clicks disappears after 60 seconds.

### [NEW] pp/services/quotas/usage_tracker.py
*   **Simplified**: This is the 'Sign-in Sheet' manager. It has two jobs: (1) Write down when someone does something, and (2) Check the membership rules to see if they are allowed to do it.
*   **Technical**: This file handles the logic for both Redis counters and Database checks.
    *   check_query_quota: Looks at Redis to see how many queries the user did *this month*.
    *   check_document_quota: Looks at the PostgreSQL database to count exactly how many files the user has uploaded and how big they are.
    *   increment_usage: Sends a quick command to Redis to bump the counter (+1 query, +500 tokens) so we don't slow down the main app by writing to the slow database every single second.

### [NEW] pp/api/v1/endpoints/admin.py
*   **Simplified**: A private 'Manager Dashboard' view. It lets you see exactly how much a user has used vs. what they are allowed to use.
*   **Technical**: A new FastAPI router that provides a GET /usage/{tenant_id} endpoint. It calculates usage percentages (e.g., 'You are at 45% of your query limit') by comparing the QuotaLimit table in the DB with the current counters in Redis.

### [MODIFIED] pp/api/v1/endpoints/query.py & query_stream.py
*   **Simplified**: We added a 'Security Guard' at the start of the Query process. Before the AI starts thinking, the guard checks the Turnstile (Rate Limit) and the Membership (Quota). After the AI finishes, the guard writes down how many tokens were used.
*   **Technical**: We injected check_rate_limit and check_query_quota at the top of the functions. At the end, after the database logs the query, we call increment_query_usage to update the Redis counters.

### [MODIFIED] pp/api/v1/endpoints/documents.py
*   **Simplified**: Similar to the query endpoints, but specifically for file uploads. It prevents a user from uploading a 10GB file if their limit is 1GB.
*   **Technical**: Added check_document_quota before the file is even saved to a temporary folder. If the user is over their limit of documents or storage bytes, the upload is rejected immediately.

### [MODIFIED] pp/workers/celery_app.py
*   **Simplified**: We set a 'Clock' (Alarm) for the system.
*   **Technical**: Configured **Celery Beat**. We added a eat_schedule that tells the system to run a specific background task (sync_redis_usage) once every 3600 seconds (1 hour).

### [MODIFIED] pp/workers/tasks.py
*   **Simplified**: This is the 'Night Shift' worker. Once an hour, it takes all the temporary notes from the 'Sign-in Sheet' (Redis) and copies them into the permanent 'Account Ledger' (PostgreSQL Database). Then it wipes the temporary notes clean for the next hour.
*   **Technical**: Added the sync_redis_usage task. It:
    1.  Scans Redis for all usage keys.
    2.  Reads the numbers (queries, tokens, docs).
    3.  Uses a SQL UPDATE or INSERT to save those totals into the usage_logs table.
    4.  Resets the Redis keys to zero so we don't double-count in the next hour.

### [MODIFIED] pp/api/v1/router.py
*   **Simplified**: We added the 'Manager Dashboard' (Admin endpoint) to the main list of available office doors.
*   **Technical**: Included the dmin.router into the main FastAPI pi_router so the URL /api/v1/admin/... actually works.

---

## 3. Why did we do it this way? (The 'Secret Sauce')

**Why use Redis for counters instead of the Database?**
Writing to a Database (PostgreSQL) is like writing in a stone tablet—it's permanent but slow. Writing to Redis is like writing on a whiteboard—it's incredibly fast but could be wiped if the power goes out. By using Redis for the 'every second' counts and the Database for the 'once an hour' totals, we get a system that is both **blazing fast** for the user and **accurate** for billing.