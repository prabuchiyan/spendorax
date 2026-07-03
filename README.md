# 💰 Money Management App – Technical Specification

## 📌 Overview
A single-user, offline-first mobile application to manage:
- Income
- Expenses
- Budgets
- Bills
- Multiple money sources

---

## 🏗️ Tech Stack
- React Native (Expo)
- SQLite (expo-sqlite)
- React Navigation

---

## 🧱 Data Model

### Categories
- id (PK)
- name
- type (income / expense)
- icon
- is_active
- created_at

### Sources
- id (PK)
- name
- type
- initial_balance
- is_active

### Transactions (Core)
- id (PK)
- type (income / expense)
- amount
- category_id (FK)
- source_id (FK)
- date
- notes
- bill_id (optional)
- created_at

### Budgets
- id
- category_id (optional)
- monthly_limit
- month (YYYY-MM)

### Bills
- id
- name
- amount
- due_date
- is_recurring
- recurrence_type
- category_id
- is_paid
- linked_transaction_id

---

## 🔄 Business Logic

### Balance Calculation
Balance = Initial Balance + Income - Expenses

### Budget Calculation
Remaining Budget = Monthly Limit - Expenses

### Bill Payment
- Mark bill as paid
- Create expense transaction
- Link transaction to bill

---

## 📱 Features

### Categories
- Add / Edit / Delete (soft delete)

### Sources
- Manage accounts
- Show computed balance

### Transactions
- Add / Edit / Delete
- Filter & search

### Budgets
- Monthly tracking
- Highlight exceeded

### Bills
- Add / Edit / Delete
- Recurring bills
- Mark as paid

---

## 📊 Reports
- Total balance
- Category-wise spending
- Monthly trends

---

## 📂 Folder Structure
```
/src
  /components
  /screens
  /database
  /services
  /utils
```

---

## ⚠️ Rules
- Do NOT store balance
- Always calculate dynamically
- Maintain relational integrity