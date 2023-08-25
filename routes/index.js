const express = require("express");
const router = express.Router();

/*
 * Setup routes for index
 */
router.get("/", (req, res) => {
  res.render("index");
});

module.exports = router;
