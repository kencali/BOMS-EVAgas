<?php
require_once __DIR__ . '/../helpers/response.php';
setJsonHeaders();
sendSuccess(['message' => 'Logged out successfully.']);