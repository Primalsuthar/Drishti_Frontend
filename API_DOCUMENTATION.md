# Drishti API Documentation

Welcome to the Drishti backend API! This document outlines all available endpoints, required payloads, and exactly how the frontend should handle responses and errors.

---

## 🚨 Global Error Handling & Axios Interceptors

> **HTTP-Only Cookies (Zero JS Token Handling)**  
> This backend uses maximum security **HTTP-Only Cookies** for session management. 
> 
> **CRITICAL**: For every single API request, you **must** configure your HTTP client to send credentials:
> - **Axios**: `axios.defaults.withCredentials = true;`
> - **Fetch API**: `{ credentials: 'include' }`

### How to handle `401 Unauthorized` (Token Expiry)
Since access tokens expire every 1 hour, requests will eventually fail with a `401`. You must implement an **Axios Interceptor** to handle this silently:
1. When a request fails with `401`, catch it.
2. Pause any other outgoing requests (put them in a queue).
3. Call `PUT /auth/tokens`. The browser will automatically send the `refreshToken` cookie.
4. If it succeeds, resolve your queued requests and automatically retry the original failed request.
5. **If `PUT /auth/tokens` also fails with 401**, the user's entire session is expired. You must clear your local React/Vue state and redirect them to the `/login` page.

### Common HTTP Status Codes
- **400 Bad Request**: You missed a required field or sent invalid data. Check your payload.
- **401 Unauthorized**: Missing/expired token, or incorrect password.
- **403 Forbidden**: The user is logged in, but their `role` restricts them from doing this (e.g. Staff trying to hit an Admin endpoint). Show an "Access Denied" UI.
- **404 Not Found**: The ID (user or record) you requested does not exist in the database.
- **409 Conflict**: Trying to create something that already exists (e.g. Duplicate User ID).

---

## 🛡️ 1. Authentication Endpoints

### Login
- **URL**: `POST /auth/login`
- **Auth Required**: No
- **Payload** (JSON): `{"id": "user_123", "password": "..."}`
- **Success Response** (200 OK):
  ```json
  { "id": "user_123", "name": "John Doe", "role": "admin" }
  ```
- **Frontend Action**: The browser automatically saves the token cookies. Take this JSON response and save it to your Global State (Redux/Context) so the UI knows who is logged in and what features to show based on their `role`.
- **Errors**: `401` (Incorrect ID or Password). Show a red "Invalid Credentials" toast.

### Refresh Token (Silent Refresh)
- **URL**: `PUT /auth/tokens`
- **Auth Required**: Yes (Uses valid `refreshToken` cookie)
- **Frontend Action**: Only call this from your Axios Interceptor when another API call fails with `401`. Do not call this manually from UI buttons.

### Reset / Change Password
- **URL**: `PUT /auth/password/reset`
- **Auth Required**: No (Can be used for "Forgot Password" or standard resets)
- **Payload** (JSON):
  ```json
  {
    "id": "user_123",
    "newPassword": "new_secure_password",
    "oldPassword": "current_password", // Option 1
    "otp": "123456",                   // Option 2
    "backupCode": "xxxx-yyyy"          // Option 3
  }
  ```
- **Frontend Action**: If the user is logged in (Change Password), use Option 1. If they are locked out (Forgot Password), ask for their ID and use Option 2 or 3. On success (200), redirect them to the Login screen to log in with their new password.
- **Errors**: `401` (Invalid old password, incorrect OTP, or invalid backup code). Show "Verification failed" to the user.

### Generate TOTP (2FA Setup)
- **URL**: `POST /auth/totp`
- **Auth Required**: Yes
- **Success Response** (200 OK):
  ```json
  {
    "uri": "otpauth://totp/Drishti:John?secret=JBSWY3DPEHPK3PXP...",
    "secret": "JBSWY3DPEHPK3PXP..."
  }
  ```
- **Frontend Action**: 
  1. Pass the `uri` string into a QR Code library (like `qrcode.react`) to render a scannable QR code on the screen.
  2. Display the `secret` string as raw text below the QR code, so users who cannot scan can manually type the setup key into Google Authenticator.

### Generate Backup Codes
- **URL**: `POST /auth/backup-codes`
- **Auth Required**: Yes
- **Success Response** (200 OK):
  ```json
  { "backupCodes": ["code1", "code2", "code3", "code4", "code5"] }
  ```
- **Frontend Action**: Display these codes prominently. **Force the user to click a "Copy" or "Download" button.** Warn them that they will *never* see these codes again.

---

## 👥 2. Admin Endpoints

> **Role Required**: Only users with `role: 'admin'` can access these endpoints.

### Create User
- **URL**: `POST /admin/users`
- **Payload** (JSON): `{"id": "...", "name": "...", "password": "...", "role": "staff"}`
- **Frontend Action**: On success, append the returned user object to your local state list of users.
- **Errors**: `409 Conflict`. Warn the admin that "This User ID is already taken".

### Delete User
- **URL**: `DELETE /admin/users/:id`
- **Auth Required**: Yes (Admin only)
- **Frontend Action**: Send the exact user `id` in the URL parameter. On success (200 OK), remove the deleted user from your local state array so they instantly disappear from the UI table.
- **Errors**: `404 Not Found` if the user ID does not exist.

### Edit User
- **URL**: `PUT /admin/users/:id`
- **Auth Required**: Yes (Admin only)
- **Payload** (JSON): 
  ```json
  {
    "newName": "Updated Name", // Optional
    "newId": "new_user_123"    // Optional
  }
  ```
- **Description**: Admins can change a user's name or ID. Because of database cascades, if the `newId` is changed, all related data (like backup codes and TOTP secrets) will automatically update to link to the new ID!
- **Errors**: `404 Not Found` if the user ID does not exist. `409 Conflict` if the `newId` is already taken by someone else.

### Get Staff List
- **URL**: `GET /admin/users/staff`
- **Auth Required**: Yes (Admin only)
- **Success Response** (200 OK):
  ```json
  {
    "users": [
      { "id": "staff1", "name": "John Doe", "role": "staff", "createdAt": "..." }
    ]
  }
  ```

### Get Wholesaler List
- **URL**: `GET /admin/users/wholesalers`
- **Auth Required**: Yes (Admin only)
- **Success Response** (200 OK):
  ```json
  {
    "users": [
      { "id": "whole1", "name": "Jane Smith", "role": "wholesaler", "createdAt": "..." }
    ]
  }
  ```

### Edit Record (Admin God-Mode)
- **URL**: `PUT /admin/records/:id`
- **Description**: Admins can force-update any value of a record.
- **Payload Format**: `multipart/form-data`
  - **Required Field**: `id`
  - **Optional Fields**: `name`, `khokhaWeight`, `karigharFine`, `fineGoldWeight`, `secondGrossWeight`, `kundanPieces`, `stoneWeight`, `otherStuddedWeight`, `otherStuddedRemark`, `otherGoldWeight`, `otherGoldRemark`, `latwanWeight`, `thirdGrossWeight`
  - **Optional File**: `image` (binary file)
- **Frontend Action**: This is a powerful form. To clear a numeric value (set it to null), send an empty string `""` in the FormData for that specific field. On success, replace your local record data with the returned recalculated record.

---

## 🏭 3. Staff Manufacturing Endpoints

> **Weight Conversions:** Send all weights purely in **Grams**. The backend will multiply by 1000 and rigorously handle exact milligram conversion under the hood.

### Stage 0: Init Record
- **URL**: `POST /staff/records/init`
- **Payload**: None
- **Frontend Action**: Efficiently asks backend to securely generate a unique 5-digit numeric code. It initializes a row in the database, locks in the `createdAt` timestamp, and sets the stage to `ghat`.
- **Success Response** (201 Created):
  ```json
  { "message": "Record initialized", "record": { "id": "49102", "stage": "ghat" } }
  ```

### Stage 1: Ghat
- **URL**: `POST /staff/records/ghat`
- **Payload** (JSON): `{"id": "49102", "name": "Necklace", "khokhaWeight": 10.5}`
- **Frontend Action**: Updates the initialized record with its name and `khokhaWeight`, and pushes the stage to `kundan`.
- **Errors**: `404 Not Found`. Show "Record does not exist."

### Stage 2: Kundan
- **URL**: `PUT /staff/records/kundan`
- **Description**: Calculates `fineGoldWeight` (`karigharFine` / 1.07), `waxWeight`, and pushes stage to `final`.
- **Payload** (JSON):
  ```json
  {
    "id": "rec_001",
    "secondGrossWeight": 25.5,
    "karigharFine": 12.84,  // Optional. Backend will divide this by 1.07 to auto-calculate fineGoldWeight!
    "kundanPieces": 5,      // Optional
    "stoneWeight": 2.1      // Optional
  }
  ```
- **Frontend Action**: Ensure you only allow calling this if the record is currently in the `kundan` stage. On success, the backend will return the dynamically calculated `waxWeight` and `fineGoldWeight`. Update your UI to reflect this.

### Stage 3: Surrender
- **URL**: `PUT /staff/records/surrender`
- **Description**: Calculates `fuseWeight` and `netWeight`, pushes stage to `locked`, and uploads image to R2 CDN.
- **Payload Format**: `multipart/form-data`
  - **Required Fields**: `id`, `thirdGrossWeight`
  - **Optional Fields**: `otherStuddedWeight`, `otherStuddedRemark`, `otherGoldWeight`, `otherGoldRemark`, `latwanWeight`
  - **Optional File**: `image` (binary file)
- **Frontend Action**: On success, the backend returns the Cloudflare CDN `imageUrl` along with the finalized `fuseWeight` and `netWeight`. Render the image URL in an `<img src={imageUrl} />` tag and lock the UI so no further edits can be made by staff.

---

## 📦 4. General Record Endpoints

### Fetch All Records (Paginated)
- **URL**: `GET /records?limit=20&offset=0`
- **Auth Required**: Yes (`admin` and `staff` only)
- **Description**: Fetches a paginated list of all records, ordered by creation date descending. This endpoint is designed specifically to support infinity scrolling functionality on the frontend.
- **Success Response** (200 OK):
  ```json
  {
    "records": [
      {
        "id": "rec_01",
        "stage": "ghat",
        "createdAt": "2026-05-30T10:00:00.000Z",
        "khokhaWeight": 12.5,
        "netWeight": null
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "hasMore": true,
      "nextOffset": 20
    }
  }
  ```
- **Frontend Action**: 
  1. On initial load, call without parameters (defaults to `limit=20, offset=0`) or pass explicit values.
  2. Append the returned `records` array to your local UI state list.
  3. Check the `pagination.hasMore` boolean. If `true`, keep your infinity scroll listener active. Use the provided `pagination.nextOffset` value as the `offset` parameter for the next subsequent API call.

### Excel Sync / Export All
- **URL**: `GET /records/excel-sync?key=YOUR_SECRET_KEY`
- **Auth Required**: Secret Query Parameter (`key`)
- **Description**: This endpoint natively supports Microsoft Excel's "Data > From Web" tool by using a secret URL parameter. Just paste the URL with your `EXCEL_SYNC_KEY` into Excel.
- **Response Headers**: `Cache-Control: public, max-age=300` (Responses are cached for 5 minutes).
- **Success Response** (200 OK):
  ```json
  {
    "records": [
      {
        "id": "rec_01",
        "stage": "ghat",
        "createdAt": "2026-05-30T10:00:00.000Z",
        "khokhaWeight": 12.5,
        "netWeight": null
        // ... all other fields converted to grams
      }
    ]
  }
  ```

### Fetch Single Record
- **URL**: `GET /records/:id`
- **Auth Required**: Yes (Any Role)
- **Business Logic**: 
  - If the requesting user has `role: 'wholesaler'`, the backend will return `403 Forbidden` if the record stage is NOT `locked`.
  - Admins and Staff can view the record at any stage.
- **Success Response** (200 OK):
  ```json
  {
    "record": {
      "id": "rec_001",
      "stage": "locked",
      "khokhaWeight": 10.5,
      "imageUrl": "https://pub-xxxx.r2.dev/records/rec_001-1681234567.jpg"
    }
  }
  ```
- **Frontend Action**: 
  1. All weight data returned here is already converted back to **Grams (gm)** for easy frontend display! No extra math required.
  2. If the user is a `wholesaler`, attempting to fetch a record that is *not* `locked` will return a `403 Forbidden`. You should intercept this and show a polite message: "This item is still in manufacturing and cannot be viewed yet."
