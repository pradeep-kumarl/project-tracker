const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ dest: 'uploads/' });

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

// TAB 1 — Manually assign a task
router.post('/assign', async (req, res) => {
  const { employee_code, name, email, task_name, start_date, deadline, remarks } = req.body;
  try {
    // create employee if not exists
    await db.query(
      `INSERT INTO employees (employee_code, name, email)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email)`,
      [employee_code, name, email]
    );
    const [[emp]] = await db.query(
      `SELECT id FROM employees WHERE employee_code = ?`, [employee_code]
    );
    const [result] = await db.query(
      `INSERT INTO tasks (employee_id, task_name, start_date, assigned_date, deadline, remarks)
       VALUES (?, ?, ?, CURDATE(), ?, ?)`,
      [emp.id, task_name, start_date || null, deadline, remarks || null]
    );

    // Auto-send email notification if valid email exists
    let mailSent = false;
    if (email && email.includes('@')) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: `New Task Assigned: "${task_name}"`,
          text: `Hi ${name},\n\nA new task "${task_name}" has been assigned to you.\nDeadline: ${deadline}\nRemarks: ${remarks || 'None'}\n\nPlease check your Project Tracker portal.\n\nThank you,\nProject Tracker Team`
        });
        await db.query(`UPDATE tasks SET email_sent = TRUE WHERE id = ?`, [result.insertId]);
        mailSent = true;
      } catch (mailErr) {
        console.log('Auto-email notice:', mailErr.message);
      }
    }

    res.json({ success: true, emailSent: mailSent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TAB 1 — Bulk assign via xlsx upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);
    for (const row of rows) {
      await db.query(
        `INSERT INTO employees (employee_code, name, email)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email)`,
        [row.employee_code, row.name, row.email]
      );
      const [[emp]] = await db.query(
        `SELECT id FROM employees WHERE employee_code = ?`, [row.employee_code]
      );
      await db.query(
        `INSERT INTO tasks (employee_id, task_name, start_date, assigned_date, deadline, remarks)
         VALUES (?, ?, ?, CURDATE(), ?, ?)`,
        [emp.id, row.task_name, row.start_date || null, row.deadline, row.remarks || null]
      );
    }
    res.json({ success: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TAB 2 — Upcoming deadlines
router.get('/upcoming', async (req, res) => {
  try {
    const { fromDate, toDate, date } = req.query;
    let sql = `SELECT t.id, e.name, e.email, t.task_name, DATE_FORMAT(t.deadline, '%Y-%m-%d') AS deadline, t.remarks
       FROM tasks t JOIN employees e ON t.employee_id = e.id
       WHERE t.status = 'pending'`;
    const params = [];

    if (fromDate && toDate) {
      sql += ` AND t.deadline BETWEEN ? AND ?`;
      params.push(fromDate, toDate);
    } else if (fromDate) {
      sql += ` AND t.deadline >= ?`;
      params.push(fromDate);
    } else if (toDate) {
      sql += ` AND t.deadline <= ?`;
      params.push(toDate);
    } else if (date) {
      sql += ` AND t.deadline = ?`;
      params.push(date);
    } else {
      sql += ` AND t.deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)`;
    }
    sql += ` ORDER BY t.deadline ASC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TAB 3 — Completed tasks
router.get('/completed', async (req, res) => {
  try {
    const { fromDate, toDate, date } = req.query;
    let sql = `SELECT t.id, e.name, e.email, t.task_name, DATE_FORMAT(t.deadline, '%Y-%m-%d') AS deadline, DATE_FORMAT(t.completed_at, '%Y-%m-%d %H:%i') AS completed_at, t.remarks
       FROM tasks t JOIN employees e ON t.employee_id = e.id
       WHERE t.status = 'completed'`;
    const params = [];

    if (fromDate && toDate) {
      sql += ` AND (DATE(t.completed_at) BETWEEN ? AND ? OR t.deadline BETWEEN ? AND ?)`;
      params.push(fromDate, toDate, fromDate, toDate);
    } else if (fromDate) {
      sql += ` AND (DATE(t.completed_at) >= ? OR t.deadline >= ?)`;
      params.push(fromDate, fromDate);
    } else if (toDate) {
      sql += ` AND (DATE(t.completed_at) <= ? OR t.deadline <= ?)`;
      params.push(toDate, toDate);
    } else if (date) {
      sql += ` AND (DATE(t.completed_at) = ? OR t.deadline = ?)`;
      params.push(date, date);
    }
    sql += ` ORDER BY t.completed_at DESC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TAB 4 — Missed deadlines
router.get('/missed', async (req, res) => {
  try {
    const { fromDate, toDate, date } = req.query;
    let sql = `SELECT t.id, e.name, e.email, t.task_name, DATE_FORMAT(t.deadline, '%Y-%m-%d') AS deadline, t.remarks
       FROM tasks t JOIN employees e ON t.employee_id = e.id
       WHERE (t.status = 'missed' OR (t.status = 'pending' AND t.deadline < CURDATE()))`;
    const params = [];

    if (fromDate && toDate) {
      sql += ` AND t.deadline BETWEEN ? AND ?`;
      params.push(fromDate, toDate);
    } else if (fromDate) {
      sql += ` AND t.deadline >= ?`;
      params.push(fromDate);
    } else if (toDate) {
      sql += ` AND t.deadline <= ?`;
      params.push(toDate);
    } else if (date) {
      sql += ` AND t.deadline = ?`;
      params.push(date);
    }
    sql += ` ORDER BY t.deadline ASC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a task completed
router.post('/:id/complete', async (req, res) => {
  try {
    await db.query(
      `UPDATE tasks SET status='completed', completed_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a task missed
router.post('/:id/miss', async (req, res) => {
  try {
    await db.query(
      `UPDATE tasks SET status='missed' WHERE id=?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;