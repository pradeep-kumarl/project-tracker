const API = 'http://localhost:5000/api';

function showTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) {
    btn.classList.add('active');
  } else if (window.event && window.event.target) {
    window.event.target.classList.add('active');
  }
  if (id === 'upcoming') loadUpcoming();
  if (id === 'completed') loadCompleted();
  if (id === 'missed') loadMissed();
}

document.getElementById('assignForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    from_email: document.getElementById('from_email').value,
    employee_code: document.getElementById('employee_code').value,
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    task_name: document.getElementById('task_name').value,
    start_date: document.getElementById('start_date').value,
    deadline: document.getElementById('deadline').value,
    remarks: document.getElementById('remarks').value
  };
  await fetch(`${API}/tasks/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  alert('Task assigned!');
  e.target.reset();
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  const res = await fetch(`${API}/tasks/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  alert(`Uploaded ${data.count} tasks!`);
});

async function loadUpcoming() {
  const fromDate = document.getElementById('upcomingFromDate')?.value;
  const toDate = document.getElementById('upcomingToDate')?.value;
  let query = [];
  if (fromDate) query.push(`fromDate=${fromDate}`);
  if (toDate) query.push(`toDate=${toDate}`);
  const url = query.length ? `${API}/tasks/upcoming?${query.join('&')}` : `${API}/tasks/upcoming`;
  const res = await fetch(url);
  const rows = await res.json();
  document.getElementById('upcomingBody').innerHTML = rows.map(r => `
    <tr>
      <td>${r.name || ''}</td>
      <td>${r.email || ''}</td>
      <td>${r.task_name || ''}</td>
      <td>${r.deadline || ''}</td>
      <td>${r.remarks || ''}</td>
      <td>
        <button class="secondary-btn" style="width:125px; padding:6px 10px; margin-bottom:4px;" onclick="sendEmail(${r.id})">Send Email</button><br>
        <button style="width:125px; padding:6px 10px; background:#10b981; margin-bottom:4px;" onclick="markComplete(${r.id})">Mark Complete</button><br>
        <button style="width:125px; padding:6px 10px; background:#ef4444;" onclick="markMissed(${r.id})">Missed Deadline</button>
      </td>
    </tr>`).join('');
}

async function markComplete(taskId) {
  await fetch(`${API}/tasks/${taskId}/complete`, { method: 'POST' });
  alert('Task marked as completed!');
  loadUpcoming();
  loadCompleted();
}

async function markMissed(taskId) {
  await fetch(`${API}/tasks/${taskId}/miss`, { method: 'POST' });
  alert('Task marked as missed deadline!');
  loadUpcoming();
  loadMissed();
}

async function loadCompleted() {
  const fromDate = document.getElementById('completedFromDate')?.value;
  const toDate = document.getElementById('completedToDate')?.value;
  let query = [];
  if (fromDate) query.push(`fromDate=${fromDate}`);
  if (toDate) query.push(`toDate=${toDate}`);
  const url = query.length ? `${API}/tasks/completed?${query.join('&')}` : `${API}/tasks/completed`;
  const res = await fetch(url);
  const rows = await res.json();
  document.getElementById('completedBody').innerHTML = rows.map(r => `
    <tr>
      <td>${r.name || ''}</td>
      <td>${r.email || ''}</td>
      <td>${r.task_name || ''}</td>
      <td>${r.deadline || ''}</td>
      <td>${r.completed_at || ''}</td>
      <td>${r.remarks || ''}</td>
    </tr>`
  ).join('');
}

async function loadMissed() {
  const fromDate = document.getElementById('missedFromDate')?.value;
  const toDate = document.getElementById('missedToDate')?.value;
  let query = [];
  if (fromDate) query.push(`fromDate=${fromDate}`);
  if (toDate) query.push(`toDate=${toDate}`);
  const url = query.length ? `${API}/tasks/missed?${query.join('&')}` : `${API}/tasks/missed`;
  const res = await fetch(url);
  const rows = await res.json();
  document.getElementById('missedBody').innerHTML = rows.map(r => `
    <tr>
      <td>${r.name || ''}</td>
      <td>${r.email || ''}</td>
      <td>${r.task_name || ''}</td>
      <td>${r.deadline || ''}</td>
      <td>${r.remarks || ''}</td>
    </tr>`
  ).join('');
}

async function sendEmail(taskId) {
  try {
    const res = await fetch(`${API}/email/send/${taskId}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      alert('Email sent successfully!');
    } else {
      alert(`Email failed: ${data.error || 'Check SMTP credentials in backend/.env'}`);
    }
  } catch (err) {
    alert('Email service error. Please check SMTP configuration.');
  }
}

function printReport(tabId) {
  window.print();
}