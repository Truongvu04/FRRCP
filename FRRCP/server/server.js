const express = require("express");
const app = express();

const axios = require("axios");
const session = require("express-session");
const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config({ override: true });
const db = require("./db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const nodemailer = require("nodemailer");

// tạo thư mục uploads nếu chưa có
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// cấu hình multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Chỉ cho phép upload ảnh jpg, jpeg, png, webp"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

app.use("/uploads", express.static("uploads"));
app.use(cors());
app.use(express.json());

app.use(
  session({
    secret: process.env.JWT_SECRET || "social-login-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }),
);

function signLoginToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
}

function buildFrontendRedirect(
  user,
  token,
  redirectPath = "/",
  extraParams = {},
) {
  const base = process.env.FRONTEND_URL || "http://localhost:5173";

  const visibleEmail =
    user.email_source === "facebook_placeholder" ? "" : user.email || "";

  const params = new URLSearchParams({
    token,
    email: visibleEmail,
    role: user.role || "",
    userId: String(user.id),
    ...extraParams,
  });

  return `${base}${redirectPath}?${params.toString()}`;
}

async function ensureUsersEmailColumn() {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'email'`,
  );

  if (!Number(rows[0]?.total || 0)) {
    await db.query(
      `ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER avatar`,
    );
    console.log("✅ Added users.email column");
  }
}

async function ensureUsersFacebookEmailColumn() {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'facebook_email'`,
  );

  if (!Number(rows[0]?.total || 0)) {
    await db.query(
      `ALTER TABLE users ADD COLUMN facebook_email VARCHAR(255) NULL AFTER email`,
    );
    console.log("✅ Added users.facebook_email column");
  }
}

async function ensureUserProfileAccountStatusColumn() {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'user_profile'
       AND COLUMN_NAME = 'account_status'`,
  );

  if (!Number(rows[0]?.total || 0)) {
    await db.query(
      `ALTER TABLE user_profile
       ADD COLUMN account_status ENUM('active','inactive','temporary_locked')
       NOT NULL DEFAULT 'active'
       AFTER lng`,
    );
    console.log("✅ Added user_profile.account_status column");
  }
}

async function ensureUsersEmailSourceColumn() {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'email_source'`,
  );

  if (!Number(rows[0]?.total || 0)) {
    await db.query(
      `ALTER TABLE users ADD COLUMN email_source VARCHAR(20) NULL AFTER facebook_email`,
    );
    console.log("✅ Added users.email_source column");
  }
}

async function ensureEmailVerificationTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INT NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function ensureChangeEmailVerificationTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS change_email_verifications (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      new_email VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_id (user_id),
      KEY idx_new_email (new_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function ensurePasswordResetVerificationTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_verifications (
      id INT NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildSocialPlaceholderEmail(provider, providerId) {
  const safeProvider = String(provider || "social")
    .trim()
    .toLowerCase();
  const safeProviderId = String(providerId || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "");

  return `${safeProvider}_${safeProviderId}@${safeProvider}.local`;
}

function isPlaceholderSocialEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();

  return (
    normalized.endsWith("@facebook.local") ||
    normalized.endsWith("@social.local")
  );
}

const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendVerificationEmail(
  email,
  code,
  subject = "Xác minh tài khoản FRRP",
  title = "Xác minh email",
) {
  await mailTransporter.sendMail({
    from: `"FRRP" <${process.env.MAIL_USER}>`,
    to: email,
    subject,
    html: `
      <div style="
        margin:0;
        padding:0;
        background:#f5f5f7;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
        color:#1d1d1f;
      ">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="
                max-width:560px;
                background:#ffffff;
                border-radius:24px;
                overflow:hidden;
                box-shadow:0 8px 30px rgba(0,0,0,0.06);
              ">
                <tr>
                  <td style="padding:48px 40px 24px; text-align:center;">
                    <div style="
                      display:inline-block;
                      font-size:14px;
                      color:#6e6e73;
                      letter-spacing:0.2px;
                      margin-bottom:12px;
                    ">
                      FRRP
                    </div>

                    <h1 style="
                      margin:0;
                      font-size:30px;
                      line-height:1.2;
                      font-weight:600;
                      color:#1d1d1f;
                    ">
                      ${title}
                    </h1>

                    <p style="
                      margin:16px 0 0;
                      font-size:17px;
                      line-height:1.6;
                      color:#6e6e73;
                    ">
                      Sử dụng mã bên dưới để tiếp tục xác minh tài khoản của bạn.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 40px 8px; text-align:center;">
                    <div style="
                      display:inline-block;
                      background:#fbfbfd;
                      border:1px solid #e5e5e7;
                      border-radius:20px;
                      padding:20px 28px;
                      min-width:220px;
                    ">
                      <div style="
                        font-size:13px;
                        color:#86868b;
                        margin-bottom:10px;
                        letter-spacing:0.3px;
                      ">
                        Mã xác minh
                      </div>
                      <div style="
                        font-size:34px;
                        line-height:1;
                        font-weight:600;
                        letter-spacing:8px;
                        color:#000000;
                      ">
                        ${code}
                      </div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px 40px 12px; text-align:center;">
                    <p style="
                      margin:0;
                      font-size:15px;
                      line-height:1.6;
                      color:#6e6e73;
                    ">
                      Mã này sẽ hết hạn sau <strong style="color:#1d1d1f;">5 phút</strong>.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 40px 40px; text-align:center;">
                    <p style="
                      margin:0;
                      font-size:14px;
                      line-height:1.6;
                      color:#86868b;
                    ">
                      Nếu bạn không yêu cầu xác minh, bạn có thể bỏ qua email này.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="
                    border-top:1px solid #ededf0;
                    background:#ffffff;
                    padding:20px 32px 28px;
                    text-align:center;
                  ">
                    <p style="
                      margin:0;
                      font-size:12px;
                      line-height:1.6;
                      color:#a1a1a6;
                    ">
                      © 2026 FRRP. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>

              <div style="
                max-width:560px;
                margin-top:14px;
                text-align:center;
                font-size:12px;
                color:#a1a1a6;
                line-height:1.6;
              ">
                Email này được gửi tự động từ hệ thống FRRP.
              </div>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}

async function sendForgotPasswordEmail(email, code) {
  await sendVerificationEmail(
    email,
    code,
    "Mã xác minh đặt lại mật khẩu FRRP",
    "Đặt lại mật khẩu",
  );
}

async function findOrCreateSocialUser({
  provider,
  providerId,
  name,
  avatar,
  email,
}) {
  const [rows] = await db.query(
    "SELECT * FROM users WHERE provider=? AND provider_id=? LIMIT 1",
    [provider, providerId],
  );

  const socialEmail = email ? String(email).trim().toLowerCase() : null;
  const placeholderEmail = buildSocialPlaceholderEmail(provider, providerId);

  if (rows.length > 0) {
    const existingUser = rows[0];

    const currentEmail = existingUser.email
      ? String(existingUser.email).trim().toLowerCase()
      : "";
    const currentSource = existingUser.email_source || null;

    const updates = [];
    const values = [];

    if (provider === "facebook" && socialEmail) {
      updates.push("facebook_email=?");
      values.push(socialEmail);
    }

    if (socialEmail) {
      if (!currentEmail) {
        updates.push("email=?");
        values.push(socialEmail);
        updates.push("email_source=?");
        values.push("facebook");
      } else if (currentSource === "facebook" && currentEmail !== socialEmail) {
        updates.push("email=?");
        values.push(socialEmail);
        updates.push("email_source=?");
        values.push("facebook");
      } else if (
        currentSource === "facebook_placeholder" &&
        currentEmail !== socialEmail
      ) {
        updates.push("email=?");
        values.push(socialEmail);
        updates.push("email_source=?");
        values.push("facebook");
      }
    } else {
      if (!currentEmail) {
        updates.push("email=?");
        values.push(placeholderEmail);
        updates.push("email_source=?");
        values.push("facebook_placeholder");
      }
    }

    if (!existingUser.avatar && avatar) {
      updates.push("avatar=?");
      values.push(avatar);
    }

    if (updates.length > 0) {
      values.push(existingUser.id);
      await db.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id=?`,
        values,
      );
    }

    const [updatedUser] = await db.query(
      "SELECT * FROM users WHERE id=? LIMIT 1",
      [existingUser.id],
    );

    return {
      user: updatedUser[0],
      isNewUser: false,
    };
  }

  const mainEmail = socialEmail || placeholderEmail;
  const facebookEmail =
    provider === "facebook" && socialEmail ? socialEmail : null;
  const emailSource = socialEmail ? "facebook" : "facebook_placeholder";

  const [insertResult] = await db.query(
    `INSERT INTO users
      (password, role, provider, provider_id, avatar, email, facebook_email, email_source)
     VALUES (NULL, 'user', ?, ?, ?, ?, ?, ?)`,
    [
      provider,
      providerId || null,
      avatar || null,
      mainEmail,
      facebookEmail,
      emailSource,
    ],
  );

  const userId = insertResult.insertId;

  await db.query(
    `INSERT INTO user_profile (user_id, full_name, phone, address)
   VALUES (?, ?, NULL, '')`,
    [userId, name || mainEmail],
  );

  const [newUser] = await db.query("SELECT * FROM users WHERE id=? LIMIT 1", [
    userId,
  ]);

  return {
    user: newUser[0],
    isNewUser: true,
  };
}

/* ==============================
   NOTIFICATION INFRASTRUCTURE
============================== */

const notificationClients = new Set();
let notificationsInitialized = false;

setInterval(() => {
  notificationClients.forEach((client) => {
    client.res.write(`event: ping\n`);
    client.res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  });
}, 25000);

const sanitizeText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const normalizeRole = (value) => {
  const role = sanitizeText(value).toLowerCase();
  if (role === "rescue") return "rescuer";
  return role;
};

const GOONG_API_KEY =
  process.env.GOONG_API_KEY || process.env.VITE_GOONG_API_KEY || "";

const provinceNameCache = new Map();

const normalizeProvinceName = (value) => {
  const text = sanitizeText(value);
  if (!text) return "Chưa xác định";
  return text.replace(/\s+/g, " ");
};

const extractProvinceFromAddress = (address) => {
  const text = sanitizeText(address);
  if (!text) return null;

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const candidate = parts[parts.length - 1];
  if (/^-?\d+(?:\.\d+)?$/.test(candidate)) return null;
  if (/^\d{1,3}\.\d{4,}$/.test(candidate)) return null;

  return normalizeProvinceName(candidate);
};

const vnProvinceCentroids = [
  { name: "Thành phố Hà Nội", lat: 21.0285, lng: 105.8542 },
  { name: "Thành phố Hải Phòng", lat: 20.8449, lng: 106.6881 },
  { name: "Thành phố Đà Nẵng", lat: 16.0544, lng: 108.2022 },
  { name: "Thành phố Hồ Chí Minh", lat: 10.8231, lng: 106.6297 },
  { name: "Thành phố Cần Thơ", lat: 10.0452, lng: 105.7469 },
  { name: "Thành phố Huế", lat: 16.4637, lng: 107.5909 },
  { name: "Quảng Ninh", lat: 21.0064, lng: 107.2925 },
  { name: "Nghệ An", lat: 19.2342, lng: 104.92 },
  { name: "Thanh Hóa", lat: 19.8067, lng: 105.7852 },
  { name: "Hà Tĩnh", lat: 18.3559, lng: 105.8877 },
  { name: "Quảng Bình", lat: 17.4689, lng: 106.6223 },
  { name: "Quảng Trị", lat: 16.7403, lng: 107.1855 },
  { name: "Quảng Nam", lat: 15.5394, lng: 108.0191 },
  { name: "Quảng Ngãi", lat: 15.1214, lng: 108.8044 },
  { name: "Bình Định", lat: 13.7829, lng: 109.2196 },
  { name: "Phú Yên", lat: 13.0882, lng: 109.0929 },
  { name: "Khánh Hòa", lat: 12.2585, lng: 109.0526 },
  { name: "Lâm Đồng", lat: 11.5753, lng: 108.1429 },
  { name: "Đắk Lắk", lat: 12.71, lng: 108.2378 },
  { name: "Gia Lai", lat: 13.8079, lng: 108.1094 },
  { name: "Kon Tum", lat: 14.3497, lng: 108.0005 },
  { name: "Bình Dương", lat: 11.3254, lng: 106.477 },
  { name: "Đồng Nai", lat: 10.9453, lng: 106.824 },
  { name: "Bà Rịa - Vũng Tàu", lat: 10.5417, lng: 107.2429 },
  { name: "Bình Thuận", lat: 10.9804, lng: 108.2615 },
  { name: "Ninh Thuận", lat: 11.5653, lng: 108.9886 },
  { name: "Long An", lat: 10.6956, lng: 106.2431 },
  { name: "Tiền Giang", lat: 10.4493, lng: 106.342 },
  { name: "Bến Tre", lat: 10.2434, lng: 106.3756 },
  { name: "Vĩnh Long", lat: 10.253, lng: 105.9722 },
  { name: "Đồng Tháp", lat: 10.4938, lng: 105.6882 },
  { name: "An Giang", lat: 10.5216, lng: 105.1259 },
  { name: "Kiên Giang", lat: 10.0125, lng: 105.0809 },
  { name: "Cà Mau", lat: 9.1527, lng: 105.1961 },
  { name: "Bạc Liêu", lat: 9.294, lng: 105.7244 },
  { name: "Sóc Trăng", lat: 9.6025, lng: 105.9739 },
  { name: "Trà Vinh", lat: 9.8127, lng: 106.2993 },
  { name: "Hậu Giang", lat: 9.7579, lng: 105.6413 },
  { name: "Ninh Bình", lat: 20.2506, lng: 105.9745 },
];

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const getNearestProvinceFromCoordinate = (lat, lng) => {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    vnProvinceCentroids.length === 0
  ) {
    return null;
  }

  let bestProvince = vnProvinceCentroids[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const province of vnProvinceCentroids) {
    const distance = haversineKm(lat, lng, province.lat, province.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProvince = province;
    }
  }

  return bestProvince?.name || null;
};

const getProvinceFromGoongReverse = async (lat, lng) => {
  if (!GOONG_API_KEY || !Number.isFinite(lat) || !Number.isFinite(lng))
    return null;

  const cacheKey = `${lat},${lng}`;
  if (provinceNameCache.has(cacheKey)) {
    return provinceNameCache.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(
        `https://rsapi.goong.io/Geocode?latlng=${lat},${lng}&api_key=${GOONG_API_KEY}`,
      );

      if (!response.ok) return null;

      const data = await response.json();
      const firstResult = Array.isArray(data?.results) ? data.results[0] : null;
      const components = Array.isArray(firstResult?.address_components)
        ? firstResult.address_components
        : [];

      const level1 = components.find(
        (component) =>
          Array.isArray(component?.types) &&
          component.types.includes("administrative_area_level_1"),
      );
      const level2 = components.find(
        (component) =>
          Array.isArray(component?.types) &&
          component.types.includes("administrative_area_level_2"),
      );

      const candidate = level1?.long_name || level2?.long_name || null;
      return candidate ? normalizeProvinceName(candidate) : null;
    } catch {
      return null;
    }
  })();

  provinceNameCache.set(cacheKey, requestPromise);
  return requestPromise;
};

const resolveProvinceName = async (row) => {
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const provinceFromCoords = await getProvinceFromGoongReverse(lat, lng);
    if (provinceFromCoords) return provinceFromCoords;

    const nearestProvince = getNearestProvinceFromCoordinate(lat, lng);
    if (nearestProvince) return nearestProvince;
  }

  const provinceFromAddress = extractProvinceFromAddress(row?.address);
  if (provinceFromAddress) return provinceFromAddress;

  return "Chưa xác định";
};

const safeJsonParse = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const ensureNotificationColumn = async (columnName, definition) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'notifications'
       AND COLUMN_NAME = ?`,
    [columnName],
  );

  if (!Number(rows[0]?.total || 0)) {
    await db.query(`ALTER TABLE notifications ADD COLUMN ${definition}`);
  }
};

const initNotificationsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(80) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'info',
      title VARCHAR(255) NOT NULL,
      description TEXT,
      actor_user_id INT NULL,
      actor_name VARCHAR(120) NULL,
      actor_role VARCHAR(40) NULL,
      rescue_id INT NULL,
      recipient_role VARCHAR(20) NULL,
      recipient_user_id INT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_created_at (created_at),
      INDEX idx_notifications_event_type (event_type),
      INDEX idx_notifications_actor_user_id (actor_user_id),
      INDEX idx_notifications_recipient_role (recipient_role),
      INDEX idx_notifications_recipient_user_id (recipient_user_id),
      INDEX idx_notifications_rescue_id (rescue_id)
    )
  `);

  await ensureNotificationColumn(
    "recipient_role",
    "recipient_role VARCHAR(20) NULL",
  );
  await ensureNotificationColumn(
    "recipient_user_id",
    "recipient_user_id INT NULL",
  );
  notificationsInitialized = true;
};

const ensureNotificationsTable = async () => {
  if (notificationsInitialized) return;
  await initNotificationsTable();
};

const normalizeNotificationRow = (row) => ({
  id: Number(row.id),
  event_type: sanitizeText(row.event_type),
  severity: sanitizeText(row.severity, "info"),
  title: sanitizeText(row.title),
  description: sanitizeText(row.description),
  actor_user_id:
    row.actor_user_id === null || row.actor_user_id === undefined
      ? null
      : Number(row.actor_user_id),
  actor_name: sanitizeText(row.actor_name),
  actor_role: sanitizeText(row.actor_role),
  rescue_id:
    row.rescue_id === null || row.rescue_id === undefined
      ? null
      : Number(row.rescue_id),
  recipient_role: normalizeRole(row.recipient_role),
  recipient_user_id:
    row.recipient_user_id === null || row.recipient_user_id === undefined
      ? null
      : Number(row.recipient_user_id),
  metadata:
    typeof row.metadata === "string"
      ? safeJsonParse(row.metadata, null)
      : row.metadata || null,
  created_at: row.created_at,
});

const canViewNotification = (notification, user) => {
  if (!notification || !user) return false;

  const role = normalizeRole(user.role);
  const userId = Number(user.id || user.userId || 0);
  const recipientRole = normalizeRole(notification.recipient_role);
  const recipientUserId =
    notification.recipient_user_id === null ||
    notification.recipient_user_id === undefined
      ? null
      : Number(notification.recipient_user_id);

  const excludedUserId =
    notification.metadata &&
    typeof notification.metadata === "object" &&
    notification.metadata.excluded_user_id !== undefined
      ? Number(notification.metadata.excluded_user_id)
      : null;

  if (excludedUserId !== null && excludedUserId === userId) return false;
  if (recipientUserId !== null) return recipientUserId === userId;
  if (recipientRole === "all") return true;
  if (recipientRole && recipientRole === role) return true;

  return false;
};

const isRecommendationNotificationActive = async (notification) => {
  if (!notification) return false;
  if (notification.event_type !== "rescuer_sos_recommendation") return true;

  const rescueId = Number(notification.rescue_id || 0);
  if (!rescueId) return false;

  const [rows] = await db.query(
    `
    SELECT id, status, handled_by
    FROM rescues
    WHERE id = ?
    LIMIT 1
    `,
    [rescueId],
  );

  if (rows.length === 0) return false;

  const rescue = rows[0];
  const status = sanitizeText(rescue.status).toLowerCase();
  const handledBy =
    rescue.handled_by === null || rescue.handled_by === undefined
      ? null
      : Number(rescue.handled_by);

  return status === "new" && handledBy === null;
};

const sendSSE = (client, payload) => {
  client.res.write(`event: notification\n`);
  client.res.write(`data: ${JSON.stringify(payload)}\n\n`);

  if (typeof client.res.flush === "function") {
    client.res.flush();
  }
};

const getActorSummary = async (userId, fallbackRole = "") => {
  if (!userId) {
    return {
      actorName: "Hệ thống",
      actorRole: sanitizeText(fallbackRole),
    };
  }

  const [rows] = await db.query(
    `
    SELECT 
      u.email,
      u.role,
      up.full_name AS user_full_name,
      ap.full_name AS admin_full_name,
      rp.full_name AS rescuer_full_name
    FROM users u
    LEFT JOIN user_profile up ON u.id = up.user_id
    LEFT JOIN admin_profile ap ON u.id = ap.user_id
    LEFT JOIN rescuer_profile rp ON u.id = rp.user_id
    WHERE u.id=? 
    LIMIT 1
    `,
    [userId],
  );

  if (rows.length === 0) {
    return {
      actorName: `User #${userId}`,
      actorRole: sanitizeText(fallbackRole),
    };
  }

  const row = rows[0];
  const displayName =
    row.user_full_name ||
    row.admin_full_name ||
    row.rescuer_full_name ||
    (isPlaceholderSocialEmail(row.email) ? `User #${userId}` : row.email);

  return {
    actorName: sanitizeText(displayName, `User #${userId}`),
    actorRole: sanitizeText(row.role, sanitizeText(fallbackRole)),
  };
};

const logNotification = async ({
  eventType,
  severity = "info",
  title,
  description = "",
  actorUserId = null,
  actorName = "",
  actorRole = "",
  rescueId = null,
  recipientRole = "admin",
  recipientUserId = null,
  metadata = null,
}) => {
  try {
    await ensureNotificationsTable();

    const [insertResult] = await db.query(
      `INSERT INTO notifications
       (event_type, severity, title, description, actor_user_id, actor_name, actor_role, rescue_id, recipient_role, recipient_user_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizeText(eventType, "system_event"),
        sanitizeText(severity, "info"),
        sanitizeText(title, "Sự kiện hệ thống"),
        sanitizeText(description),
        actorUserId,
        sanitizeText(actorName),
        sanitizeText(actorRole),
        rescueId,
        normalizeRole(recipientRole || "admin"),
        recipientUserId,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );

    const [rows] = await db.query(
      "SELECT * FROM notifications WHERE id=? LIMIT 1",
      [insertResult.insertId],
    );

    if (rows.length === 0) return;

    const normalized = normalizeNotificationRow(rows[0]);

    const recommendationStillActive =
      normalized.event_type === "rescuer_sos_recommendation"
        ? await isRecommendationNotificationActive(normalized)
        : true;

    notificationClients.forEach((client) => {
      if (!recommendationStillActive) return;

      if (canViewNotification(normalized, client)) {
        sendSSE(client, normalized);
      }
    });
  } catch (error) {
    console.error("[notifications] logNotification error:", error);
  }
};

const logMultiNotification = async (entries) => {
  for (const entry of entries) {
    await logNotification(entry);
  }
};

const authStreamMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;
  const tokenFromQuery = sanitizeText(req.query.token, "");
  const token = tokenFromHeader || tokenFromQuery;

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
};

/* ==============================
   AUTH MIDDLEWARE
============================== */

const getRescuerAccountStatus = async (userId) => {
  if (!userId) return null;

  const [rows] = await db.query(
    "SELECT account_status FROM rescuer_profile WHERE user_id=? LIMIT 1",
    [userId],
  );

  if (rows.length === 0) return null;
  return sanitizeText(rows[0].account_status, "active");
};

const getCitizenAccountStatus = async (userId) => {
  if (!userId) return "active";

  const [rows] = await db.query(
    "SELECT account_status FROM user_profile WHERE user_id=? LIMIT 1",
    [userId],
  );

  if (rows.length === 0) return "active";

  return sanitizeText(rows[0].account_status, "active");
};

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    const normalizedRole = normalizeRole(decoded.role);

    if (normalizedRole === "rescuer") {
      const accountStatus =
        (await getRescuerAccountStatus(decoded.id)) || "active";

      req.rescuerAccountStatus = accountStatus;

      if (accountStatus === "inactive") {
        return res.status(403).json({
          code: "ACCOUNT_INACTIVE",
          message:
            "Tài khoản đội cứu hộ đã bị khóa. Bạn đã bị đăng xuất khỏi hệ thống.",
        });
      }
    }

    if (normalizedRole === "user") {
      const citizenAccountStatus =
        (await getCitizenAccountStatus(decoded.id)) || "active";

      req.citizenAccountStatus = citizenAccountStatus;

      if (citizenAccountStatus === "inactive") {
        return res.status(403).json({
          code: "ACCOUNT_INACTIVE",
          message:
            "Tài khoản của bạn đã bị khóa. Bạn không thể tiếp tục sử dụng hệ thống.",
        });
      }
    }

    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid token" });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

/* ==============================
   NOTIFICATIONS API
============================== */

app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    await ensureNotificationsTable();

    const role = normalizeRole(req.user.role);
    const roleAlias = role === "rescuer" ? "rescue" : role;
    const userId = Number(req.user.id || 0);

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE (recipient_user_id IS NOT NULL AND recipient_user_id = ?)
          OR (recipient_user_id IS NULL AND (recipient_role = 'all' OR recipient_role IN (?, ?)))
       ORDER BY id DESC
       LIMIT ?`,
      [userId, role, roleAlias, Math.max(limit * 3, 150)],
    );

    const normalized = rows.map(normalizeNotificationRow);

    const visible = [];
    for (const item of normalized) {
      const canView = canViewNotification(item, { id: userId, role });
      if (!canView) continue;

      const isActive = await isRecommendationNotificationActive(item);
      if (!isActive) continue;

      visible.push(item);

      if (visible.length >= limit) break;
    }

    res.json(visible);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/notifications/stream", authStreamMiddleware, async (req, res) => {
  await ensureNotificationsTable();

  const role = normalizeRole(req.user.role);
  const userId = Number(req.user.id || 0);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  res.write(": connected\n\n");

  const client = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    userId,
    res,
  };

  notificationClients.add(client);

  res.write(`event: connected\n`);
  res.write(
    `data: ${JSON.stringify({
      ok: true,
      role,
      userId,
      connectedAt: new Date().toISOString(),
    })}\n\n`,
  );

  req.on("close", () => {
    notificationClients.delete(client);
  });
});

/* ==============================
   RESCUE API
============================== */

app.get("/api/rescues/:id", authMiddleware, async (req, res) => {
  try {
    const rescueId = Number(req.params.id);

    if (!rescueId) {
      return res.status(400).json({ message: "Mã SOS không hợp lệ" });
    }

    const [rows] = await db.query(
      `
      SELECT
        r.*,
        rp.lat AS rescuer_lat,
        rp.lng AS rescuer_lng,
        rp.full_name AS rescuer_name,
        rp.phone AS rescuer_phone,
        rp.status AS rescuer_status
      FROM rescues r
      LEFT JOIN rescuer_profile rp
        ON r.handled_by = rp.user_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [rescueId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu cứu hộ" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/rescues", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.*,
        rp.lat AS rescuer_lat,
        rp.lng AS rescuer_lng,
        rp.full_name AS rescuer_name,
        rp.phone AS rescuer_phone,
        rp.status AS rescuer_status
      FROM rescues r
      LEFT JOIN rescuer_profile rp
        ON r.handled_by = rp.user_id
      ORDER BY r.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post(
  "/api/rescues",
  authMiddleware,
  upload.fields([{ name: "images", maxCount: 2 }]),
  async (req, res) => {
    try {
      if (normalizeRole(req.user.role) !== "user") {
        return res.status(403).json({
          message: "Chỉ người dân mới được gửi yêu cầu SOS",
        });
      }

      const citizenAccountStatus =
        req.citizenAccountStatus ||
        (await getCitizenAccountStatus(req.user.id)) ||
        "active";

      if (citizenAccountStatus === "temporary_locked") {
        return res.status(423).json({
          code: "ACCOUNT_TEMPORARY_LOCKED",
          message:
            "Tài khoản của bạn đang bị khóa tạm thời. Không thể gửi yêu cầu SOS mới cho đến khi được quản trị viên mở khóa.",
        });
      }

      const {
        name,
        phone,
        lat,
        lng,
        address,
        victims,
        note,
        source_url,
        sos_type,
      } = req.body;

      const user_id = req.user.id;
      const allowedTypes = ["rescue", "supplies", "vehicle", "other"];

      let finalSosType = (sos_type || "").toString().trim().toLowerCase();
      if (!allowedTypes.includes(finalSosType)) {
        finalSosType = "other";
      }

      // console.log("👉 sos_type nhận:", sos_type);
      // console.log("👉 sos_type lưu:", finalSosType);

      const imagePaths = (req.files?.images || []).map(
        (file) => "/uploads/" + file.filename,
      );

      const [insertResult] = await db.query(
        `INSERT INTO rescues
        (name, phone, lat, lng, address, victims, note, source_url, images, status, user_id, sos_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          phone,
          lat,
          lng,
          address,
          victims,
          note,
          source_url,
          JSON.stringify(imagePaths),
          "new",
          user_id,
          finalSosType,
        ],
      );

      const actor = await getActorSummary(user_id, req.user.role);

      await logNotification({
        eventType: "user_sos_created",
        severity: "info",
        title: `Yêu cầu đã gửi`,
        description: `Yêu cầu SOS #${insertResult.insertId} của bạn đã được gửi thành công.`,
        actorUserId: user_id,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        rescueId: Number(insertResult.insertId),
        recipientRole: "user",
        recipientUserId: Number(user_id),
        metadata: {
          action: "created",
          sos_type: finalSosType,
          victims: Number(victims) || 1,
        },
      });

      const createdRescue = {
        id: Number(insertResult.insertId),
        lat: Number(lat),
        lng: Number(lng),
        address: sanitizeText(address),
        victims: Number(victims) || 1,
        sos_type: finalSosType,
        note: sanitizeText(note),
      };

      const recommendedTeams =
        await getRecommendedRescuersForSOS(createdRescue);

      console.log("📣 SOS mới:", createdRescue.id);
      console.log(
        "📣 Recommended teams:",
        recommendedTeams.map((t) => ({
          user_id: t.user_id,
          full_name: t.full_name,
          totalScore: t.totalScore,
          distanceText: t.distanceText,
          etaText: t.etaText,
          activeTasks: t.activeTasks,
          status: t.status,
        })),
      );

      for (let index = 0; index < recommendedTeams.length; index++) {
        const team = recommendedTeams[index];

        await logNotification({
          eventType: "rescuer_sos_recommendation",
          severity: "info",
          title: `Gợi ý yêu cầu phù hợp cho đội`,
          description: `SOS #${createdRescue.id} cách đội bạn ${team.distanceText || "không rõ"} • dự kiến ${team.etaText || "không rõ"} • ưu tiên ${team.totalScore} điểm.`,
          actorUserId: user_id,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          rescueId: Number(createdRescue.id),
          recipientRole: "rescuer",
          recipientUserId: Number(team.user_id),
          metadata: {
            action: "recommend_sos",
            recommendation_rank: index + 1,
            score: team.totalScore,
            distance_km: Number(team.distanceKm?.toFixed?.(3) || 0),
            distance_text: team.distanceText,
            eta_text: team.etaText,
            active_tasks: team.activeTasks,
            avg_response_minutes: team.avgResponseMinutes,
            avg_completion_minutes: team.avgCompletionMinutes,
            team_name: team.full_name,
            team_status: team.status,
            victims: createdRescue.victims,
            sos_type: createdRescue.sos_type,
            address: createdRescue.address,
            note: sanitizeText(note),
            score_breakdown: team.scoreBreakdown,
          },
        });
      }

      res.json({ message: "SOS created" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/* UPDATE RESCUE STATUS */
app.patch("/api/rescues/:id/status", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body || {};
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!["rescuer", "rescue", "admin"].includes(userRole)) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật trạng thái cứu hộ",
      });
    }

    if (!["new", "rescuing", "done", "cancel"].includes(status)) {
      return res.status(400).json({
        message: "Trạng thái không hợp lệ",
      });
    }

    const [rows] = await db.query("SELECT * FROM rescues WHERE id=?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu cứu hộ" });
    }

    const rescue = rows[0];

    if (rescue.status === "cancel") {
      return res.status(400).json({
        message: "Yêu cầu này đã bị hủy",
      });
    }

    let assignedTeam = "Đội cứu hộ";
    if (rescue.handled_by) {
      const [rescuerRows] = await db.query(
        "SELECT full_name FROM rescuer_profile WHERE user_id=? LIMIT 1",
        [rescue.handled_by],
      );
      if (rescuerRows.length > 0 && rescuerRows[0].full_name) {
        assignedTeam = rescuerRows[0].full_name;
      }
    }

    const actor = await getActorSummary(userId, userRole);

    // 1) Nhận nhiệm vụ: new -> rescuing
    if (status === "rescuing") {
      if (["rescuer", "rescue"].includes(userRole)) {
        const rescuerAccountStatus =
          req.rescuerAccountStatus ||
          (await getRescuerAccountStatus(userId)) ||
          "active";

        if (rescuerAccountStatus === "temporary_locked") {
          return res.status(403).json({
            code: "ACCOUNT_TEMPORARY_LOCKED",
            message:
              "Tài khoản của đội đang bị khóa tạm thời. Bạn được hoàn thành các yêu cầu đã nhận nhưng không thể nhận thêm yêu cầu mới. Vui lòng liên hệ quản trị viên.",
          });
        }
      }

      let currentTeamName = "Đội cứu hộ";
      const [rescuerRows] = await db.query(
        "SELECT full_name FROM rescuer_profile WHERE user_id=? LIMIT 1",
        [userId],
      );

      if (rescuerRows.length > 0 && rescuerRows[0].full_name) {
        currentTeamName = rescuerRows[0].full_name;
      }

      const conn = await db.getConnection();

      try {
        await conn.beginTransaction();

        const [lockedRows] = await conn.query(
          `SELECT id, status, handled_by, user_id
       FROM rescues
       WHERE id=?
       FOR UPDATE`,
          [id],
        );

        if (lockedRows.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            message: "Không tìm thấy yêu cầu cứu hộ",
          });
        }

        const lockedRescue = lockedRows[0];

        if (lockedRescue.status === "cancel") {
          await conn.rollback();
          return res.status(400).json({
            message: "Yêu cầu này đã bị hủy",
          });
        }

        if (lockedRescue.status !== "new" || lockedRescue.handled_by) {
          await conn.rollback();
          return res.status(409).json({
            code: "SOS_ALREADY_ACCEPTED",
            message: "Yêu cầu này đã được đội khác tiếp nhận!",
          });
        }

        const [updateResult] = await conn.query(
          `UPDATE rescues
       SET status='rescuing',
           assigned_team=?,
           received_at=NOW(),
           handled_by=?,
           completed_at=NULL
       WHERE id=?
         AND status='new'
         AND handled_by IS NULL`,
          [currentTeamName, userId, id],
        );

        if (!updateResult.affectedRows) {
          await conn.rollback();
          return res.status(409).json({
            code: "SOS_ALREADY_ACCEPTED",
            message: "Yêu cầu này đã được đội khác tiếp nhận!",
          });
        }

        // Nếu vẫn muốn giữ status đội để hiển thị thì giữ dòng này.
        // Nếu không muốn phụ thuộc busy/available nữa thì có thể bỏ.
        await conn.query(
          "UPDATE rescuer_profile SET status='busy' WHERE user_id=?",
          [userId],
        );

        await conn.commit();

        await logMultiNotification([
          {
            eventType: "rescuer_accept_sos",
            severity: "info",
            title: `Đội đã nhận yêu cầu`,
            description: `Đội của bạn đã nhận yêu cầu SOS #${id}.`,
            actorUserId: userId,
            actorName: currentTeamName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "rescuer",
            recipientUserId: Number(userId),
            metadata: {
              action: "accept",
              team_name: currentTeamName,
            },
          },
          {
            eventType: "user_sos_assigned",
            severity: "info",
            title: `Yêu cầu đã được đội cứu hộ nhận`,
            description: `Đội cứu hộ ${currentTeamName} đã nhận yêu cầu SOS #${id} của bạn.`,
            actorUserId: userId,
            actorName: currentTeamName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "user",
            recipientUserId: Number(lockedRescue.user_id),
            metadata: {
              action: "accept",
              team_name: currentTeamName,
            },
          },
        ]);
      } catch (error) {
        try {
          await conn.rollback();
        } catch {}
        throw error;
      } finally {
        conn.release();
      }
    }

    // 2) Trả lại nhiệm vụ: rescuing -> new
    if (status === "new") {
      if (rescue.status !== "rescuing") {
        return res.status(400).json({
          message: "Chỉ có thể hủy nhận khi đang cứu hộ",
        });
      }

      if (
        userRole !== "admin" &&
        Number(rescue.handled_by) !== Number(userId)
      ) {
        return res.status(403).json({
          message: "Bạn không phải người phụ trách",
        });
      }

      const reasonText = String(reason || "").trim();

      await db.query(
        `UPDATE rescues
     SET status=?, assigned_team=NULL, received_at=NULL, completed_at=NULL, handled_by=NULL
     WHERE id=?`,
        ["new", id],
      );

      if (rescue.handled_by) {
        const [activeRows] = await db.query(
          `SELECT COUNT(*) AS total
     FROM rescues
     WHERE handled_by=?
       AND status='rescuing'`,
          [rescue.handled_by],
        );

        const stillBusy = Number(activeRows[0]?.total || 0) > 0;

        await db.query("UPDATE rescuer_profile SET status=? WHERE user_id=?", [
          stillBusy ? "busy" : "available",
          rescue.handled_by,
        ]);
      }

      if (userRole === "admin") {
        await logMultiNotification([
          {
            eventType: "admin_returned_team_sos",
            severity: "warning",
            title: `Bạn vừa hủy nhận yêu cầu của đội cứu hộ`,
            description: `Bạn vừa hủy việc đội ${assignedTeam} nhận yêu cầu SOS #${id}${reasonText ? `: ${reasonText}` : ""}.`,
            actorUserId: userId,
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "admin",
            recipientUserId: Number(userId),
            metadata: {
              action: "admin_return",
              reason: reasonText || "",
              team_name: assignedTeam,
            },
          },
          {
            eventType: "admin_removed_team_from_sos",
            severity: "warning",
            title: `Admin đã hủy nhận yêu cầu của đội`,
            description: `Admin đã hủy việc đội của bạn nhận yêu cầu SOS #${id}${reasonText ? `: ${reasonText}` : ""}.`,
            actorUserId: userId,
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "rescuer",
            recipientUserId: Number(rescue.handled_by),
            metadata: {
              action: "admin_return",
              reason: reasonText || "",
              team_name: assignedTeam,
            },
          },
          {
            eventType: "admin_removed_team_from_user_sos",
            severity: "warning",
            title: `Admin đã hủy đội nhận yêu cầu`,
            description: `Admin đã hủy việc đội ${assignedTeam} nhận yêu cầu SOS #${id} của bạn${reasonText ? `: ${reasonText}` : ""}.`,
            actorUserId: userId,
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "user",
            recipientUserId: Number(rescue.user_id),
            metadata: {
              action: "admin_return",
              reason: reasonText || "",
              team_name: assignedTeam,
            },
          },
        ]);
      } else {
        await logMultiNotification([
          {
            eventType: "rescuer_return_sos",
            severity: "warning",
            title: `Đội đã hủy yêu cầu`,
            description: `Đội của bạn đã hủy nhận yêu cầu SOS #${id}${reasonText ? `: ${reasonText}` : ""}.`,
            actorUserId: userId,
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "rescuer",
            recipientUserId: Number(userId),
            metadata: {
              action: "return",
              reason: reasonText || "",
              team_name: assignedTeam,
            },
          },
          {
            eventType: "user_sos_returned",
            severity: "warning",
            title: `Đội cứu hộ đã hủy nhận yêu cầu`,
            description: `Đội cứu hộ ${assignedTeam} đã hủy nhận yêu cầu SOS #${id} của bạn${reasonText ? `: ${reasonText}` : ""}.`,
            actorUserId: userId,
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "user",
            recipientUserId: Number(rescue.user_id),
            metadata: {
              action: "return",
              reason: reasonText || "",
              team_name: assignedTeam,
            },
          },
        ]);
      }
    }

    // 3) Hoàn thành: rescuing -> done
    if (status === "done") {
      if (rescue.status !== "rescuing") {
        return res.status(400).json({
          message: "Chỉ có thể hoàn thành khi đang cứu hộ",
        });
      }

      if (
        userRole !== "admin" &&
        Number(rescue.handled_by) !== Number(userId)
      ) {
        return res.status(403).json({
          message: "Bạn không phải người phụ trách",
        });
      }

      await db.query(
        `UPDATE rescues
         SET status=?, completed_at=NOW()
         WHERE id=?`,
        ["done", id],
      );

      if (rescue.handled_by) {
        const [activeRows] = await db.query(
          `SELECT COUNT(*) AS total
     FROM rescues
     WHERE handled_by=?
       AND status='rescuing'`,
          [rescue.handled_by],
        );

        const stillBusy = Number(activeRows[0]?.total || 0) > 0;

        await db.query("UPDATE rescuer_profile SET status=? WHERE user_id=?", [
          stillBusy ? "busy" : "available",
          rescue.handled_by,
        ]);
      }

      const isAdminCompleting = normalizeRole(userRole) === "admin";

      if (isAdminCompleting) {
        await logMultiNotification([
          {
            eventType: "admin_complete_sos",
            severity: "success",
            title: `Bạn đã xác nhận hoàn thành yêu cầu`,
            description: `Bạn vừa xác nhận hoàn thành yêu cầu SOS #${id}${assignedTeam ? ` của đội ${assignedTeam}` : ""}.`,
            actorUserId: Number(userId),
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "admin",
            recipientUserId: Number(userId),
            metadata: {
              action: "admin_complete",
              team_name: assignedTeam,
            },
          },

          ...(rescue.handled_by
            ? [
                {
                  eventType: "admin_completed_team_sos",
                  severity: "success",
                  title: `Admin đã xác nhận hoàn thành yêu cầu`,
                  description: `Admin đã xác nhận hoàn thành yêu cầu SOS #${id} mà đội của bạn phụ trách.`,
                  actorUserId: Number(userId),
                  actorName: actor.actorName,
                  actorRole: actor.actorRole,
                  rescueId: Number(id),
                  recipientRole: "rescuer",
                  recipientUserId: Number(rescue.handled_by),
                  metadata: {
                    action: "admin_complete",
                    team_name: assignedTeam,
                  },
                },
              ]
            : []),

          {
            eventType: "admin_completed_user_sos",
            severity: "success",
            title: `Yêu cầu đã được xác nhận hoàn thành`,
            description: `Admin đã xác nhận yêu cầu SOS #${id} của bạn đã hoàn thành.`,
            actorUserId: Number(userId),
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "user",
            recipientUserId: Number(rescue.user_id),
            metadata: {
              action: "admin_complete",
              team_name: assignedTeam,
            },
          },
        ]);
      } else {
        await logMultiNotification([
          {
            eventType: "rescuer_complete_sos",
            severity: "success",
            title: `Đội đã hoàn thành yêu cầu`,
            description: `Đội của bạn đã hoàn thành yêu cầu SOS #${id}.`,
            actorUserId: Number(userId),
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "rescuer",
            recipientUserId: Number(userId),
            metadata: {
              action: "complete",
              team_name: assignedTeam,
            },
          },
          {
            eventType: "user_sos_completed",
            severity: "success",
            title: `Yêu cầu đã được cứu thành công`,
            description: `Yêu cầu SOS #${id} của bạn đã được đội ${assignedTeam} xử lý thành công.`,
            actorUserId: Number(userId),
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            rescueId: Number(id),
            recipientRole: "user",
            recipientUserId: Number(rescue.user_id),
            metadata: {
              action: "complete",
              team_name: assignedTeam,
            },
          },
        ]);
      }
    }

    // 4) Admin hủy hẳn yêu cầu: new -> cancel
    if (status === "cancel") {
      if (userRole !== "admin") {
        return res.status(403).json({
          message: "Chỉ admin mới có quyền hủy yêu cầu",
        });
      }

      if (rescue.status !== "new") {
        return res.status(400).json({
          message: "Chỉ có thể hủy yêu cầu khi chưa có đội nhận",
        });
      }

      const reasonText = String(reason || "").trim();

      await db.query(
        `UPDATE rescues
         SET status=?, completed_at=NOW()
         WHERE id=?`,
        ["cancel", id],
      );

      await logMultiNotification([
        {
          eventType: "sos_canceled_by_admin",
          severity: "warning",
          title: `Admin đã hủy SOS #${id}`,
          description: `${actor.actorName} đã hủy yêu cầu SOS #${id}${reasonText ? `: ${reasonText}` : ""}`,
          actorUserId: userId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          rescueId: Number(id),
          recipientRole: "admin",
          metadata: {
            action: "cancel",
            reason: reasonText || "",
          },
        },
        {
          eventType: "sos_canceled_by_admin",
          severity: "warning",
          title: `Yêu cầu SOS #${id} đã bị hủy`,
          description: `Yêu cầu này đã được admin hủy${reasonText ? `: ${reasonText}` : ""}.`,
          actorUserId: userId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          rescueId: Number(id),
          recipientRole: "rescuer",
          metadata: {
            action: "cancel",
            reason: reasonText || "",
          },
        },
        {
          eventType: "sos_canceled_by_admin",
          severity: "warning",
          title: `Yêu cầu SOS #${id} đã bị hủy`,
          description: `Yêu cầu của bạn đã được admin hủy${reasonText ? `: ${reasonText}` : ""}.`,
          actorUserId: userId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          rescueId: Number(id),
          recipientRole: "user",
          recipientUserId: Number(rescue.user_id),
          metadata: {
            action: "cancel",
            reason: reasonText || "",
          },
        },
      ]);
    }

    const [updatedRows] = await db.query(
      "SELECT * FROM rescues WHERE id=? LIMIT 1",
      [id],
    );

    res.json(updatedRows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   LOGIN
============================== */

app.post("/api/login", async (req, res) => {
  try {
    const { email, password, loginType } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email không được để trống!" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE email=? LIMIT 1",
      [normalizedEmail],
    );

    if (users.length === 0) {
      return res
        .status(401)
        .json({ message: "Email không tồn tại trong hệ thống!" });
    }

    const user = users[0];

    if (isPlaceholderSocialEmail(user.email)) {
      return res.status(403).json({
        message:
          "Tài khoản Facebook này chưa có email đăng nhập. Vui lòng đăng nhập bằng Facebook trước rồi cập nhật email trong hồ sơ!",
      });
    }

    if (user.role === "user" && user.provider && !user.password) {
      return res.status(403).json({
        message:
          "Tài khoản này chưa có mật khẩu, vui lòng đăng nhập bằng Facebook trước rồi tạo mật khẩu trong hồ sơ!",
      });
    }

    if (loginType === "staff" && user.role === "user") {
      return res.status(403).json({
        message: "Tài khoản này không thuộc Admin / Đội cứu hộ",
      });
    }

    if (loginType === "user" && user.role !== "user") {
      return res.status(403).json({
        message: "Vui lòng đăng nhập ở tab Admin / Đội cứu hộ",
      });
    }

    let accountStatus = "active";

    if (user.role === "user") {
      accountStatus = await getCitizenAccountStatus(user.id);

      if (accountStatus === "inactive") {
        return res.status(403).json({
          code: "ACCOUNT_INACTIVE",
          message:
            "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!",
        });
      }

      // temporary_locked vẫn cho đăng nhập
    }

    if (user.role === "rescuer") {
      const [rescuer] = await db.query(
        "SELECT account_status FROM rescuer_profile WHERE user_id=? LIMIT 1",
        [user.id],
      );

      accountStatus = sanitizeText(rescuer[0]?.account_status, "active");

      if (accountStatus === "inactive") {
        return res.status(403).json({
          code: "ACCOUNT_INACTIVE",
          message: "Tài khoản đã bị khóa, vui lòng liên hệ admin!",
        });
      }

      // temporary_locked vẫn cho đăng nhập
    }

    if (!user.password) {
      return res.status(401).json({
        message: "Tài khoản này chưa có mật khẩu",
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res
        .status(401)
        .json({ message: "Sai mật khẩu. Vui lòng nhập lại!" });
    }

    const token = signLoginToken(user);

    res.json({
      token,
      email: isPlaceholderSocialEmail(user.email) ? "" : user.email,
      role: user.role,
      userId: user.id,
      accountStatus,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   FACEBOOK LOGIN
============================== */

app.get("/api/auth/facebook", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.fbState = state;
  req.session.redirectAfterLogin = req.query.redirect || "/";

  const redirectUri = encodeURIComponent(process.env.FACEBOOK_CALLBACK_URL);
  const scope = encodeURIComponent("public_profile,email");

  const facebookUrl =
    `https://www.facebook.com/v23.0/dialog/oauth` +
    `?client_id=${process.env.FACEBOOK_APP_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}` +
    `&scope=${scope}`;

  res.redirect(facebookUrl);
});

app.get("/api/auth/facebook/callback", async (req, res) => {
  try {
    const { code, state, error, error_reason } = req.query;

    const redirectPath = req.session.redirectAfterLogin || "/";

    if (error === "access_denied" || error_reason === "user_denied") {
      req.session.redirectAfterLogin = null;
      req.session.fbState = null;

      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}${redirectPath}?auth=login&error=facebook_cancelled`,
      );
    }

    if (!code || !state || state !== req.session.fbState) {
      req.session.redirectAfterLogin = null;
      req.session.fbState = null;

      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}${redirectPath}?auth=login&error=facebook_state_invalid`,
      );
    }

    const tokenResponse = await axios.get(
      "https://graph.facebook.com/v23.0/oauth/access_token",
      {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: process.env.FACEBOOK_CALLBACK_URL,
          code,
        },
      },
    );

    const accessToken = tokenResponse.data.access_token;

    const profileResponse = await axios.get("https://graph.facebook.com/me", {
      params: {
        fields: "id,name,email,picture.width(512).height(512)",
        access_token: accessToken,
      },
    });

    const profile = profileResponse.data;

    // console.log("FACEBOOK PROFILE:", profile);
    // console.log("FACEBOOK EMAIL:", profile.email);

    const socialResult = await findOrCreateSocialUser({
      provider: "facebook",
      providerId: String(profile.id),
      name: profile.name,
      avatar: profile.picture?.data?.url || null,
      email: profile.email || null,
    });

    const user = socialResult.user;

    const citizenAccountStatus = await getCitizenAccountStatus(user.id);

    if (citizenAccountStatus === "inactive") {
      req.session.redirectAfterLogin = null;
      req.session.fbState = null;

      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}${redirectPath}?auth=login&error=account_inactive`,
      );
    }

    const token = signLoginToken(user);

    if (socialResult.isNewUser) {
      await logNotification({
        eventType: "admin_user_registered_facebook",
        severity: "info",
        title: `Người dân đăng ký mới bằng Facebook`,
        description: `${sanitizeText(profile.name || user.email || `User #${user.id}`)} vừa đăng ký tài khoản bằng Facebook.`,
        actorUserId: Number(user.id),
        actorName: sanitizeText(
          profile.name || user.email || `User #${user.id}`,
        ),
        actorRole: "user",
        recipientRole: "admin",
        metadata: {
          action: "register_facebook",
          email: sanitizeText(profile.email),
          provider: "facebook",
          email_source: sanitizeText(user.email_source),
        },
      });
    }

    req.session.redirectAfterLogin = null;
    req.session.fbState = null;

    return res.redirect(
      buildFrontendRedirect(user, token, redirectPath, {
        accountStatus: citizenAccountStatus,
      }),
    );
  } catch (err) {
    console.log("Facebook login error:", err?.response?.data || err.message);

    const redirectPath = req.session.redirectAfterLogin || "/";
    req.session.redirectAfterLogin = null;
    req.session.fbState = null;

    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}${redirectPath}?auth=login&error=facebook_login_failed`,
    );
  }
});

/* ==============================
   SEND REGISTER CODE
============================== */

app.post("/api/send-register-code", async (req, res) => {
  const normalizedEmail = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  try {
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Email không hợp lệ!" });
    }

    const [emailExist] = await db.query(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [normalizedEmail],
    );

    if (emailExist.length > 0) {
      return res.status(400).json({
        message: "Email đã được sử dụng. Vui lòng nhập email khác!",
      });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query("DELETE FROM email_verifications WHERE email=?", [
      normalizedEmail,
    ]);

    await db.query(
      "INSERT INTO email_verifications (email, code, expires_at, verified) VALUES (?, ?, ?, 0)",
      [normalizedEmail, code, expiresAt],
    );

    await sendVerificationEmail(
      normalizedEmail,
      code,
      "Mã xác minh đăng ký tài khoản FRRP",
      "Xác minh email đăng ký",
    );

    res.json({ message: "Đã gửi mã xác minh về email" });
  } catch (err) {
    console.log("send-register-code error:", err);
    res.status(500).json({ message: "Không gửi được email xác minh" });
  }
});

/* ==============================
   SEND FORGOT PASSWORD CODE
============================== */

app.post("/api/send-forgot-password-code", async (req, res) => {
  const normalizedEmail = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  try {
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Email không hợp lệ!" });
    }

    const [users] = await db.query(
      "SELECT id, email, provider, password, role FROM users WHERE email=? LIMIT 1",
      [normalizedEmail],
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "Email không tồn tại trong hệ thống!",
      });
    }

    const user = users[0];

    if (isPlaceholderSocialEmail(user.email)) {
      return res.status(400).json({
        message:
          "Tài khoản Facebook này chưa có email. Vui lòng đăng nhập bằng Facebook rồi cập nhật email trong hồ sơ trước!",
      });
    }

    if (user.provider && !user.password) {
      return res.status(400).json({
        message:
          "Tài khoản này chưa có mật khẩu. Vui lòng đăng nhập bằng Facebook trước rồi tạo mật khẩu trong hồ sơ!",
      });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query("DELETE FROM password_reset_verifications WHERE email=?", [
      normalizedEmail,
    ]);

    await db.query(
      `INSERT INTO password_reset_verifications (email, code, expires_at, used)
       VALUES (?, ?, ?, 0)`,
      [normalizedEmail, code, expiresAt],
    );

    await sendForgotPasswordEmail(normalizedEmail, code);

    res.json({ message: "Đã gửi mã đặt lại mật khẩu về email" });
  } catch (err) {
    console.log("send-forgot-password-code error:", err);
    res.status(500).json({ message: "Không gửi được mã đặt lại mật khẩu" });
  }
});

/* ==============================
   REGISTER
============================== */

app.post("/api/register", async (req, res) => {
  const { name, phone, email, password, verificationCode } = req.body;

  try {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Email không hợp lệ!" });
    }

    if (!verificationCode) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập mã xác minh email!" });
    }

    const [phoneExist] = await db.query(
      `
      SELECT user_id
      FROM (
        SELECT user_id, phone FROM user_profile
        UNION ALL
        SELECT user_id, phone FROM admin_profile
        UNION ALL
        SELECT user_id, phone FROM rescuer_profile
      ) AS profiles
      WHERE phone = ?
      LIMIT 1
      `,
      [phone],
    );

    if (phoneExist.length > 0) {
      return res.status(400).json({
        message: "Số điện thoại đã được sử dụng. Vui lòng nhập số khác!",
      });
    }

    const [emailExist] = await db.query(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [normalizedEmail],
    );

    if (emailExist.length > 0) {
      return res.status(400).json({
        message: "Email đã được sử dụng. Vui lòng nhập email khác!",
      });
    }

    const [verifyRows] = await db.query(
      `SELECT * FROM email_verifications
       WHERE email=? AND code=? AND verified=0
       ORDER BY id DESC
       LIMIT 1`,
      [normalizedEmail, verificationCode],
    );

    if (verifyRows.length === 0) {
      return res.status(400).json({ message: "Mã xác minh không đúng" });
    }

    const verification = verifyRows[0];
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);

    if (expiresAt < now) {
      return res.status(400).json({ message: "Mã xác minh đã hết hạn" });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (password, role, email, email_source) VALUES (?, ?, ?, ?)",
      [hash, "user", normalizedEmail, "manual"],
    );

    const userId = result.insertId;

    await db.query(
      "INSERT INTO user_profile (user_id,full_name,phone,address) VALUES (?,?,?,?)",
      [userId, name, phone, ""],
    );

    await db.query("UPDATE email_verifications SET verified=1 WHERE id=?", [
      verification.id,
    ]);

    await logNotification({
      eventType: "admin_user_registered",
      severity: "info",
      title: `Người dân đăng ký tài khoản thành công`,
      description: `${sanitizeText(name || normalizedEmail)} vừa đăng ký tài khoản mới.`,
      actorUserId: Number(userId),
      actorName: sanitizeText(name || normalizedEmail),
      actorRole: "user",
      recipientRole: "admin",
      metadata: {
        action: "register",
        phone: sanitizeText(phone),
        email: sanitizeText(normalizedEmail),
      },
    });

    res.json({ message: "Đăng ký thành công" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   GET PROFILE
============================== */

app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let rows;

    if (userRole === "rescuer") {
      [rows] = await db.query(
        `SELECT 
          users.id,
          users.avatar,
          users.email,
          users.facebook_email,
          users.email_source,
          users.provider,
          users.role,
          CASE 
            WHEN users.password IS NULL OR users.password = '' THEN 0
            ELSE 1
          END AS has_password,
          rescuer_profile.full_name,
          rescuer_profile.phone,
          rescuer_profile.address,
          rescuer_profile.status,
          rescuer_profile.lat,
          rescuer_profile.lng
         FROM users
         LEFT JOIN rescuer_profile
           ON users.id = rescuer_profile.user_id
         WHERE users.id=?`,
        [userId],
      );
    } else if (userRole === "admin") {
      [rows] = await db.query(
        `SELECT 
          users.id,
          users.avatar,
          users.email,
          users.facebook_email,
          users.email_source,
          users.provider,
          users.role,
          CASE 
            WHEN users.password IS NULL OR users.password = '' THEN 0
            ELSE 1
          END AS has_password,
          admin_profile.full_name,
          admin_profile.phone,
          admin_profile.address,
          admin_profile.lat,
          admin_profile.lng
         FROM users
         LEFT JOIN admin_profile
           ON users.id = admin_profile.user_id
         WHERE users.id=?`,
        [userId],
      );
    } else {
      [rows] = await db.query(
        `SELECT 
          users.id,
          users.avatar,
          users.email,
          users.facebook_email,
          users.email_source,
          users.provider,
          users.role,
          CASE 
            WHEN users.password IS NULL OR users.password = '' THEN 0
            ELSE 1
          END AS has_password,
          user_profile.full_name,
user_profile.phone,
user_profile.address,
user_profile.lat,
user_profile.lng,
COALESCE(user_profile.account_status, 'active') AS account_status
         FROM users
         LEFT JOIN user_profile
           ON users.id = user_profile.user_id
         WHERE users.id=?`,
        [userId],
      );
    }

    res.json(
      rows[0] || {
        id: userId,
        avatar: "",
        email: null,
        facebook_email: null,
        email_source: null,
        provider: null,
        role: userRole,
        has_password: 0,
        full_name: "",
        phone: "",
        address: "",
        lat: null,
        lng: null,
        account_status: "active",
      },
    );
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   hàm tính khoảng cách + ETA 
============================== */

const toRad = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const estimateArrivalFromDistance = (distanceKm, sosType) => {
  let avgSpeedKmH = 35;

  if (sosType === "vehicle") avgSpeedKmH = 40;
  else if (sosType === "supplies") avgSpeedKmH = 30;
  else if (sosType === "rescue") avgSpeedKmH = 35;
  else avgSpeedKmH = 30;

  const totalMinutes = Math.max(1, Math.round((distanceKm / avgSpeedKmH) * 60));

  if (totalMinutes < 60) return `Khoảng ${totalMinutes} phút`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) return `Khoảng ${hours} giờ`;
  return `Khoảng ${hours} giờ ${minutes} phút`;
};

const formatDistanceText = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return null;
  return distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m`
    : `${distanceKm.toFixed(1)} km`;
};

/* ==============================
   RESCUER RECOMMENDATION SCORING
============================== */

const getDistanceScore = (distanceKm) => {
  const km = Number(distanceKm);

  if (!Number.isFinite(km)) return 0;
  if (km <= 5) return 40;
  if (km <= 10) return 35;
  if (km <= 20) return 30;
  if (km <= 35) return 22;
  if (km <= 50) return 14;
  if (km <= 70) return 8;
  return 0;
};

const getWorkloadScore = (activeTasks) => {
  const total = Number(activeTasks || 0);

  if (total === 0) return 30;
  if (total === 1) return 22;
  if (total === 2) return 14;
  if (total === 3) return 6;
  return 0;
};

const getAvgResponseScore = (avgMinutes) => {
  if (!Number.isFinite(avgMinutes)) return 10;
  if (avgMinutes <= 10) return 20;
  if (avgMinutes <= 15) return 17;
  if (avgMinutes <= 20) return 14;
  if (avgMinutes <= 30) return 10;
  if (avgMinutes <= 45) return 5;
  return 0;
};

const getProvinceScore = (sosProvince, teamProvince) => {
  const rescueProvince = normalizeProvinceName(sosProvince);
  const rescuerProvince = normalizeProvinceName(teamProvince);

  if (!rescueProvince || !rescuerProvince) return 0;
  if (
    rescueProvince === "Chưa xác định" ||
    rescuerProvince === "Chưa xác định"
  ) {
    return 0;
  }

  return rescueProvince === rescuerProvince ? 10 : 0;
};

const getRescuerActiveTaskCount = async (userId) => {
  const [rows] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM rescues
    WHERE handled_by = ?
      AND status = 'rescuing'
    `,
    [userId],
  );

  return Number(rows[0]?.total || 0);
};

const getRescuerPerformanceStats = async (userId) => {
  const [rows] = await db.query(
    `
    SELECT
      AVG(
        CASE
          WHEN created_at IS NOT NULL AND received_at IS NOT NULL
          THEN TIMESTAMPDIFF(MINUTE, created_at, received_at)
          ELSE NULL
        END
      ) AS avg_response_minutes,
      AVG(
        CASE
          WHEN received_at IS NOT NULL AND completed_at IS NOT NULL
          THEN TIMESTAMPDIFF(MINUTE, received_at, completed_at)
          ELSE NULL
        END
      ) AS avg_completion_minutes
    FROM rescues
    WHERE handled_by = ?
      AND status IN ('rescuing', 'done')
    `,
    [userId],
  );

  const avgResponseMinutes = Number(rows[0]?.avg_response_minutes);
  const avgCompletionMinutes = Number(rows[0]?.avg_completion_minutes);

  return {
    avgResponseMinutes: Number.isFinite(avgResponseMinutes)
      ? avgResponseMinutes
      : null,
    avgCompletionMinutes: Number.isFinite(avgCompletionMinutes)
      ? avgCompletionMinutes
      : null,
  };
};

const MAX_SUGGEST_DISTANCE_KM = 70;
const MIN_SUGGEST_SCORE = 55;
const MAX_SUGGEST_TEAMS = 3;

const getRecommendedRescuersForSOS = async (rescue) => {
  const sosLat = Number(rescue.lat);
  const sosLng = Number(rescue.lng);

  if (!Number.isFinite(sosLat) || !Number.isFinite(sosLng)) {
    return [];
  }

  const sosProvince = await resolveProvinceName({
    lat: sosLat,
    lng: sosLng,
    address: rescue.address,
  });

  const [rescuers] = await db.query(`
    SELECT
      rp.user_id,
      rp.full_name,
      rp.phone,
      rp.status,
      rp.account_status,
      rp.lat,
      rp.lng,
      rp.address
    FROM rescuer_profile rp
    WHERE rp.account_status = 'active'
      AND rp.lat IS NOT NULL
      AND rp.lng IS NOT NULL
  `);

  const scoredTeams = await Promise.all(
    rescuers.map(async (team) => {
      const teamLat = Number(team.lat);
      const teamLng = Number(team.lng);

      if (!Number.isFinite(teamLat) || !Number.isFinite(teamLng)) {
        return null;
      }

      const distanceKm = calculateDistanceKm(teamLat, teamLng, sosLat, sosLng);

      if (distanceKm > MAX_SUGGEST_DISTANCE_KM) {
        return null;
      }

      const activeTasks = await getRescuerActiveTaskCount(team.user_id);

      // quá tải thì loại luôn
      if (activeTasks >= 4) {
        return null;
      }

      const performance = await getRescuerPerformanceStats(team.user_id);
      const teamProvince = await resolveProvinceName({
        lat: teamLat,
        lng: teamLng,
        address: team.address,
      });

      const distanceScore = getDistanceScore(distanceKm); // tối đa 40
      const workloadScore = getWorkloadScore(activeTasks); // tối đa 30
      const responseScore = getAvgResponseScore(performance.avgResponseMinutes); // tối đa 20
      const provinceScore = getProvinceScore(sosProvince, teamProvince); // tối đa 10

      const totalScore =
        distanceScore + workloadScore + responseScore + provinceScore;

      return {
        user_id: Number(team.user_id),
        full_name: sanitizeText(team.full_name, `Đội #${team.user_id}`),
        phone: sanitizeText(team.phone),
        status: sanitizeText(team.status, "available"),
        account_status: sanitizeText(team.account_status, "active"),
        distanceKm,
        distanceText: formatDistanceText(distanceKm),
        etaText: estimateArrivalFromDistance(distanceKm, rescue.sos_type),
        activeTasks,
        avgResponseMinutes: performance.avgResponseMinutes,
        avgCompletionMinutes: performance.avgCompletionMinutes,
        teamProvince,
        sosProvince,
        scoreBreakdown: {
          distanceScore,
          workloadScore,
          responseScore,
          provinceScore,
        },
        totalScore,
      };
    }),
  );

  return scoredTeams
    .filter((item) => item && item.totalScore >= MIN_SUGGEST_SCORE)
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, MAX_SUGGEST_TEAMS);
};

/* ==============================
   UPDATE PROFILE
============================== */

app.put("/api/rescuer/location", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { lat, lng } = req.body;

    if (userRole !== "rescuer" && userRole !== "admin") {
      return res
        .status(403)
        .json({ message: "Không có quyền cập nhật vị trí" });
    }

    const nextLat = Number(lat);
    const nextLng = Number(lng);

    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
      return res.status(400).json({ message: "Tọa độ không hợp lệ" });
    }

    const [existing] = await db.query(
      "SELECT id, full_name, phone, address, status, lat, lng FROM rescuer_profile WHERE user_id=? LIMIT 1",
      [userId],
    );

    const prevLat =
      existing.length > 0 &&
      existing[0].lat !== null &&
      existing[0].lat !== undefined
        ? Number(existing[0].lat)
        : null;

    const prevLng =
      existing.length > 0 &&
      existing[0].lng !== null &&
      existing[0].lng !== undefined
        ? Number(existing[0].lng)
        : null;

    const hasPreviousCoords =
      Number.isFinite(prevLat) && Number.isFinite(prevLng);

    const movedDistanceKm = hasPreviousCoords
      ? calculateDistanceKm(prevLat, prevLng, nextLat, nextLng)
      : 0;

    const hasActuallyMoved = hasPreviousCoords && movedDistanceKm >= 0.03; // khoảng 30m

    if (existing.length > 0) {
      await db.query(
        `UPDATE rescuer_profile
         SET lat=?, lng=?
         WHERE user_id=?`,
        [nextLat, nextLng, userId],
      );
    } else {
      await db.query(
        `INSERT INTO rescuer_profile (user_id, full_name, phone, address, status, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, "", "", "", "available", nextLat, nextLng],
      );
    }

    // tìm các yêu cầu SOS mà đội này đang xử lý
    const [activeRescues] = await db.query(
      `
      SELECT
        r.id,
        r.user_id,
        r.lat,
        r.lng,
        r.address,
        r.sos_type,
        r.status,
        r.handled_by
      FROM rescues r
      WHERE r.handled_by = ?
        AND r.status = 'rescuing'
      `,
      [userId],
    );

    const actor = await getActorSummary(userId, req.user.role);

    for (const rescue of activeRescues) {
      // Chỉ coi là "đang đến" khi rescuer đã thật sự di chuyển
      if (!hasActuallyMoved) continue;

      const sosLat = Number(rescue.lat);
      const sosLng = Number(rescue.lng);

      if (!Number.isFinite(sosLat) || !Number.isFinite(sosLng)) continue;

      const distanceKm = calculateDistanceKm(nextLat, nextLng, sosLat, sosLng);
      const distanceText = formatDistanceText(distanceKm);
      const etaText = estimateArrivalFromDistance(distanceKm, rescue.sos_type);

      // chống spam: chỉ bắn thông báo khi có thay đổi đáng kể
      const [latestRows] = await db.query(
        `
        SELECT id, metadata
        FROM notifications
        WHERE event_type = 'rescuer_moving_eta_updated'
          AND rescue_id = ?
          AND recipient_user_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [Number(rescue.id), Number(rescue.user_id)],
      );

      let shouldNotify = true;

      if (latestRows.length > 0) {
        let prevMeta = null;
        try {
          prevMeta =
            typeof latestRows[0].metadata === "string"
              ? JSON.parse(latestRows[0].metadata)
              : latestRows[0].metadata;
        } catch {
          prevMeta = null;
        }

        const prevDistanceKm = Number(prevMeta?.distance_km);
        const prevEtaText = String(prevMeta?.eta_text || "");

        const distanceChangedEnough = Number.isFinite(prevDistanceKm)
          ? Math.abs(distanceKm - prevDistanceKm) >= 0.2
          : true;

        const etaChanged = prevEtaText !== etaText;

        shouldNotify = distanceChangedEnough || etaChanged;
      }

      if (!shouldNotify) continue;

      await logNotification({
        eventType: "rescuer_moving_eta_updated",
        severity: "info",
        title: `Đội cứu hộ đang di chuyển đến SOS #${rescue.id}`,
        description: `${actor.actorName || "Đội cứu hộ"} đang đến vị trí của bạn. ${distanceText} • ${etaText}.`,
        actorUserId: Number(userId),
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        rescueId: Number(rescue.id),
        recipientRole: "user",
        recipientUserId: Number(rescue.user_id),
        metadata: {
          action: "rescuer_moving",
          current_step: 3,
          rescue_status: "moving",
          rescue_status_text: "Đội cứu hộ đang di chuyển đến",
          moved_distance_km: Number(movedDistanceKm.toFixed(3)),
          distance_km: Number(distanceKm.toFixed(3)),
          distance_text: distanceText,
          eta_text: etaText,
          rescuer_lat: nextLat,
          rescuer_lng: nextLng,
          previous_rescuer_lat: prevLat,
          previous_rescuer_lng: prevLng,
          sos_lat: sosLat,
          sos_lng: sosLng,
          address: sanitizeText(rescue.address),
          sos_type: sanitizeText(rescue.sos_type),
        },
      });
    }

    res.json({
      message: "Cập nhật vị trí thành công",
      activeRescueCount: activeRescues.length,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/user/location", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { lat, lng } = req.body;

    if (userRole !== "user") {
      return res
        .status(403)
        .json({ message: "Chỉ người dân mới được cập nhật vị trí" });
    }

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return res.status(400).json({ message: "Tọa độ không hợp lệ" });
    }

    const [existing] = await db.query(
      "SELECT id FROM user_profile WHERE user_id=? LIMIT 1",
      [userId],
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE user_profile
         SET lat=?, lng=?
         WHERE user_id=?`,
        [Number(lat), Number(lng), userId],
      );
    } else {
      const [users] = await db.query(
        "SELECT email FROM users WHERE id=? LIMIT 1",
        [userId],
      );

      const fallbackName = users[0]?.email || "";

      await db.query(
        `INSERT INTO user_profile (user_id, full_name, phone, address, lat, lng)
   VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, fallbackName, null, "", Number(lat), Number(lng)],
      );
    }

    res.json({ message: "Cập nhật vị trí người dân thành công" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put(
  "/api/profile",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const body = req.body || {};

      const full_name = (body.full_name || "").trim();
      const phone = (body.phone || "").trim() || null;
      const address = (body.address || "").trim() || null;
      const status = body.status;
      const lat =
        body.lat !== undefined && body.lat !== "" ? Number(body.lat) : null;
      const lng =
        body.lng !== undefined && body.lng !== "" ? Number(body.lng) : null;

      if (phone) {
        const [existPhone] = await db.query(
          `
          SELECT user_id
          FROM (
            SELECT user_id, phone FROM user_profile
            UNION ALL
            SELECT user_id, phone FROM admin_profile
            UNION ALL
            SELECT user_id, phone FROM rescuer_profile
          ) AS profiles
          WHERE phone = ? AND user_id <> ?
          LIMIT 1
          `,
          [phone, userId],
        );

        if (existPhone.length > 0) {
          return res.status(400).json({
            message: "Số điện thoại đã được sử dụng. Vui lòng nhập số khác!",
          });
        }
      }

      let avatarPath = null;
      if (req.file) {
        avatarPath = "/uploads/" + req.file.filename;
      }

      if (avatarPath) {
        await db.query("UPDATE users SET avatar=? WHERE id=?", [
          avatarPath,
          userId,
        ]);
      }

      if (userRole === "rescuer") {
        const [existing] = await db.query(
          "SELECT id FROM rescuer_profile WHERE user_id=? LIMIT 1",
          [userId],
        );

        if (existing.length > 0) {
          await db.query(
            `UPDATE rescuer_profile
             SET full_name=?, phone=?, address=?, status=COALESCE(?, status), lat=?, lng=?
             WHERE user_id=?`,
            [full_name, phone, address, status ?? null, lat, lng, userId],
          );
        } else {
          await db.query(
            `INSERT INTO rescuer_profile (user_id, full_name, phone, address, status, lat, lng)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              full_name,
              phone,
              address,
              status || "available",
              lat,
              lng,
            ],
          );
        }
      } else if (userRole === "admin") {
        const [existing] = await db.query(
          "SELECT id FROM admin_profile WHERE user_id=? LIMIT 1",
          [userId],
        );

        if (existing.length > 0) {
          await db.query(
            `UPDATE admin_profile
             SET full_name=?, phone=?, address=?, lat=?, lng=?
             WHERE user_id=?`,
            [full_name, phone, address, lat, lng, userId],
          );
        } else {
          await db.query(
            `INSERT INTO admin_profile (user_id, full_name, phone, address, lat, lng)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, full_name, phone, address, lat, lng],
          );
        }
      } else {
        const [existing] = await db.query(
          "SELECT id FROM user_profile WHERE user_id=? LIMIT 1",
          [userId],
        );

        if (existing.length > 0) {
          await db.query(
            `UPDATE user_profile
             SET full_name=?, phone=?, address=?, lat=?, lng=?
             WHERE user_id=?`,
            [full_name, phone, address, lat, lng, userId],
          );
        } else {
          await db.query(
            `INSERT INTO user_profile (user_id, full_name, phone, address, lat, lng)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, full_name, phone, address, lat, lng],
          );
        }
      }

      let updated;

      if (userRole === "rescuer") {
        [updated] = await db.query(
          `SELECT 
            users.id,
            users.avatar,
            users.email,
            users.facebook_email,
            users.email_source,
            users.provider,
            users.role,
            CASE 
              WHEN users.password IS NULL OR users.password = '' THEN 0
              ELSE 1
            END AS has_password,
            rescuer_profile.full_name,
            rescuer_profile.phone,
            rescuer_profile.address,
            rescuer_profile.status,
            rescuer_profile.lat,
            rescuer_profile.lng
           FROM users
           LEFT JOIN rescuer_profile
             ON users.id = rescuer_profile.user_id
           WHERE users.id=?`,
          [userId],
        );
      } else if (userRole === "admin") {
        [updated] = await db.query(
          `SELECT 
            users.id,
            users.avatar,
            users.email,
            users.facebook_email,
            users.email_source,
            users.provider,
            users.role,
            CASE 
              WHEN users.password IS NULL OR users.password = '' THEN 0
              ELSE 1
            END AS has_password,
            admin_profile.full_name,
            admin_profile.phone,
            admin_profile.address,
            admin_profile.lat,
            admin_profile.lng
           FROM users
           LEFT JOIN admin_profile
             ON users.id = admin_profile.user_id
           WHERE users.id=?`,
          [userId],
        );
      } else {
        [updated] = await db.query(
          `SELECT 
            users.id,
            users.avatar,
            users.email,
            users.facebook_email,
            users.email_source,
            users.provider,
            users.role,
            CASE 
              WHEN users.password IS NULL OR users.password = '' THEN 0
              ELSE 1
            END AS has_password,
            user_profile.full_name,
            user_profile.phone,
            user_profile.address,
            user_profile.lat,
            user_profile.lng
           FROM users
           LEFT JOIN user_profile
             ON users.id = user_profile.user_id
           WHERE users.id=?`,
          [userId],
        );
      }

      res.json({
        message: "Cập nhật hồ sơ thành công",
        profile: updated[0],
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/* ==============================
   CHANGE PASSWORD
============================== */

app.put("/api/change-password", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || String(newPassword).trim().length < 6) {
      return res.status(400).json({
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    const [rows] = await db.query(
      "SELECT id, password, provider FROM users WHERE id=?",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];
    const hasPassword = !!user.password;

    // Nếu đã có mật khẩu thì phải nhập mật khẩu cũ
    if (hasPassword) {
      if (!oldPassword) {
        return res.status(400).json({
          message: "Vui lòng nhập mật khẩu hiện tại",
        });
      }

      const valid = await bcrypt.compare(oldPassword, user.password);

      if (!valid) {
        return res.status(400).json({
          message: "Mật khẩu hiện tại không đúng!",
        });
      }
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE users SET password=? WHERE id=?", [hash, userId]);

    res.json({
      message: hasPassword
        ? "Đổi mật khẩu thành công"
        : "Tạo mật khẩu mới thành công",
      needOldPassword: false,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

/* ==============================
   RESET PASSWORD BY EMAIL CODE
============================== */

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body;

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Email không hợp lệ!" });
    }

    if (!verificationCode) {
      return res.status(400).json({
        message: "Vui lòng nhập mã xác minh!",
      });
    }

    if (!newPassword || String(newPassword).trim().length < 6) {
      return res.status(400).json({
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    const [users] = await db.query(
      "SELECT id, email, role, provider, password FROM users WHERE email=? LIMIT 1",
      [normalizedEmail],
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "Email không tồn tại trong hệ thống!",
      });
    }

    const user = users[0];

    if (isPlaceholderSocialEmail(user.email)) {
      return res.status(400).json({
        message:
          "Tài khoản Facebook này chưa có email. Vui lòng đăng nhập bằng Facebook rồi cập nhật email trong hồ sơ trước!",
      });
    }

    const [verifyRows] = await db.query(
      `SELECT * FROM password_reset_verifications
       WHERE email=? AND code=? AND used=0
       ORDER BY id DESC
       LIMIT 1`,
      [normalizedEmail, verificationCode],
    );

    if (verifyRows.length === 0) {
      return res.status(400).json({
        message: "Mã xác minh không đúng",
      });
    }

    const verification = verifyRows[0];
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);

    if (expiresAt < now) {
      return res.status(400).json({
        message: "Mã xác minh đã hết hạn",
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE users SET password=? WHERE id=?", [hash, user.id]);

    await db.query(
      "UPDATE password_reset_verifications SET used=1 WHERE id=?",
      [verification.id],
    );

    const actorLabel = user.email || `User #${user.id}`;

    await logNotification({
      eventType: "user_reset_password",
      severity: "warning",
      title: `Đặt lại mật khẩu: ${actorLabel}`,
      description: `${actorLabel} vừa đặt lại mật khẩu bằng mã xác minh email`,
      actorUserId: Number(user.id),
      actorName: sanitizeText(actorLabel),
      actorRole: sanitizeText(user.role),
      metadata: {
        action: "reset_password",
        email: sanitizeText(normalizedEmail),
      },
    });

    res.json({
      message: "Đặt lại mật khẩu thành công",
    });
  } catch (err) {
    console.log("reset-password error:", err);
    res.status(500).json({ message: "Không thể đặt lại mật khẩu" });
  }
});

/* ==============================
   SEND CHANGE EMAIL CODE
============================== */

app.post("/api/send-change-email-code", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { newEmail } = req.body;

  try {
    if (!newEmail || !isValidEmail(newEmail)) {
      return res.status(400).json({ message: "Email mới không hợp lệ!" });
    }

    const normalizedNewEmail = String(newEmail).trim().toLowerCase();

    const [userRows] = await db.query(
      "SELECT id, email, provider, email_source, facebook_email FROM users WHERE id=? LIMIT 1",
      [userId],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    const currentUser = userRows[0];

    // Chỉ khóa nếu email hiện tại đang lấy từ Facebook
    if (currentUser.email_source === "facebook") {
      return res.status(403).json({
        message:
          "Tài khoản này đã lấy email từ Facebook nên không thể sửa tại đây",
      });
    }

    if (
      String(currentUser.email || "")
        .trim()
        .toLowerCase() === normalizedNewEmail
    ) {
      return res.status(400).json({
        message: "Email mới phải khác email hiện tại!",
      });
    }

    const [emailExist] = await db.query(
      "SELECT id FROM users WHERE email=? AND id<>? LIMIT 1",
      [normalizedNewEmail, userId],
    );

    if (emailExist.length > 0) {
      return res.status(400).json({
        message: "Email đã được sử dụng. Vui lòng nhập email khác!",
      });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      "DELETE FROM change_email_verifications WHERE user_id=? OR new_email=?",
      [userId, normalizedNewEmail],
    );

    await db.query(
      `INSERT INTO change_email_verifications
       (user_id, new_email, code, expires_at, verified)
       VALUES (?, ?, ?, ?, 0)`,
      [userId, normalizedNewEmail, code, expiresAt],
    );

    await sendVerificationEmail(
      normalizedNewEmail,
      code,
      "Mã xác minh đổi email tài khoản FRRP",
      "Xác minh email mới",
    );

    res.json({ message: "Đã gửi mã xác minh tới email mới" });
  } catch (err) {
    console.log("send-change-email-code error:", err);
    res.status(500).json({ message: "Không gửi được mã xác minh email" });
  }
});

/* ==============================
   CHANGE EMAIL
============================== */

app.put("/api/change-email", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { newEmail, verificationCode } = req.body;

  try {
    if (!newEmail || !isValidEmail(newEmail)) {
      return res.status(400).json({ message: "Email mới không hợp lệ!" });
    }

    if (!verificationCode) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập mã xác minh email!" });
    }

    const normalizedNewEmail = String(newEmail).trim().toLowerCase();

    const [userRows] = await db.query(
      "SELECT id, email, provider, role, email_source, facebook_email FROM users WHERE id=? LIMIT 1",
      [userId],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    const currentUser = userRows[0];

    // Chỉ khóa nếu email hiện tại đang lấy từ Facebook
    if (currentUser.email_source === "facebook") {
      return res.status(403).json({
        message:
          "Tài khoản này đã lấy email từ Facebook nên không thể sửa tại đây",
      });
    }

    if (
      String(currentUser.email || "")
        .trim()
        .toLowerCase() === normalizedNewEmail
    ) {
      return res.status(400).json({
        message: "Email mới phải khác email hiện tại",
      });
    }

    const [emailExist] = await db.query(
      "SELECT id FROM users WHERE email=? AND id<>? LIMIT 1",
      [normalizedNewEmail, userId],
    );

    if (emailExist.length > 0) {
      return res.status(400).json({
        message: "Email đã được sử dụng. Vui lòng nhập email khác!",
      });
    }

    const [verifyRows] = await db.query(
      `SELECT * FROM change_email_verifications
       WHERE user_id=? AND new_email=? AND code=? AND verified=0
       ORDER BY id DESC
       LIMIT 1`,
      [userId, normalizedNewEmail, verificationCode],
    );

    if (verifyRows.length === 0) {
      return res.status(400).json({ message: "Mã xác minh không đúng" });
    }

    const verification = verifyRows[0];
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);

    if (expiresAt < now) {
      return res.status(400).json({ message: "Mã xác minh đã hết hạn" });
    }

    await db.query(
      "UPDATE users SET email=?, email_source='manual' WHERE id=?",
      [normalizedNewEmail, userId],
    );

    await db.query(
      "UPDATE change_email_verifications SET verified=1 WHERE id=?",
      [verification.id],
    );

    const actorLabel = currentUser.email || `User #${userId}`;

    await logNotification({
      eventType: "user_changed_email",
      severity: "info",
      title: `Đổi email: ${actorLabel}`,
      description: `${actorLabel} vừa cập nhật email tài khoản`,
      actorUserId: Number(userId),
      actorName: sanitizeText(actorLabel),
      actorRole: sanitizeText(currentUser.role),
      metadata: {
        action: "change_email",
        new_email: sanitizeText(normalizedNewEmail),
        email_source: "manual",
      },
    });

    res.json({ message: "Đổi email thành công" });
  } catch (err) {
    console.log("change-email error:", err);
    res.status(500).json({ message: "Không thể đổi email" });
  }
});

/* CANCEL SOS */
app.put("/api/rescues/:id/cancel", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await db.query("SELECT * FROM rescues WHERE id=?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy SOS" });
    }

    const rescue = rows[0];

    if (rescue.user_id !== userId) {
      return res.status(403).json({ message: "Không có quyền hủy" });
    }

    if (rescue.status !== "new") {
      return res.status(400).json({
        message: "Chỉ có thể hủy khi yêu cầu chưa được đội cứu hộ nhận",
      });
    }

    await db.query("UPDATE rescues SET status='cancel' WHERE id=?", [id]);

    const actor = await getActorSummary(userId, req.user.role);

    await logNotification({
      eventType: "user_sos_canceled",
      severity: "warning",
      title: `Yêu cầu đã hủy`,
      description: `Bạn đã hủy yêu cầu SOS #${id}.`,
      actorUserId: userId,
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      rescueId: Number(id),
      recipientRole: "user",
      recipientUserId: Number(userId),
      metadata: {
        action: "cancel",
      },
    });

    res.json({ message: "Đã hủy SOS" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   GET ALL RESCUERS
============================== */

app.get("/api/rescuers", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        user_id,
        full_name,
        phone,
        lat,
        lng,
        status,
        account_status
      FROM rescuer_profile
      WHERE account_status = 'active'
    `);

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get(
  "/api/rescuer/tasks",
  authMiddleware,
  requireRole("rescuer"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const [rows] = await db.query(
        `
      SELECT 
        r.id,
        r.name,
        r.phone,
        r.address,
        r.victims,
        r.note,
        r.status,
        r.created_at,
        r.received_at,
        r.sos_type,
        r.lat,
        r.lng,
        r.source_url,
        r.images
      FROM rescues r
      WHERE r.handled_by = ?
      AND r.status IN ('rescuing', 'done')
      ORDER BY r.received_at DESC
    `,
        [userId],
      );

      const result = rows.map((r) => ({
        id: String(r.id),
        title: r.name || "Người dân",
        phone: r.phone,
        location: r.address,
        people: r.victims,
        note: r.note,
        lat: r.lat,
        lng: r.lng,
        source_url: r.source_url,
        received_at: r.received_at,
        images: JSON.parse(r.images || "[]"),
        status: r.status,
        timeAgo: r.created_at,
        sos_type: r.sos_type,
      }));

      res.json(result);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.post(
  "/api/rescues/:id/quick-report",
  authMiddleware,
  upload.fields([{ name: "images", maxCount: 5 }]),
  async (req, res) => {
    try {
      const rescueId = Number(req.params.id);
      const userId = Number(req.user.id);
      const note = String(req.body?.note || "").trim();

      if (!rescueId) {
        return res.status(400).json({ message: "Mã SOS không hợp lệ" });
      }

      const [rows] = await db.query(
        `SELECT id, user_id, status, handled_by
         FROM rescues
         WHERE id = ?
         LIMIT 1`,
        [rescueId],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy yêu cầu cứu hộ" });
      }

      const rescue = rows[0];

      if (rescue.status !== "rescuing") {
        return res.status(400).json({
          message: "Chỉ có thể gửi báo cáo khi nhiệm vụ đang cứu hộ",
        });
      }

      if (Number(rescue.handled_by) !== userId) {
        return res.status(403).json({
          message: "Bạn không phải đội đang phụ trách yêu cầu này",
        });
      }

      const imagePaths = (req.files?.images || []).map(
        (file) => "/uploads/" + file.filename,
      );

      if (!note && imagePaths.length === 0) {
        return res.status(400).json({
          message: "Vui lòng nhập ghi chú hoặc chọn ít nhất 1 ảnh",
        });
      }

      const [insertResult] = await db.query(
        `INSERT INTO rescue_quick_reports
         (rescue_id, rescuer_user_id, note, images)
         VALUES (?, ?, ?, ?)`,
        [rescueId, userId, note || null, JSON.stringify(imagePaths)],
      );

      res.json({
        message: "Đã lưu báo cáo nhanh",
        report: {
          id: insertResult.insertId,
          rescue_id: rescueId,
          rescuer_user_id: userId,
          note,
          images: imagePaths,
          created_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/* ==============================
   ADMIN STATS - RESCUER
============================== */

app.get("/api/admin/rescuer-stats", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const [rows] = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN account_status = 'inactive' THEN 1 ELSE 0 END) as inactive
      FROM rescuer_profile
    `);

    res.json(rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/admin/rescuers-full", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [rows] = await db.query(`
      SELECT 
        rp.user_id,
        rp.full_name,
        rp.phone,
        rp.address,
        rp.status,
        rp.account_status,
        (
          SELECT r.id 
          FROM rescues r 
          WHERE r.handled_by = rp.user_id 
          AND r.status = 'rescuing'
          LIMIT 1
        ) as sos_id
      FROM rescuer_profile rp
    `);

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/admin/rescuers/:id/details", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { id } = req.params;

    const [profileRows] = await db.query(
      `
      SELECT 
        rp.user_id,
        rp.full_name,
        rp.phone,
        rp.address,
        rp.status,
        rp.account_status,
        rp.lat,
        rp.lng,
        u.email,
        u.avatar,
        (
          SELECT r.id
          FROM rescues r
          WHERE r.handled_by = rp.user_id
            AND r.status = 'rescuing'
          ORDER BY r.received_at DESC, r.id DESC
          LIMIT 1
        ) AS current_sos_id
      FROM rescuer_profile rp
      LEFT JOIN users u ON u.id = rp.user_id
      WHERE rp.user_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (!profileRows.length) {
      return res.status(404).json({ message: "Không tìm thấy đội cứu hộ" });
    }

    const profile = profileRows[0];

    const [historyRows] = await db.query(
      `
  SELECT
    n.id AS notification_id,
    n.event_type,
    n.title,
    n.description,
    n.created_at,
    n.rescue_id,
    r.name AS citizen_name,
    r.phone AS citizen_phone,
    r.address AS rescue_address,
    r.lat AS rescue_lat,
    r.lng AS rescue_lng,
    r.victims,
    r.sos_type,
    r.status AS rescue_status,
    r.received_at,
    r.completed_at
  FROM notifications n
  LEFT JOIN rescues r ON r.id = n.rescue_id
  WHERE n.recipient_user_id = ?
    AND n.event_type IN (
      'rescuer_accept_sos',
      'rescuer_return_sos',
      'rescuer_complete_sos'
    )
  ORDER BY n.created_at DESC, n.id DESC
  `,
      [id],
    );

    const summary = {
      accepted: historyRows.filter(
        (item) => item.event_type === "rescuer_accept_sos",
      ).length,
      canceled: historyRows.filter(
        (item) => item.event_type === "rescuer_return_sos",
      ).length,
      completed: historyRows.filter(
        (item) => item.event_type === "rescuer_complete_sos",
      ).length,
    };

    res.json({
      profile,
      summary,
      history: historyRows,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch(
  "/api/admin/rescuers/:id/toggle",
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      const requestedStatus = sanitizeText(req.body?.nextStatus, "");

      const [rows] = await db.query(
        "SELECT user_id, full_name, account_status FROM rescuer_profile WHERE user_id=?",
        [id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy rescuer" });
      }

      const currentProfile = rows[0];
      const currentStatus = sanitizeText(
        currentProfile.account_status,
        "active",
      );
      const allowedStatuses = ["active", "inactive", "temporary_locked"];
      const newStatus = allowedStatuses.includes(requestedStatus)
        ? requestedStatus
        : currentStatus === "active"
          ? "inactive"
          : "active";

      if (newStatus === currentStatus) {
        return res.json({
          message: "Trạng thái tài khoản không thay đổi",
          status: newStatus,
          canceled_rescues: 0,
        });
      }

      const adminActor = await getActorSummary(req.user.id, req.user.role);
      let canceledRescues = 0;

      await db.query(
        "UPDATE rescuer_profile SET account_status=? WHERE user_id=?",
        [newStatus, id],
      );

      if (newStatus === "inactive") {
        const [activeRescues] = await db.query(
          `SELECT id, user_id
           FROM rescues
           WHERE handled_by=? AND status='rescuing'`,
          [id],
        );

        canceledRescues = activeRescues.length;

        if (canceledRescues > 0) {
          await db.query(
            `UPDATE rescues
             SET status='new', assigned_team=NULL, received_at=NULL, completed_at=NULL, handled_by=NULL
             WHERE handled_by=? AND status='rescuing'`,
            [id],
          );
        }

        await db.query(
          "UPDATE rescuer_profile SET status='available' WHERE user_id=?",
          [id],
        );

        await logNotification({
          eventType: "rescuer_account_locked",
          severity: "critical",
          title: "Tài khoản đội cứu hộ đã bị khóa",
          description:
            canceledRescues > 0
              ? `Admin đã khóa tài khoản của đội bạn. Bạn sẽ bị đăng xuất và ${canceledRescues} yêu cầu đang nhận đã được hệ thống hủy.`
              : "Admin đã khóa tài khoản của đội bạn. Bạn sẽ bị đăng xuất khỏi hệ thống ngay bây giờ.",
          actorUserId: req.user.id,
          actorName: adminActor.actorName,
          actorRole: adminActor.actorRole,
          recipientRole: "rescuer",
          recipientUserId: Number(id),
          metadata: {
            action: "account_locked",
            next_status: newStatus,
            canceled_rescues: canceledRescues,
          },
        });

        for (const rescue of activeRescues) {
          await logMultiNotification([
            {
              eventType: "rescuer_return_sos",
              severity: "warning",
              title: `Yêu cầu SOS #${rescue.id} đã bị hủy do khóa tài khoản`,
              description: `Admin đã khóa tài khoản của đội. Yêu cầu SOS #${rescue.id} mà đội đang phụ trách đã bị hệ thống hủy và đưa về trạng thái chờ.`,
              actorUserId: req.user.id,
              actorName: adminActor.actorName,
              actorRole: adminActor.actorRole,
              rescueId: Number(rescue.id),
              recipientRole: "rescuer",
              recipientUserId: Number(id),
              metadata: {
                action: "return_due_to_account_lock",
                team_user_id: Number(id),
                team_name: currentProfile.full_name || "Đội cứu hộ",
              },
            },
            {
              eventType: "user_sos_returned_due_to_locked_team",
              severity: "warning",
              title: "Đội cứu hộ đã bị gỡ khỏi yêu cầu",
              description: `Yêu cầu SOS #${rescue.id} của bạn đã được đưa về trạng thái chờ vì đội cứu hộ phụ trách vừa bị khóa tài khoản. Hệ thống sẽ tiếp tục chờ đội khác nhận yêu cầu.`,
              actorUserId: req.user.id,
              actorName: adminActor.actorName,
              actorRole: adminActor.actorRole,
              rescueId: Number(rescue.id),
              recipientRole: "user",
              recipientUserId: Number(rescue.user_id),
              metadata: {
                action: "team_removed_due_to_lock",
                team_user_id: Number(id),
                team_name: currentProfile.full_name || "Đội cứu hộ",
              },
            },
          ]);
        }
      } else if (newStatus === "temporary_locked") {
        await logNotification({
          eventType: "rescuer_account_temporary_locked",
          severity: "warning",
          title: "Tài khoản đội cứu hộ bị khóa tạm thời",
          description:
            "Admin đã khóa tạm thời tài khoản của đội bạn. Bạn vẫn có thể hoàn thành các yêu cầu đã nhận nhưng không thể nhận thêm yêu cầu mới. Vui lòng liên hệ quản trị viên để được hỗ trợ.",
          actorUserId: req.user.id,
          actorName: adminActor.actorName,
          actorRole: adminActor.actorRole,
          recipientRole: "rescuer",
          recipientUserId: Number(id),
          metadata: {
            action: "account_temporary_locked",
            next_status: newStatus,
          },
        });
      } else if (newStatus === "active") {
        await logNotification({
          eventType: "rescuer_account_reactivated",
          severity: "success",
          title: "Tài khoản đội cứu hộ đã được mở lại",
          description:
            "Admin đã mở lại tài khoản của đội bạn. Bạn có thể sử dụng lại đầy đủ các chức năng của hệ thống.",
          actorUserId: req.user.id,
          actorName: adminActor.actorName,
          actorRole: adminActor.actorRole,
          recipientRole: "rescuer",
          recipientUserId: Number(id),
          metadata: {
            action: "account_reactivated",
            next_status: newStatus,
          },
        });
      }

      res.json({
        message: "Cập nhật trạng thái thành công",
        status: newStatus,
        canceled_rescues: canceledRescues,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.delete("/api/admin/rescuers/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT user_id FROM rescuer_profile WHERE user_id=?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy rescuer" });
    }

    await db.query("UPDATE rescues SET handled_by=NULL WHERE handled_by=?", [
      id,
    ]);

    await db.query("DELETE FROM rescuer_profile WHERE user_id=?", [id]);
    await db.query("DELETE FROM users WHERE id=?", [id]);

    res.json({ message: "Xóa tài khoản thành công" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   ADMIN RESET PASS RESCUER
============================== */

app.patch(
  "/api/admin/rescuers/:id/reset-password",
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      const { newPassword } = req.body || {};

      const password = String(newPassword || "").trim();

      if (!password) {
        return res.status(400).json({
          message: "Mật khẩu mới không được để trống",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message: "Mật khẩu mới phải có ít nhất 6 ký tự",
        });
      }

      const [rescuerRows] = await db.query(
        `
        SELECT 
          rp.user_id,
          rp.full_name,
          u.id AS user_exists,
          u.role
        FROM rescuer_profile rp
        LEFT JOIN users u ON u.id = rp.user_id
        WHERE rp.user_id=?
        LIMIT 1
        `,
        [id],
      );

      if (rescuerRows.length === 0 || !rescuerRows[0].user_exists) {
        return res.status(404).json({
          message: "Không tìm thấy đội cứu hộ",
        });
      }

      if (rescuerRows[0].role !== "rescuer") {
        return res.status(400).json({
          message: "Tài khoản này không phải đội cứu hộ",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await db.query("UPDATE users SET password=? WHERE id=?", [
        hashedPassword,
        id,
      ]);

      const actor = await getActorSummary(req.user.id, req.user.role);
      const teamName = sanitizeText(rescuerRows[0].full_name, `Đội #${id}`);

      await logMultiNotification([
        {
          eventType: "admin_reset_rescuer_password",
          severity: "warning",
          title: `Admin đã đặt lại mật khẩu đội cứu hộ`,
          description: `${actor.actorName} đã đặt lại mật khẩu cho ${teamName}.`,
          actorUserId: Number(req.user.id),
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          recipientRole: "admin",
          recipientUserId: Number(req.user.id),
          metadata: {
            action: "reset_password",
            target_user_id: Number(id),
            target_name: teamName,
          },
        },
        {
          eventType: "rescuer_password_reset_by_admin",
          severity: "warning",
          title: `Mật khẩu của bạn đã được admin đặt lại`,
          description: `Admin vừa đặt lại mật khẩu cho tài khoản của bạn. Vui lòng đăng nhập lại bằng mật khẩu mới.`,
          actorUserId: Number(req.user.id),
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          recipientRole: "rescuer",
          recipientUserId: Number(id),
          metadata: {
            action: "reset_password",
          },
        },
      ]);

      res.json({
        message: "Đặt lại mật khẩu đội cứu hộ thành công",
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/* ==============================
   ADMIN CREATE RESCUER
============================== */

app.post("/api/admin/rescuers", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { email, password, full_name, phone, address } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Email không hợp lệ!" });
    }

    const [exist] = await db.query(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [normalizedEmail],
    );

    if (exist.length > 0) {
      return res
        .status(400)
        .json({ message: "Email đã được sử dụng. Vui lòng nhập email khác!" });
    }

    const [phoneExist] = await db.query(
      `
      SELECT user_id
      FROM (
        SELECT user_id, phone FROM user_profile
        UNION ALL
        SELECT user_id, phone FROM admin_profile
        UNION ALL
        SELECT user_id, phone FROM rescuer_profile
      ) AS profiles
      WHERE phone = ?
      LIMIT 1
      `,
      [phone],
    );

    if (phoneExist.length > 0) {
      return res.status(400).json({
        message: "Số điện thoại đã được sử dụng. Vui lòng nhập số khác!",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const [userRes] = await db.query(
      "INSERT INTO users (password, role, email, email_source) VALUES (?, ?, ?, ?)",
      [hash, "rescuer", normalizedEmail, "manual"],
    );

    const userId = userRes.insertId;

    await db.query(
      `INSERT INTO rescuer_profile 
      (user_id, full_name, phone, address, status, account_status)
      VALUES (?, ?, ?, ?, 'available', 'active')`,
      [userId, full_name, phone, address],
    );

    res.json({ message: "Tạo tài khoản rescuer thành công" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put(
  "/api/rescues/:id",
  authMiddleware,
  upload.fields([{ name: "images", maxCount: 2 }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const {
        name,
        phone,
        lat,
        lng,
        address,
        victims,
        note,
        source_url,
        sos_type,
        existingImages,
      } = req.body;

      const [rows] = await db.query("SELECT * FROM rescues WHERE id=?", [id]);

      if (rows.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu." });
      }

      const rescue = rows[0];

      if (Number(rescue.user_id) !== Number(userId)) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền cập nhật yêu cầu này." });
      }

      if (rescue.status === "cancel") {
        return res
          .status(400)
          .json({ message: "Yêu cầu đã bị hủy, không thể cập nhật." });
      }

      const allowedTypes = ["rescue", "supplies", "vehicle", "other"];
      let finalSosType = (sos_type || "").toString().trim().toLowerCase();

      if (!allowedTypes.includes(finalSosType)) {
        finalSosType = "other";
      }

      let oldImages = [];
      try {
        oldImages = rescue.images
          ? Array.isArray(rescue.images)
            ? rescue.images
            : JSON.parse(rescue.images)
          : [];
        if (!Array.isArray(oldImages)) oldImages = [];
      } catch {
        oldImages = [];
      }

      let keptImages = [];
      try {
        keptImages = existingImages ? JSON.parse(existingImages) : oldImages;
        if (!Array.isArray(keptImages)) keptImages = [];
      } catch {
        keptImages = oldImages;
      }

      const uploadedImages = (req.files?.images || []).map(
        (file) => "/uploads/" + file.filename,
      );

      const finalImagesArray = [...keptImages, ...uploadedImages].slice(0, 2);
      const finalImages = JSON.stringify(finalImagesArray);

      await db.query(
        `UPDATE rescues
         SET name=?,
             phone=?,
             lat=?,
             lng=?,
             address=?,
             victims=?,
             note=?,
             source_url=?,
             images=?,
             sos_type=?
         WHERE id=?`,
        [
          name,
          phone,
          lat,
          lng,
          address,
          victims,
          note,
          source_url,
          finalImages,
          finalSosType,
          id,
        ],
      );

      const removedImages = oldImages.filter(
        (img) => !finalImagesArray.includes(img),
      );

      for (const imgPath of removedImages) {
        try {
          const cleanPath = String(imgPath || "").replace(/^\/+/, "");
          const fullPath = path.join(__dirname, cleanPath);

          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (fileErr) {
          console.log("DELETE OLD IMAGE ERROR:", fileErr);
        }
      }

      const [updatedRows] = await db.query(
        `
        SELECT
          r.*,
          rp.lat AS rescuer_lat,
          rp.lng AS rescuer_lng,
          rp.full_name AS rescuer_name,
          rp.phone AS rescuer_phone,
          rp.status AS rescuer_status
        FROM rescues r
        LEFT JOIN rescuer_profile rp
          ON r.handled_by = rp.user_id
        WHERE r.id = ?
        LIMIT 1
        `,
        [id],
      );

      if (rescue.status === "rescuing" && rescue.handled_by) {
        const actor = await getActorSummary(userId, req.user.role);

        await logNotification({
          eventType: "rescuer_user_updated_assigned_sos",
          severity: "warning",
          title: `Người dân vừa cập nhật yêu cầu`,
          description: `Người dân vừa cập nhật yêu cầu SOS #${id} mà đội của bạn đang phụ trách.`,
          actorUserId: Number(userId),
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          rescueId: Number(id),
          recipientRole: "rescuer",
          recipientUserId: Number(rescue.handled_by),
          metadata: {
            action: "user_updated",
            address: sanitizeText(address),
            sos_type: finalSosType,
            victims: Number(victims) || 1,
          },
        });
      }

      res.json(updatedRows[0]);
    } catch (err) {
      console.log("UPDATE RESCUE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/* ==============================
   ADMIN - CITIZEN MANAGEMENT
============================== */

app.get(
  "/api/admin/citizen-stats",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN COALESCE(up.account_status, 'active') = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN COALESCE(up.account_status, 'active') <> 'active' THEN 1 ELSE 0 END) AS locked,
        SUM(CASE WHEN u.provider = 'facebook' THEN 1 ELSE 0 END) AS facebook,
        COALESCE(SUM((
          SELECT COUNT(*)
          FROM rescues r
          WHERE r.user_id = u.id
        )), 0) AS totalSos
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      WHERE u.role = 'user'
    `);

      res.json({
        total: Number(rows[0]?.total || 0),
        active: Number(rows[0]?.active || 0),
        locked: Number(rows[0]?.locked || 0),
        facebook: Number(rows[0]?.facebook || 0),
        totalSos: Number(rows[0]?.totalSos || 0),
      });
    } catch (err) {
      console.log("citizen-stats error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/admin/citizens-full",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT
        u.id AS user_id,
        CASE
          WHEN u.email_source = 'facebook_placeholder' THEN ''
          ELSE u.email
        END AS email,
        u.provider,
        u.email_source,
        u.avatar,
        u.created_at,
        CASE
          WHEN u.password IS NULL OR u.password = '' THEN 0
          ELSE 1
        END AS has_password,

        up.full_name,
        up.phone,
        up.address,
        up.lat,
        up.lng,
        COALESCE(up.account_status, 'active') AS account_status,

        COUNT(r.id) AS total_sos,
        SUM(CASE WHEN r.status IN ('new', 'rescuing') THEN 1 ELSE 0 END) AS active_sos,
        SUM(CASE WHEN r.status = 'done' THEN 1 ELSE 0 END) AS completed_sos,
        SUM(CASE WHEN r.status = 'cancel' THEN 1 ELSE 0 END) AS canceled_sos,
        MAX(r.created_at) AS last_sos_at
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      LEFT JOIN rescues r ON r.user_id = u.id
      WHERE u.role = 'user'
      GROUP BY
        u.id,
        u.email,
        u.provider,
        u.email_source,
        u.avatar,
        u.created_at,
        u.password,
        up.full_name,
        up.phone,
        up.address,
        up.lat,
        up.lng,
        up.account_status
      ORDER BY u.id DESC
    `);

      res.json(rows);
    } catch (err) {
      console.log("citizens-full error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/admin/citizens/:id/details",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const citizenId = Number(req.params.id);

      if (!citizenId) {
        return res
          .status(400)
          .json({ message: "Mã tài khoản dân cư không hợp lệ" });
      }

      const [profileRows] = await db.query(
        `
      SELECT
        u.id AS user_id,
        CASE
          WHEN u.email_source = 'facebook_placeholder' THEN ''
          ELSE u.email
        END AS email,
        u.provider,
        u.email_source,
        u.avatar,
        u.created_at,
        CASE
          WHEN u.password IS NULL OR u.password = '' THEN 0
          ELSE 1
        END AS has_password,

        up.full_name,
        up.phone,
        up.address,
        up.lat,
        up.lng,
        COALESCE(up.account_status, 'active') AS account_status,

        COUNT(r.id) AS total_sos,
        SUM(CASE WHEN r.status IN ('new', 'rescuing') THEN 1 ELSE 0 END) AS active_sos,
        SUM(CASE WHEN r.status = 'done' THEN 1 ELSE 0 END) AS completed_sos,
        SUM(CASE WHEN r.status = 'cancel' THEN 1 ELSE 0 END) AS canceled_sos,
        MAX(r.created_at) AS last_sos_at
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      LEFT JOIN rescues r ON r.user_id = u.id
      WHERE u.id = ?
        AND u.role = 'user'
      GROUP BY
        u.id,
        u.email,
        u.provider,
        u.email_source,
        u.avatar,
        u.created_at,
        u.password,
        up.full_name,
        up.phone,
        up.address,
        up.lat,
        up.lng,
        up.account_status
      LIMIT 1
      `,
        [citizenId],
      );

      if (profileRows.length === 0) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy tài khoản dân cư" });
      }

      const [historyRows] = await db.query(
        `
      SELECT
        r.id,
        r.name,
        r.phone,
        r.sos_type,
        r.status,
        r.address,
        r.victims,
        r.note,
        r.source_url,
        r.assigned_team,
        r.handled_by,
        rp.full_name AS handled_by_name,
        r.created_at,
        r.received_at,
        r.completed_at,
        r.lat,
        r.lng
      FROM rescues r
      LEFT JOIN rescuer_profile rp ON rp.user_id = r.handled_by
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC, r.id DESC
      `,
        [citizenId],
      );

      const summary = {
        total: historyRows.length,
        active: historyRows.filter((item) =>
          ["new", "rescuing"].includes(item.status),
        ).length,
        completed: historyRows.filter((item) => item.status === "done").length,
        canceled: historyRows.filter((item) => item.status === "cancel").length,
      };

      res.json({
        profile: profileRows[0],
        summary,
        history: historyRows,
      });
    } catch (err) {
      console.log("citizen-details error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.patch(
  "/api/admin/citizens/:id/toggle",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const citizenId = Number(req.params.id);
      const requestedStatus = sanitizeText(req.body?.nextStatus, "");

      const allowedStatuses = ["active", "inactive", "temporary_locked"];

      if (!citizenId) {
        return res
          .status(400)
          .json({ message: "Mã tài khoản dân cư không hợp lệ" });
      }

      const [rows] = await db.query(
        `
      SELECT
        u.id,
        u.role,
        u.email,
        up.full_name,
        COALESCE(up.account_status, 'active') AS account_status
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      WHERE u.id = ?
        AND u.role = 'user'
      LIMIT 1
      `,
        [citizenId],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy tài khoản dân cư" });
      }

      const currentStatus = sanitizeText(rows[0].account_status, "active");
      const newStatus = allowedStatuses.includes(requestedStatus)
        ? requestedStatus
        : currentStatus === "active"
          ? "inactive"
          : "active";

      if (newStatus === currentStatus) {
        return res.json({
          message: "Trạng thái tài khoản không thay đổi",
          status: newStatus,
        });
      }

      const [profileExists] = await db.query(
        "SELECT id FROM user_profile WHERE user_id=? LIMIT 1",
        [citizenId],
      );

      if (profileExists.length > 0) {
        await db.query(
          "UPDATE user_profile SET account_status=? WHERE user_id=?",
          [newStatus, citizenId],
        );
      } else {
        await db.query(
          `INSERT INTO user_profile (user_id, full_name, phone, address, account_status)
         VALUES (?, ?, NULL, '', ?)`,
          [citizenId, rows[0].email || `User #${citizenId}`, newStatus],
        );
      }

      const actor = await getActorSummary(req.user.id, req.user.role);
      const citizenName = sanitizeText(
        rows[0].full_name || rows[0].email,
        `User #${citizenId}`,
      );

      await logNotification({
        eventType:
          newStatus === "active"
            ? "citizen_account_reactivated"
            : newStatus === "temporary_locked"
              ? "citizen_account_temporary_locked"
              : "citizen_account_locked",
        severity: newStatus === "active" ? "success" : "warning",
        title:
          newStatus === "active"
            ? "Tài khoản dân cư đã được mở lại"
            : newStatus === "temporary_locked"
              ? "Tài khoản dân cư bị khóa tạm thời"
              : "Tài khoản dân cư đã bị khóa",
        description:
          newStatus === "active"
            ? "Admin đã mở lại tài khoản của bạn."
            : newStatus === "temporary_locked"
              ? "Admin đã khóa tạm thời tài khoản của bạn."
              : "Admin đã khóa tài khoản của bạn. Bạn sẽ không thể tiếp tục sử dụng hệ thống.",
        actorUserId: Number(req.user.id),
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        recipientRole: "user",
        recipientUserId: citizenId,
        metadata: {
          action: "citizen_account_status_changed",
          target_user_id: citizenId,
          target_name: citizenName,
          next_status: newStatus,
        },
      });

      res.json({
        message: "Cập nhật trạng thái tài khoản dân cư thành công",
        status: newStatus,
      });
    } catch (err) {
      console.log("citizen-toggle error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.patch(
  "/api/admin/citizens/:id/reset-password",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const citizenId = Number(req.params.id);
      const password = String(req.body?.newPassword || "").trim();

      if (!citizenId) {
        return res
          .status(400)
          .json({ message: "Mã tài khoản dân cư không hợp lệ" });
      }

      if (!password) {
        return res
          .status(400)
          .json({ message: "Mật khẩu mới không được để trống" });
      }

      if (password.length < 6) {
        return res
          .status(400)
          .json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
      }

      const [rows] = await db.query(
        `
      SELECT
        u.id,
        u.role,
        u.email,
        u.provider,
        up.full_name
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      WHERE u.id = ?
        AND u.role = 'user'
      LIMIT 1
      `,
        [citizenId],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy tài khoản dân cư" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await db.query("UPDATE users SET password=? WHERE id=?", [
        hashedPassword,
        citizenId,
      ]);

      const actor = await getActorSummary(req.user.id, req.user.role);
      const citizenName = sanitizeText(
        rows[0].full_name || rows[0].email,
        `User #${citizenId}`,
      );

      await logMultiNotification([
        {
          eventType: "admin_reset_citizen_password",
          severity: "warning",
          title: "Admin đã đặt lại mật khẩu dân cư",
          description: `${actor.actorName} đã đặt lại mật khẩu cho ${citizenName}.`,
          actorUserId: Number(req.user.id),
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          recipientRole: "admin",
          recipientUserId: Number(req.user.id),
          metadata: {
            action: "reset_password",
            target_user_id: citizenId,
            target_name: citizenName,
          },
        },
        {
          eventType: "citizen_password_reset_by_admin",
          severity: "warning",
          title: "Mật khẩu của bạn đã được admin đặt lại",
          description:
            "Admin vừa đặt lại mật khẩu cho tài khoản của bạn. Vui lòng đăng nhập lại bằng mật khẩu mới.",
          actorUserId: Number(req.user.id),
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          recipientRole: "user",
          recipientUserId: citizenId,
          metadata: {
            action: "reset_password",
          },
        },
      ]);

      res.json({ message: "Đặt lại mật khẩu dân cư thành công" });
    } catch (err) {
      console.log("citizen-reset-password error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.delete(
  "/api/admin/citizens/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const citizenId = Number(req.params.id);

      if (!citizenId) {
        return res
          .status(400)
          .json({ message: "Mã tài khoản dân cư không hợp lệ" });
      }

      const [rows] = await db.query(
        "SELECT id, role FROM users WHERE id=? AND role='user' LIMIT 1",
        [citizenId],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy tài khoản dân cư" });
      }

      await db.query("UPDATE rescues SET user_id=NULL WHERE user_id=?", [
        citizenId,
      ]);

      await db.query(
        "UPDATE notifications SET actor_user_id=NULL WHERE actor_user_id=?",
        [citizenId],
      );

      await db.query(
        "UPDATE notifications SET recipient_user_id=NULL WHERE recipient_user_id=?",
        [citizenId],
      );

      await db.query("DELETE FROM user_profile WHERE user_id=?", [citizenId]);
      await db.query("DELETE FROM users WHERE id=?", [citizenId]);

      res.json({ message: "Xóa tài khoản dân cư thành công" });
    } catch (err) {
      console.log("citizen-delete error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/* ==============================
   ANALYTICS ENDPOINTS
============================== */

app.get(
  "/api/analytics/sos-requests",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT
        id,
        name,
        phone,
        address,
        lat,
        lng,
        sos_type,
        status,
        handled_by,
        created_at,
        completed_at
      FROM rescues
      ORDER BY id DESC
      LIMIT 500
    `);

      const resolvedRows = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          province: await resolveProvinceName(row),
        })),
      );

      res.json(resolvedRows);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/analytics/sos-by-province",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT
        id,
        address,
        lat,
        lng,
        created_at
      FROM rescues
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY id DESC
      LIMIT 1000
    `);

      const provinceCount = new Map();

      for (const row of rows) {
        const province = await resolveProvinceName(row);
        provinceCount.set(province, (provinceCount.get(province) || 0) + 1);
      }

      const result = Array.from(provinceCount.entries())
        .map(([name, totalSos]) => ({ name, totalSos }))
        .sort((a, b) => b.totalSos - a.totalSos);

      res.json(result);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/analytics/rescue-teams",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT 
        COALESCE(r.handled_by, 0) as team_id,
        COALESCE(rp.full_name, CONCAT('Đội ', COALESCE(r.handled_by, 0))) as team_name,
        COUNT(*) as totalRescued,
        AVG(
          CASE
            WHEN r.created_at IS NOT NULL AND r.received_at IS NOT NULL
              THEN TIMESTAMPDIFF(MINUTE, r.created_at, r.received_at)
            ELSE NULL
          END
        ) as avgResponseTime
      FROM rescues r
      LEFT JOIN rescuer_profile rp ON r.handled_by = rp.user_id
      WHERE r.status IN ('done', 'completed')
        AND r.handled_by IS NOT NULL
        AND r.received_at IS NOT NULL
        AND r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY r.handled_by, rp.full_name
      ORDER BY totalRescued DESC
    `);

      res.json(rows);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/analytics/daily-stats",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT 
        DAYNAME(created_at) as day_name,
        DATE(created_at) as date,
        COUNT(*) as count
      FROM rescues
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at), DAYNAME(created_at)
      ORDER BY DATE(created_at) ASC
    `);

      res.json(rows);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/analytics/hourly-stats",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as count
      FROM rescues
      WHERE DATE(created_at) = CURDATE()
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `);

      res.json(rows);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/analytics/statistics",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [totalSos] = await db.query(`
      SELECT COUNT(*) as total FROM rescues WHERE DATE(created_at) = CURDATE()
    `);

      const [completed] = await db.query(`
      SELECT COUNT(*) as total FROM rescues WHERE status IN ('done', 'completed') AND DATE(created_at) = CURDATE()
    `);

      const [avgResponseTime] = await db.query(`
      SELECT AVG(
        CASE
          WHEN created_at IS NOT NULL AND received_at IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, created_at, received_at)
          ELSE NULL
        END
      ) as avg_time
      FROM rescues
      WHERE received_at IS NOT NULL AND DATE(created_at) = CURDATE()
    `);

      res.json({
        totalSos: totalSos[0]?.total || 0,
        completedSos: completed[0]?.total || 0,
        avgResponseTime: Math.round(avgResponseTime[0]?.avg_time || 0),
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

app.get(
  "/api/analytics/export-pdf",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [requestsRows] = await db.query(`
      SELECT
        id,
        name,
        phone,
        address,
        lat,
        lng,
        sos_type,
        status,
        handled_by,
        created_at,
        completed_at
      FROM rescues
      ORDER BY id DESC
      LIMIT 500
    `);

      const resolvedRequests = await Promise.all(
        requestsRows.map(async (row) => ({
          ...row,
          province: await resolveProvinceName(row),
        })),
      );

      const provinceCount = new Map();
      resolvedRequests.forEach((row) => {
        provinceCount.set(
          row.province,
          (provinceCount.get(row.province) || 0) + 1,
        );
      });

      const topAreasRows = Array.from(provinceCount.entries())
        .map(([area, totalSos]) => ({ area, totalSos }))
        .sort((a, b) => b.totalSos - a.totalSos)
        .slice(0, 4);

      const [statusRows] = await db.query(`
      SELECT
        SUM(CASE WHEN status IN ('done', 'completed') THEN 1 ELSE 0 END) AS completedCount,
        SUM(CASE WHEN status IN ('new', 'rescuing', 'assigned', 'pending') THEN 1 ELSE 0 END) AS notCompletedCount
      FROM rescues
    `);

      const [typeRows] = await db.query(`
      SELECT
        LOWER(COALESCE(NULLIF(TRIM(sos_type), ''), 'other')) AS type,
        COUNT(*) AS total
      FROM rescues
      GROUP BY LOWER(COALESCE(NULLIF(TRIM(sos_type), ''), 'other'))
      ORDER BY total DESC
    `);

      const [teamRows] = await db.query(`
      SELECT
        r.handled_by,
        COALESCE(rp.full_name, CONCAT('Đội ', r.handled_by)) AS team_name,
        COUNT(*) AS successCount
      FROM rescues r
      LEFT JOIN rescuer_profile rp ON r.handled_by = rp.user_id
      WHERE r.handled_by IS NOT NULL
        AND r.status IN ('done', 'completed')
      GROUP BY r.handled_by, rp.full_name
      ORDER BY successCount DESC
    `);

      const safeText = (value) => {
        if (value === null || value === undefined) return "";
        return String(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D");
      };

      const formatType = (type) => {
        const t = (type || "").toString().toLowerCase();
        if (t === "rescue") return "Cuu ho khan cap";
        if (t === "supplies") return "Nhu yeu pham";
        if (t === "vehicle") return "Cuu ho xe";
        return "Khac";
      };

      const formatStatus = (status) => {
        const s = (status || "").toString().toLowerCase();
        if (s === "done" || s === "completed") return "Hoan thanh";
        if (s === "rescuing" || s === "assigned") return "Dang xu ly";
        return "Chua xu ly";
      };

      const hm = (value) => {
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        const hh = `${d.getHours()}`.padStart(2, "0");
        const mm = `${d.getMinutes()}`.padStart(2, "0");
        const dd = `${d.getDate()}`.padStart(2, "0");
        const mo = `${d.getMonth() + 1}`.padStart(2, "0");
        const yy = d.getFullYear();
        return `${hh}:${mm} ${dd}/${mo}/${yy}`;
      };

      const totalSos = resolvedRequests.length;
      const completedCount = Number(statusRows?.[0]?.completedCount || 0);
      const notCompletedCount = Number(statusRows?.[0]?.notCompletedCount || 0);

      const now = new Date();
      const dateTag = `${`${now.getDate()}`.padStart(2, "0")}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${now.getFullYear()}`;
      const filename = `bao-cao-sos-${dateTag}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 40,
        info: {
          Title: "Bao cao SOS",
          Author: "FRRP Analytics",
        },
      });

      doc.pipe(res);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const usableWidth =
        pageWidth - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const topStartY = 106;

      const drawPageHeader = () => {
        doc.rect(0, 0, pageWidth, 86).fill("#0f172a");
        doc
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(20)
          .text("BAO CAO TONG HOP SOS", left, 24);
        doc
          .fillColor("#cbd5e1")
          .font("Helvetica")
          .fontSize(10)
          .text(`Ngay xuat: ${hm(new Date())}`, left, 50)
          .text(`Nguon du lieu: He thong FRRP`, left + 220, 50);
        doc.y = topStartY;
      };

      const ensureSpace = (needed = 28) => {
        if (doc.y + needed > pageHeight - doc.page.margins.bottom - 16) {
          doc.addPage();
        }
      };

      const drawSectionTitle = (title) => {
        ensureSpace(34);
        const y = doc.y + 4;
        doc.roundedRect(left, y, usableWidth, 24, 6).fill("#e2e8f0");
        doc
          .fillColor("#0f172a")
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(safeText(title), left + 10, y + 7);
        doc.y = y + 30;
      };

      const summaryCard = (x, y, w, h, title, value, color, subValue) => {
        doc.roundedRect(x, y, w, h, 8).fillAndStroke("#f8fafc", "#cbd5e1");
        doc
          .fillColor("#475569")
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(safeText(title), x + 10, y + 10, { width: w - 20 });
        doc
          .fillColor(color)
          .font("Helvetica-Bold")
          .fontSize(24)
          .text(String(value), x + 10, y + 28, { width: w - 20 });
        if (subValue) {
          doc
            .fillColor("#64748b")
            .font("Helvetica")
            .fontSize(8)
            .text(safeText(subValue), x + 10, y + 58, { width: w - 20 });
        }
      };

      const drawTable = (headers, rows, colWidths, opts = {}) => {
        const rowHeight = opts.rowHeight || 20;
        const headerHeight = 24;

        const drawHeaderRow = () => {
          const yHeader = doc.y;
          doc.rect(left, yHeader, usableWidth, headerHeight).fill("#cbd5e1");
          doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9);

          let x = left;
          headers.forEach((h, i) => {
            doc.text(safeText(h), x + 6, yHeader + 7, {
              width: colWidths[i] - 12,
              ellipsis: true,
              lineBreak: false,
            });
            x += colWidths[i];
          });
          doc.y = yHeader + headerHeight;
        };

        ensureSpace(headerHeight + rowHeight + 4);
        drawHeaderRow();

        rows.forEach((row, idx) => {
          ensureSpace(rowHeight + 2);
          if (doc.y + rowHeight > pageHeight - doc.page.margins.bottom - 16) {
            doc.addPage();
            drawHeaderRow();
          }

          const y = doc.y;
          const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
          doc.rect(left, y, usableWidth, rowHeight).fill(bg);

          let x = left;
          row.forEach((cell, i) => {
            const align =
              i === 0 && opts.firstColCenter
                ? "center"
                : i === row.length - 1 && opts.lastColRight
                  ? "right"
                  : "left";

            doc
              .fillColor("#0f172a")
              .font("Helvetica")
              .fontSize(8)
              .text(safeText(cell), x + 6, y + 6, {
                width: colWidths[i] - 12,
                ellipsis: true,
                lineBreak: false,
                align,
              });
            x += colWidths[i];
          });

          doc.y = y + rowHeight;
        });

        doc.moveDown(0.6);
      };

      doc.on("pageAdded", drawPageHeader);
      drawPageHeader();

      drawSectionTitle("1) Tong quan SOS");
      const cardY = doc.y;
      const gap = 10;
      const cardW = (usableWidth - gap * 2) / 3;
      const completionRate =
        totalSos > 0 ? Math.round((completedCount / totalSos) * 100) : 0;
      summaryCard(
        left,
        cardY,
        cardW,
        78,
        "Tong so SOS",
        `${totalSos}`,
        "#1d4ed8",
        "Tat ca yeu cau ghi nhan",
      );
      summaryCard(
        left + cardW + gap,
        cardY,
        cardW,
        78,
        "Da hoan thanh",
        `${completedCount}`,
        "#059669",
        `${completionRate}% ty le hoan thanh`,
      );
      summaryCard(
        left + (cardW + gap) * 2,
        cardY,
        cardW,
        78,
        "Chua hoan thanh",
        `${notCompletedCount}`,
        "#dc2626",
        "Can tiep tuc xu ly",
      );
      doc.y = cardY + 88;

      drawSectionTitle("2) Top 4 khu vuc co SOS cao nhat");
      drawTable(
        ["STT", "Khu vuc", "So luong SOS"],
        topAreasRows.map((r, i) => [
          i + 1,
          r.area || "Chua xac dinh",
          Number(r.totalSos || 0),
        ]),
        [60, usableWidth - 200, 140],
        { firstColCenter: true, lastColRight: true },
      );

      drawSectionTitle("3) Phan loai yeu cau");
      drawTable(
        ["Loai yeu cau", "So luong"],
        typeRows.map((r) => [formatType(r.type), Number(r.total || 0)]),
        [usableWidth - 140, 140],
        { lastColRight: true },
      );

      drawSectionTitle("4) So luong SOS doi cuu ho da hoan thanh");
      drawTable(
        ["Doi cuu ho", "SOS thanh cong"],
        teamRows.map((r) => [
          r.team_name || `Doi ${r.handled_by}`,
          Number(r.successCount || 0),
        ]),
        [usableWidth - 140, 140],
        { lastColRight: true },
      );

      drawSectionTitle("5) Danh sach day du SOS");
      drawTable(
        ["ID", "Thoi gian", "Nguoi gui", "Loai", "Trang thai", "Khu vuc"],
        resolvedRequests.map((r) => [
          r.id,
          hm(r.created_at),
          safeText(r.name || ""),
          formatType(r.sos_type),
          formatStatus(r.status),
          safeText(r.province || "Chua xac dinh"),
        ]),
        [45, 145, 180, 150, 120, usableWidth - 640],
        { firstColCenter: true },
      );

      ensureSpace(30);
      doc
        .moveTo(left, doc.y + 4)
        .lineTo(right, doc.y + 4)
        .strokeColor("#cbd5e1")
        .stroke();

      doc
        .fillColor("#64748b")
        .font("Helvetica")
        .fontSize(8)
        .text("Bao cao tu dong tao boi he thong FRRP", left, doc.y + 10, {
          width: usableWidth,
          align: "right",
        });

      doc.end();
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Export PDF failed" });
    }
  },
);

/* ==============================
   DỰ BÁO THỜI TIẾT
============================== */

app.get("/api/weather", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Thiếu hoặc sai lat/lng" });
    }

    const getWeatherText = (code) => {
      const c = Number(code || 0);

      if (c >= 95) return "Dông mạnh";
      if (c >= 80) return "Mưa rào";
      if (c >= 61) return "Mưa";
      if (c >= 51) return "Mưa nhỏ";
      if (c >= 45) return "Sương mù";
      if (c >= 3) return "Nhiều mây";
      if (c >= 1) return "Ít mây";
      return "Trời quang";
    };

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lng}` +
      `&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m` +
      `&timezone=Asia%2FHo_Chi_Minh` +
      `&forecast_days=2`;

    const response = await axios.get(url);
    const data = response.data;

    const times = data?.hourly?.time || [];
    const temps = data?.hourly?.temperature_2m || [];
    const rains = data?.hourly?.precipitation || [];
    const rainProbs = data?.hourly?.precipitation_probability || [];
    const winds = data?.hourly?.wind_speed_10m || [];
    const weatherCodes = data?.hourly?.weather_code || [];

    const current = data?.current || {};
    const currentHourKey = current?.time
      ? String(current.time).slice(0, 13)
      : "";

    let startIndex = times.findIndex(
      (time) => String(time).slice(0, 13) === currentHourKey,
    );

    if (startIndex < 0) {
      const now = Date.now();
      startIndex = times.findIndex(
        (time) => new Date(time).getTime() >= now - 60 * 60 * 1000,
      );
    }

    if (startIndex < 0) startIndex = 0;

    const hourly12 = times
      .slice(startIndex, startIndex + 12)
      .map((time, idx) => {
        const realIndex = startIndex + idx;
        const weatherCode = Number(weatherCodes[realIndex] ?? 0);

        return {
          time,
          hour: new Date(time).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          temperature: Number(temps[realIndex] ?? 0),
          rain: Number(rains[realIndex] ?? 0),
          rainProbability: Number(rainProbs[realIndex] ?? 0),
          windSpeed: Number(winds[realIndex] ?? 0),
          weatherCode,
          weatherText: getWeatherText(weatherCode),
        };
      });

    const firstHour = hourly12[0] || {};

    const currentWeather = {
      time: current.time || firstHour.time || new Date().toISOString(),
      temperature: Math.round(
        Number(current.temperature_2m ?? firstHour.temperature ?? 0),
      ),
      rain: Number(current.precipitation ?? firstHour.rain ?? 0),
      rainProbability: Number(firstHour.rainProbability ?? 0),
      windSpeed: Number(current.wind_speed_10m ?? firstHour.windSpeed ?? 0),
      weatherCode: Number(current.weather_code ?? firstHour.weatherCode ?? 0),
      weatherText: getWeatherText(
        current.weather_code ?? firstHour.weatherCode ?? 0,
      ),
    };

    const totalRain = hourly12.reduce(
      (sum, item) => sum + Number(item.rain || 0),
      0,
    );
    const maxRainProbability = hourly12.length
      ? Math.max(...hourly12.map((item) => Number(item.rainProbability || 0)))
      : 0;
    const maxWind = hourly12.length
      ? Math.max(...hourly12.map((item) => Number(item.windSpeed || 0)))
      : 0;

    const avgTemp = hourly12.length
      ? Math.round(
          hourly12.reduce(
            (sum, item) => sum + Number(item.temperature || 0),
            0,
          ) / hourly12.length,
        )
      : currentWeather.temperature;

    const riskScore =
      (maxRainProbability >= 70 ? 35 : maxRainProbability >= 40 ? 20 : 5) +
      (totalRain >= 20 ? 35 : totalRain >= 8 ? 20 : 5) +
      (maxWind >= 40 ? 20 : maxWind >= 25 ? 10 : 0);

    let riskLabel = "Tương đối an toàn";
    if (riskScore >= 70) riskLabel = "Nguy cơ cao";
    else if (riskScore >= 40) riskLabel = "Cần chú ý";

    return res.json({
      current: currentWeather,
      hourly12,

      temperature: currentWeather.temperature || avgTemp,
      rain: Number(totalRain.toFixed(1)),
      rainProbability: Number(maxRainProbability.toFixed(0)),
      windSpeed: Number(maxWind.toFixed(1)),
      weatherCode: currentWeather.weatherCode,
      weatherText: currentWeather.weatherText,
      riskScore,
      riskLabel,
      updatedAt: new Date().toLocaleString("vi-VN"),
    });
  } catch (error) {
    console.error("Weather API error:", error?.response?.data || error.message);

    res.status(500).json({
      message: "Không lấy được dữ liệu thời tiết",
      current: null,
      hourly12: [],
      temperature: 0,
      rain: 0,
      rainProbability: 0,
      windSpeed: 0,
      riskLabel: "Không lấy được dữ liệu",
      weatherText: "",
      updatedAt: new Date().toLocaleString("vi-VN"),
    });
  }
});

/* ==============================
   AI GỢI Ý AN TOÀN - GROQ
============================== */

function buildSafetyAdviceFallback(context = {}) {
  const weather = context.weather || {};
  const stats = context.stats || {};

  const rainProbability = Number(weather.rainProbability || 0);
  const rain = Number(weather.rain || 0);
  const windSpeed = Number(weather.windSpeed || 0);

  const sosLastHour = Number(stats.sosLastHour || 0);
  const waiting = Number(stats.waiting || 0);
  const rescuing = Number(stats.rescuing || 0);

  const manySos = sosLastHour >= 2 || waiting + rescuing >= 3;

  if (rainProbability >= 70 || rain >= 10 || manySos) {
    return {
      level: "high",
      title: "Cần chú ý cao trong vài giờ tới",
      message:
        "Khu vực đang có dấu hiệu rủi ro tăng do thời tiết hoặc số lượng yêu cầu SOS. Người dân nên hạn chế di chuyển và chuẩn bị phương án liên lạc khẩn cấp.",
      tips: [
        "Tránh đi qua khu vực trũng thấp, ven sông hoặc nơi nước chảy xiết.",
        "Sạc đầy điện thoại, chuẩn bị pin dự phòng, nước uống và đèn pin.",
        "Gửi SOS sớm nếu nước dâng nhanh, có người mắc kẹt hoặc cần hỗ trợ khẩn cấp.",
      ],
      reasons: [
        `Xác suất mưa khoảng ${Math.round(rainProbability)}%.`,
        `Lượng mưa dự báo khoảng ${rain} mm.`,
        `Hiện có ${waiting} yêu cầu chờ tiếp nhận và ${rescuing} yêu cầu đang cứu hộ.`,
      ],
      actionNow: "Ưu tiên ở nơi cao, giữ liên lạc và theo dõi bản đồ SOS.",
      confidence: 0.72,
      source: "rule_fallback",
    };
  }

  if (rainProbability >= 40 || windSpeed >= 25) {
    return {
      level: "medium",
      title: "Nên theo dõi thời tiết sát hơn",
      message:
        "Thời tiết có dấu hiệu bất ổn nhẹ. Bạn nên chuẩn bị trước vật dụng thiết yếu và hạn chế di chuyển xa.",
      tips: [
        "Giữ điện thoại luôn có pin và bật âm báo.",
        "Chuẩn bị áo mưa, giấy tờ quan trọng và đồ dùng y tế cơ bản.",
        "Theo dõi bản đồ SOS để tránh khu vực đang có cứu hộ.",
      ],
      reasons: [
        `Xác suất mưa khoảng ${Math.round(rainProbability)}%.`,
        `Tốc độ gió khoảng ${Math.round(windSpeed)} km/h.`,
      ],
      actionNow: "Kiểm tra lại vị trí an toàn và thông báo cho người thân.",
      confidence: 0.66,
      source: "rule_fallback",
    };
  }

  return {
    level: "low",
    title: "Tình hình hiện tại tương đối ổn định",
    message:
      "Chưa ghi nhận dấu hiệu nguy hiểm rõ rệt, nhưng bạn vẫn nên theo dõi cập nhật vì thời tiết có thể thay đổi.",
    tips: [
      "Theo dõi dự báo thời tiết định kỳ.",
      "Chuẩn bị sẵn vật dụng cần thiết phòng trường hợp thời tiết xấu.",
      "Giữ liên lạc với người thân khi có mưa lớn kéo dài.",
    ],
    reasons: [
      `Xác suất mưa khoảng ${Math.round(rainProbability)}%.`,
      `Tốc độ gió khoảng ${Math.round(windSpeed)} km/h.`,
    ],
    actionNow: "Tiếp tục theo dõi thời tiết và bản đồ SOS.",
    confidence: 0.6,
    source: "rule_fallback",
  };
}

function safeParseAiJson(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (error) {
    const match = String(rawText || "").match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeGroqSafetyAdvice(data, fallback) {
  const safeLevel =
    data?.level === "high" || data?.level === "medium" || data?.level === "low"
      ? data.level
      : fallback.level;

  return {
    level: safeLevel,
    title: data?.title || fallback.title,
    message: data?.message || fallback.message,
    tips:
      Array.isArray(data?.tips) && data.tips.length > 0
        ? data.tips.slice(0, 3)
        : fallback.tips,
    reasons:
      Array.isArray(data?.reasons) && data.reasons.length > 0
        ? data.reasons.slice(0, 3)
        : fallback.reasons,
    actionNow: data?.actionNow || fallback.actionNow,
    confidence:
      typeof data?.confidence === "number"
        ? Math.max(0, Math.min(1, data.confidence))
        : fallback.confidence,
    source: "groq",
  };
}

app.post("/api/ai/safety-advice", async (req, res) => {
  const context = req.body || {};
  const fallback = buildSafetyAdviceFallback(context);

  try {
    if (!process.env.GROQ_API_KEY) {
      return res.json({
        ...fallback,
        source: "rule_fallback",
        note: "Chưa cấu hình GROQ_API_KEY nên hệ thống đang dùng gợi ý dự phòng.",
      });
    }

    const groqResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 700,
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý AI an toàn thiên tai cho hệ thống FRRCP tại Việt Nam. Nhiệm vụ của bạn là phân tích dữ liệu thời tiết, vị trí và tình trạng SOS để đưa ra khuyến nghị an toàn ngắn gọn, thực tế, không gây hoang mang. Không bịa dữ liệu. Không thay thế chỉ đạo của cơ quan chức năng. Chỉ trả về JSON hợp lệ, không markdown.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Tạo gợi ý an toàn cho trang chủ người dùng. Trả về đúng JSON với các field: level, title, message, tips, reasons, actionNow, confidence.",
              outputSchema: {
                level: "low | medium | high",
                title: "string",
                message: "string",
                tips: ["string", "string", "string"],
                reasons: ["string", "string", "string"],
                actionNow: "string",
                confidence: "number từ 0 đến 1",
              },
              context,
            }),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 12000,
      },
    );

    const content = groqResponse.data?.choices?.[0]?.message?.content;
    const parsed = safeParseAiJson(content);

    if (!parsed) {
      return res.json({
        ...fallback,
        source: "rule_fallback",
        note: "Groq trả về dữ liệu không đúng JSON, hệ thống dùng gợi ý dự phòng.",
      });
    }

    const result = normalizeGroqSafetyAdvice(parsed, fallback);

    return res.json(result);
  } catch (error) {
    console.error(
      "Groq safety advice error:",
      error?.response?.data || error.message,
    );

    return res.json({
      ...fallback,
      source: "rule_fallback",
      note: "Groq AI tạm thời không phản hồi, hệ thống dùng gợi ý dự phòng.",
    });
  }
});

// ================================================================
// ROUTE LẤY TIN TỨC THỜI TIẾT & THIÊN TAI (REAL-TIME RSS)
// ================================================================

// ================================================================
// HƯỚNG DẪN ÁP DỤNG:
// Mở file server.js, tìm dòng bắt đầu bằng:
//   const xml2js = require("xml2js");
// Chọn từ dòng đó xuống đến cuối hàm app.get("/api/weather-news", ...)
// (khoảng line 5819 → 6130 trong server.js gốc)
// Xóa toàn bộ đoạn đó và thay bằng nội dung bên dưới.
// ================================================================

const xml2js = require("xml2js");

// ----------------------------------------------------------------
// DANH SÁCH NGUỒN RSS TRỰC TIẾP TỪ BÁO VIỆT NAM
// Tất cả đều trả về link bài gốc → click thẳng đến bài báo
// ----------------------------------------------------------------
const RSS_FEEDS = [
  // ===== VnExpress =====
  {
    url: "https://vnexpress.net/rss/thoi-su.rss",
    source: "VnExpress",
    forceCategory: null,
  },
  {
    url: "https://vnexpress.net/rss/tin-moi-nhat.rss",
    source: "VnExpress",
    forceCategory: null,
  },

  // ===== Tuổi Trẻ =====
  {
    url: "https://tuoitre.vn/rss/tin-moi-nhat.rss",
    source: "Tuổi Trẻ",
    forceCategory: null,
  },
  {
    url: "https://tuoitre.vn/rss/thoi-su.rss",
    source: "Tuổi Trẻ",
    forceCategory: null,
  },

  // ===== Thanh Niên =====
  {
    url: "https://thanhnien.vn/rss/home.rss",
    source: "Thanh Niên",
    forceCategory: null,
  },

  // ===== Người Lao Động =====
  {
    url: "https://nld.com.vn/rss/thoi-su.rss",
    source: "Người Lao Động",
    forceCategory: null,
  },

  // ===== Dân Trí =====
  // {
  //   url: "https://dantri.com.vn/Sukien.rss",
  //   source: "Dân Trí",
  //   forceCategory: null,
  // },

  // ===== Zing News =====
  {
    url: "https://znews.vn/rss/thoi-su.rss",
    source: "Zing News",
    forceCategory: null,
  },

  // ===== VietnamNet =====
  {
    url: "https://vietnamnet.vn/rss/thoi-su.rss",
    source: "VietnamNet",
    forceCategory: null,
  },
];

// ----------------------------------------------------------------
// TỪ KHÓA LỌC — chỉ giữ tin liên quan thời tiết / thiên tai
// ----------------------------------------------------------------
const WEATHER_KEYWORDS = [
  "bão",
  "áp thấp",
  "lốc xoáy",
  "lốc",
  "gió mạnh",
  "gió giật",
  "lũ",
  "lụt",
  "ngập",
  "nước dâng",
  "triều cường",
  "lũ quét",
  "sạt lở",
  "sạt",
  "sụt lún",
  "đất đá",
  "đất lở",
  "núi lở",
  "hạn hán",
  "khô hạn",
  "nắng nóng",
  "nắng hạn",
  "thiếu nước",
  "thời tiết",
  "mưa lớn",
  "mưa rào",
  "mưa đá",
  "giông",
  "giông sét",
  "sương mù",
  "lạnh",
  "rét",
  "rét đậm",
  "rét hại",
  "băng giá",
  "thiên tai",
  "cảnh báo",
  "dự báo",
  "khí tượng",
  "thủy văn",
  "nchmf",
  "động đất",
  "sóng thần",
  "tsunami",
  "phòng chống thiên tai",
  "cứu hộ",
  "cứu nạn",
  "sơ tán",
  "El Nino",
  "La Nina",
  "biến đổi khí hậu",
  "gió mạnh sóng lớn",
  "sóng biển",
  "biển động",
  "mưa lũ",
  "lũ lụt",
  "ngập lụt",
  "ngập úng",
  "mưa ngập",
];

function isWeatherRelated(title, description) {
  const text = (title + " " + description).toLowerCase();
  return WEATHER_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

// ----------------------------------------------------------------
// PHÂN LOẠI TIN THEO TỪ KHÓA
// ----------------------------------------------------------------
function classifyNews(title, description) {
  const text = (title + " " + description).toLowerCase();

  if (
    text.includes("bão") ||
    text.includes("áp thấp nhiệt đới") ||
    text.includes("áp thấp") ||
    text.includes("lốc xoáy") ||
    text.includes("lốc") ||
    text.includes("gió giật cấp") ||
    text.includes("gió mạnh sóng lớn") ||
    text.includes("sóng lớn trên biển")
  )
    return "bao";

  if (
    text.includes("lũ quét") ||
    text.includes("lũ lụt") ||
    text.includes("lụt") ||
    text.includes("ngập lụt") ||
    text.includes("ngập úng") ||
    text.includes("ngập") ||
    text.includes("nước dâng") ||
    text.includes("triều cường") ||
    text.includes("mưa lũ") ||
    text.includes("lũ")
  )
    return "lu";

  if (
    text.includes("sạt lở") ||
    text.includes("sạt") ||
    text.includes("sụt lún") ||
    text.includes("đất đá") ||
    text.includes("đất lở") ||
    text.includes("núi lở") ||
    text.includes("taluy")
  )
    return "sat_lo";

  if (
    text.includes("hạn hán") ||
    text.includes("khô hạn") ||
    text.includes("nắng nóng") ||
    text.includes("nắng hạn") ||
    text.includes("thiếu nước") ||
    text.includes("el nino")
  )
    return "nang_han";

  return "thoi_tiet";
}

// ----------------------------------------------------------------
// LẤY URL THẬT — Nguồn trực tiếp nên không cần follow redirect
// ----------------------------------------------------------------
function extractRealUrl(item) {
  // Thử lấy link từ các field phổ biến trong RSS
  const raw = String(
    (typeof item.link === "object" ? item.link._ : item.link) ||
      item.guid ||
      "",
  ).trim();

  if (!raw) return null;

  // Loại bỏ các query tracking không cần thiết nếu muốn
  // Nhưng giữ nguyên link gốc là OK
  return raw;
}

// ----------------------------------------------------------------
// CACHE — 5 phút
// ----------------------------------------------------------------
let newsCache = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 phút

async function fetchRSSNews() {
  const now = Date.now();
  if (newsCache.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return newsCache;
  }

  const rawItems = [];
  const parser = new xml2js.Parser({ explicitArray: false });

  // Fetch tất cả feeds song song
  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const response = await axios.get(feed.url, {
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; FRRCP-Bot/1.0; +https://frrcp.vn)",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
        });
        const result = await parser.parseStringPromise(response.data);
        const items = result?.rss?.channel?.item || [];
        const itemList = Array.isArray(items) ? items : [items];
        itemList.slice(0, 20).forEach((item) => {
          rawItems.push({ item, feed });
        });
      } catch (err) {
        console.error(
          `[RSS] Lỗi fetch ${feed.source} (${feed.url.slice(0, 60)}...): ${err.message}`,
        );
      }
    }),
  );

  const allNews = [];
  const seenUrls = new Set();

  for (const { item, feed } of rawItems) {
    const title = String(item.title || "").trim();
    const description = item.description
      ? String(item.description)
          .replace(/<[^>]+>/g, "")
          .trim()
      : "";
    const publishedAt = item.pubDate
      ? new Date(item.pubDate).toISOString()
      : new Date().toISOString();

    if (!title) continue;

    // Lọc tin không liên quan thời tiết / thiên tai
    if (!isWeatherRelated(title, description)) continue;

    const url = extractRealUrl(item);
    if (!url) continue;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    allNews.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description: description.slice(0, 350),
      url,
      source: feed.source,
      publishedAt,
      category: feed.forceCategory || classifyNews(title, description),
    });
  }

  // Sắp xếp mới nhất lên trên
  allNews.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const trimmed = allNews.slice(0, 60);
  newsCache = trimmed;
  lastFetchTime = now;

  console.log(
    `[RSS] Đã tải ${trimmed.length} tin thời tiết/thiên tai từ báo VN - ${new Date().toLocaleTimeString("vi-VN")}`,
  );
  return trimmed;
}

// Warm-up: tải tin ngay khi server khởi động
setTimeout(() => {
  fetchRSSNews().catch((err) =>
    console.error("[RSS] Warm-up failed:", err.message),
  );
}, 3000);

// API endpoint — hỗ trợ lọc theo category
app.get("/api/weather-news", async (req, res) => {
  try {
    let news = await fetchRSSNews();

    const { category } = req.query;
    if (category && category !== "all") {
      news = news.filter((n) => n.category === category);
    }

    res.json(news);
  } catch (err) {
    console.error("[weather-news] Lỗi:", err);
    res.status(500).json({ error: "Không thể lấy tin tức" });
  }
});
/* ==============================
   SERVER START
============================== */

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await ensureUsersEmailColumn();
    await ensureUsersFacebookEmailColumn();
    await ensureUsersEmailSourceColumn();
    await ensureUserProfileAccountStatusColumn();
    await ensureEmailVerificationTable();
    await ensureChangeEmailVerificationTable();
    await ensurePasswordResetVerificationTable();
    await initNotificationsTable();

    app.listen(PORT, () => {
      console.log("🚀 Server running on port", PORT);
    });
  } catch (error) {
    console.error("[server] Startup failed:", error);
    process.exit(1);
  }
};

startServer();
