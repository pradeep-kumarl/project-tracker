const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: (process.env.DB_HOST && process.env.DB_HOST !== 'mysql') ? process.env.DB_HOST : 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'project_tracker',
  waitForConnections: true,
  connectionLimit: 10
});

// In-memory fallback data store for testing when MySQL service is not running locally
const memoryStore = {
  employees: [],
  tasks: [],
  nextEmpId: 1,
  nextTaskId: 1
};

async function query(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return handleMemoryQuery(sql, params);
    }
    throw err;
  }
}

function handleMemoryQuery(sql, params) {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  // 1. Employee INSERT / UPSERT
  if (cleanSql.toUpperCase().includes('INSERT INTO EMPLOYEES')) {
    const [code, name, email] = params;
    let emp = memoryStore.employees.find(e => e.employee_code === code);
    if (emp) {
      emp.name = name;
      emp.email = email;
    } else {
      emp = { id: memoryStore.nextEmpId++, employee_code: code, name, email };
      memoryStore.employees.push(emp);
    }
    return [{ insertId: emp.id }];
  }

  // 2. Employee SELECT by code
  if (cleanSql.toUpperCase().includes('SELECT ID FROM EMPLOYEES WHERE EMPLOYEE_CODE')) {
    const [code] = params;
    const emp = memoryStore.employees.find(e => e.employee_code === code);
    return [[emp ? { id: emp.id } : null]];
  }

  // 3. Task INSERT
  if (cleanSql.toUpperCase().includes('INSERT INTO TASKS')) {
    const [employee_id, task_name, start_date, deadline, remarks] = params;
    const task = {
      id: memoryStore.nextTaskId++,
      employee_id,
      task_name,
      start_date,
      assigned_date: new Date().toISOString().split('T')[0],
      deadline,
      remarks,
      status: 'pending',
      completed_at: null,
      email_sent: false
    };
    memoryStore.tasks.push(task);
    return [{ insertId: task.id }];
  }

  // 4. Task UPDATE status complete or missed
  if (cleanSql.toUpperCase().includes("STATUS='COMPLETED'")) {
    const [id] = params;
    const task = memoryStore.tasks.find(t => t.id == id);
    if (task) {
      task.status = 'completed';
      const now = new Date();
      task.completed_at = now.toISOString().replace('T', ' ').substring(0, 16);
    }
    return [{ affectedRows: task ? 1 : 0 }];
  }

  if (cleanSql.toUpperCase().includes("STATUS='MISSED'")) {
    const [id] = params;
    const task = memoryStore.tasks.find(t => t.id == id);
    if (task) {
      task.status = 'missed';
    }
    return [{ affectedRows: task ? 1 : 0 }];
  }

  // 5. Task UPDATE email_sent
  if (cleanSql.toUpperCase().includes('UPDATE TASKS SET EMAIL_SENT')) {
    const [id] = params;
    const task = memoryStore.tasks.find(t => t.id == id);
    if (task) task.email_sent = true;
    return [{ affectedRows: task ? 1 : 0 }];
  }

  // 6. SELECT single task for email
  if (cleanSql.toUpperCase().includes('WHERE T.ID = ?')) {
    const [id] = params;
    const task = memoryStore.tasks.find(t => t.id == id);
    if (!task) return [[]];
    const emp = memoryStore.employees.find(e => e.id == task.employee_id) || {};
    return [[{
      task_name: task.task_name,
      deadline: task.deadline,
      name: emp.name || '',
      email: emp.email || ''
    }]];
  }

  // 7. SELECT Upcoming, Completed, Missed
  const today = new Date().toISOString().split('T')[0];

  let results = memoryStore.tasks.map(t => {
    const emp = memoryStore.employees.find(e => e.id == t.employee_id) || {};
    return {
      id: t.id,
      name: emp.name || '',
      email: emp.email || '',
      task_name: t.task_name,
      deadline: t.deadline,
      status: t.status,
      completed_at: t.completed_at,
      remarks: t.remarks
    };
  });

  if (cleanSql.toUpperCase().includes("STATUS = 'COMPLETED'")) {
    results = results.filter(r => r.status === 'completed');
    if (params.length >= 2) {
      const from = params[0];
      const to = params[1];
      results = results.filter(r => {
        const compDate = r.completed_at ? r.completed_at.substring(0, 10) : null;
        return (r.deadline >= from && r.deadline <= to) || (compDate && compDate >= from && compDate <= to);
      });
    } else if (params.length === 1) {
      const targetDate = params[0];
      if (cleanSql.includes('>=')) {
        results = results.filter(r => r.deadline >= targetDate || (r.completed_at && r.completed_at.substring(0, 10) >= targetDate));
      } else if (cleanSql.includes('<=')) {
        results = results.filter(r => r.deadline <= targetDate || (r.completed_at && r.completed_at.substring(0, 10) <= targetDate));
      } else {
        results = results.filter(r => r.deadline === targetDate || (r.completed_at && r.completed_at.startsWith(targetDate)));
      }
    }
  } else if (cleanSql.toUpperCase().includes("DEADLINE < CURDATE()") || cleanSql.toUpperCase().includes("STATUS = 'MISSED'")) {
    results = results.filter(r => r.status === 'missed' || (r.status === 'pending' && r.deadline < today));
    if (params.length >= 2) {
      const [from, to] = params;
      results = results.filter(r => r.deadline >= from && r.deadline <= to);
    } else if (params.length === 1) {
      const targetDate = params[0];
      if (cleanSql.includes('>=')) {
        results = results.filter(r => r.deadline >= targetDate);
      } else if (cleanSql.includes('<=')) {
        results = results.filter(r => r.deadline <= targetDate);
      } else {
        results = results.filter(r => r.deadline === targetDate);
      }
    }
  } else if (cleanSql.toUpperCase().includes("STATUS = 'PENDING'")) {
    results = results.filter(r => r.status === 'pending');
    if (params.length >= 2) {
      const [from, to] = params;
      results = results.filter(r => r.deadline >= from && r.deadline <= to);
    } else if (params.length === 1) {
      const targetDate = params[0];
      if (cleanSql.includes('>=')) {
        results = results.filter(r => r.deadline >= targetDate);
      } else if (cleanSql.includes('<=')) {
        results = results.filter(r => r.deadline <= targetDate);
      } else {
        results = results.filter(r => r.deadline === targetDate);
      }
    } else {
      const date2 = new Date();
      date2.setDate(date2.getDate() + 2);
      const limitDate = date2.toISOString().split('T')[0];
      results = results.filter(r => r.deadline >= today && r.deadline <= limitDate);
    }
  }

  return [results];
}

module.exports = { pool, query };