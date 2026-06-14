const express = require('express');
const router = express.Router();
const MySQLController = require('../controllers/MySQLController');

router.post('/databases', MySQLController.listDatabases);
router.post('/users', MySQLController.listUsers);

// Add database
router.post('/add-db', MySQLController.addDatabase);
router.post('/databases/add', MySQLController.addDatabase);

// Add user
router.post('/add-user', MySQLController.addUser);
router.post('/users/add', MySQLController.addUser);

// Delete database
router.post('/delete-db', MySQLController.deleteDatabase);
router.post('/databases/delete', MySQLController.deleteDatabase);

// Delete user
router.post('/delete-user', MySQLController.deleteUser);
router.post('/users/delete', MySQLController.deleteUser);

router.post('/tables', MySQLController.getTables);
router.post('/export', MySQLController.exportDatabase);
router.post('/import', MySQLController.importDatabase);
router.post('/repair-system', MySQLController.repairSystem);

// Privilege Management & Password Change (Phase 5)
router.post('/users/grants', MySQLController.getUserPrivileges);
router.post('/users/grant', MySQLController.grantPrivileges);
router.post('/users/change-password', MySQLController.changePassword);

module.exports = router;
