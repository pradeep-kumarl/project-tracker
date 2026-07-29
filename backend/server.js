const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Project Tracker Backend API is running' });
});

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/email', require('./routes/email'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));