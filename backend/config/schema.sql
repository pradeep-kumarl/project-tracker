CREATE DATABASE IF NOT EXISTS project_tracker;
USE project_tracker;

CREATE TABLE employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  start_date DATE NULL,
  assigned_date DATE NOT NULL,
  deadline DATE NOT NULL,
  remarks TEXT NULL,
  status ENUM('pending','completed') DEFAULT 'pending',
  completed_at DATETIME NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);