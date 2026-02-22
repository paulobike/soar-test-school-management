# School Management

A Node.js/Express/Mongoose API built on a convention-driven, IoC-based framework. Routes, middleware, validators, and response models are all auto-discovered. Add files, and the framework wires them up.

---

## Requirements

- Node.js 18+
- Redis
- MongoDB

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the sample file and fill in the secrets:

```bash
cp .env.example .env
```

See [`.env.example`](.env.example) for all available variables. The three secrets are required — the server will refuse to start without them:

```bash
# Generate NACL_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Start

```bash
npm run dev     # development — auto-restarts on file changes
npm start       # production
```

### 4. API Docs

Once running, the auto-generated Swagger UI is available at:

```
http://localhost:5111/api-docs
http://localhost:5111/api-docs.json   # raw OpenAPI 3.0 spec
```

---

## Architecture

### Manager Pattern

Every domain lives in `managers/entities/<name>/`. A manager is a class that receives all dependencies via constructor injection and declares HTTP endpoints through an `httpExposed` array.

```
managers/
├── entities/           ← domain managers (add yours here)
│   ├── token/
│   └── user/
├── api/                ← route dispatcher (infrastructure)
├── http/               ← express server (infrastructure)
├── shark_fin/          ← ACL system (infrastructure)
├── virtual_stack/      ← middleware executor (infrastructure)
└── ...
```

Each entity owns three files:

```
managers/entities/<name>/
├── <Name>.manager.js   ← business logic + httpExposed
├── <name>.schema.js    ← request validation schema
└── <name>.res.js       ← response model
```

### Automatic Route Registration

`ApiHandler` scans all managers for `httpExposed` and registers routes automatically:

```
POST /api/:moduleName/:fnName
GET  /api/:moduleName/:fnName
```

Declaring `httpExposed = ['createUser']` on a manager named `user` exposes `POST /api/user/createUser`. No router file needed.

HTTP method is controlled via a prefix:

```js
this.httpExposed = ['createUser', 'get=getProfile'];
//                  ^ POST         ^ GET
```

### Middleware Injection

Function parameters prefixed with `__` are automatically resolved to middleware. The framework reads the function signature, builds a middleware stack, executes it, and injects results as arguments.

```js
// __shortToken → runs __shortToken.mw.js, injects decoded JWT payload
// __device     → runs __device.mw.js, injects { ip, agent }
async getProfile({ __shortToken, __device }) {
    const { userId } = __shortToken;
}
```

**Available middleware:**

| Parameter      | Injects                        | Notes                          |
|----------------|-------------------------------|--------------------------------|
| `__shortToken` | Decoded short JWT payload      | Protected resource auth        |
| `__token`      | Decoded short JWT payload      | Alias for `__shortToken`       |
| `__device`     | `{ ip, agent }`                | Injected on every request      |
| `__headers`    | `req.headers`                  |                                |
| `__query`      | `req.query`                    |                                |
| `__params`     | `req.params`                   |                                |
| `__files`      | `req.files`                    | Multipart file uploads         |

`req.body` fields are injected directly as plain parameters (no `__` prefix).

### Request Validation

Each entity has a `<name>.schema.js` file. Schemas are auto-discovered and compiled into validators available as `validators.<name>.<fnName>(data)`.

```js
// managers/entities/user/user.schema.js
module.exports = {
    createUser: [
        { model: 'username', required: true },
        { model: 'email',    required: true },
        { model: 'password', required: true },
    ],
}
```

Field types are defined in `managers/_common/schema.models.js`.

### Response Models

Each entity has a `<name>.res.js` file that declares the shape of the `data` object returned by each function. The framework strips any undeclared fields before the response is sent.

```js
// managers/entities/user/user.res.js
module.exports = {
    createUser: {
        user: {
            _id:       { model: 'id' },
            username:  { model: 'username' },
            email:     { model: 'email' },
        },
        longToken: { type: 'string' },
    },
}
```

Field definitions:
- `{ model: 'x' }` — reference a type from `schema.models.js`
- `{ type: 'string' }` — inline primitive
- `{ type: 'array', items: { ... } }` — array
- Plain nested object — nested response model

Response models are also used to generate the OpenAPI spec automatically.

### Role-Based Access Control

Managers declare which roles may call each method via `this.roles`:

```js
this.roles = {
    createSchool: [ROLES.SUPERADMIN],
    getSchool:    [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
};
```

The `__role` middleware reads this map at request time and returns `403` if the caller's role is not listed. Methods without a `roles` entry are accessible to any authenticated caller.

Roles: `superadmin`, `schoolAdmin`.

School admins are additionally ownership-scoped — their JWT embeds their `school` ID and each manager checks it against the requested resource.

---

### Rate Limiting

The `__rateLimit` middleware enforces per-endpoint request limits backed by Redis. It uses a **fixed-window counter** — a single atomic `HINCRBY` per request, no external library.

**Enabling rate limiting on a method — two steps:**

**1.** Add `__rateLimit` to the method signature (order controls when it runs relative to other middleware):

```js
async createSchool({ __token, __role, __rateLimit, name, code }) { ... }
```

**2.** Add the endpoint to `this.rateLimits` in the constructor:

```js
this.rateLimits = {
    createSchool: { window: 60, max: 20 },  // 20 req / 60s per user
};
```

No registration or imports needed. The framework discovers `rateLimits` automatically.

**Identifier** — authenticated requests are limited per `userId`; unauthenticated requests (e.g. `login`) are limited per `ip`.

**Redis key format:**
```
rl:{identifier}:{moduleName}:{fnName}:{windowSlot}
```

Each window slot is `Math.floor(Date.now() / windowMs)`, so keys roll over automatically and are cleaned up via TTL.

**Response headers** set on every rate-limited endpoint:

| Header | Value |
|---|---|
| `X-RateLimit-Limit` | Configured `max` |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

Exceeding the limit returns **HTTP 429** `rate_limit_exceeded`. If Redis is unavailable the middleware **fails open** — requests pass through and the error is logged.

**Default limits by category:**

| Category | Window | Max |
|---|---|---|
| `login` | 60s | 5 |
| `setupSuperadmin` | 60s | 3 |
| `delete*` | 60s | 10 |
| `create*` / `update*` | 60s | 20–30 |
| `get*` (reads) | 60s | 60 |

---

### Audit Logging

All mutating operations write a non-blocking entry to the `AuditLog` collection via `managers.auditLog.log(...)`. Failures are swallowed so a cache/DB issue never fails the primary request.

Each entry captures: `actor` (userId), `action`, `resource`, `resourceId`, `changes.before`, `changes.after`.

Actions: `create`, `update`, `delete`, `approve`, `reject`, `transfer`.
Resources: `school`, `classroom`, `student`, `transferRequest`, `user`.

---

### Standard Response Envelope

All responses follow this shape:

```json
{
    "ok":      true,
    "data":    {},
    "errors":  [],
    "message": ""
}
```

Return `{ error: 'message' }` from a function for a `400`. Return `{ errors: [...] }` for validation errors. Anything else is treated as success and placed in `data`.

---

## Initial Superadmin Setup

The first superadmin must be created via a one-time endpoint that disables itself after use.

**Endpoint:** `POST /api/auth/setupSuperadmin`

**Request body:**
```json
{
  "firstname": "John",
  "lastname":  "Doe",
  "email":     "admin@example.com",
  "password":  "strongpassword"
}
```

**Success response:**
```json
{
  "ok": true,
  "data": {
    "user": {
      "_id":       "...",
      "firstname": "John",
      "lastname":  "Doe",
      "email":     "admin@example.com",
      "role":      "superadmin"
    }
  }
}
```

> Once a superadmin exists, all subsequent calls to this endpoint return `404`.
> Use `POST /api/auth/login` to obtain tokens after setup.
