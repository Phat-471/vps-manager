const express = require('express');
const router = express.Router();
const ScriptController = require('../controllers/ScriptController');

router.post('/run', ScriptController.runScript);

module.exports = router;
