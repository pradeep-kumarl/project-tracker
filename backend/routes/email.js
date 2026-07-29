const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const db = require('../config/db');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

router.post('/send/:taskId', async (req, res) => {
  try {
    const [[task]] = await db.query(
      `SELECT t.task_name, DATE_FORMAT(t.deadline, '%Y-%m-%d') AS deadline, e.name, e.email
       FROM tasks t JOIN employees e ON t.employee_id = e.id
       WHERE t.id = ?`, [req.params.taskId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Send to custom email if passed in req.body.email, otherwise send to employee's entered email
    const recipientEmail = (req.body && req.body.email) ? req.body.email : task.email;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid recipient email address' });
    }

    let simulated = false;
    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER || 'demo@projecttracker.com',
        to: recipientEmail,
        subject: `Task Reminder: "${task.task_name}"`,
        text: `Hi ${task.name},\n\nYour task "${task.task_name}" is due on ${task.deadline}.\n\nPlease ensure it is completed on time.\n\nThank you,\nProject Tracker Team`
      });
    } catch (mailErr) {
      console.log('SMTP login failed (demo mode active), simulated email to:', recipientEmail);
      simulated = true;
    }

    await db.query(`UPDATE tasks SET email_sent = TRUE WHERE id = ?`, [req.params.taskId]);
    res.json({ success: true, sentTo: recipientEmail, simulated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;