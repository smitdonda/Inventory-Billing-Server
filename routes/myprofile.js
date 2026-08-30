const express = require("express");
const router = express.Router();
const MyProfile = require("../models/myprofile");
const { isIDGood } = require("../utils/isIDGood");
const { requireAuth } = require("../config/requireAuth");

router.use(requireAuth);

const FIELDS = [
  "companyname",
  "cemail",
  "address",
  "city",
  "state",
  "country",
  "pinno",
  "phone",
];

const pickBody = (body = {}) =>
  Object.fromEntries(
    FIELDS.filter((field) => body[field] !== undefined).map((field) => [
      field,
      String(body[field]),
    ])
  );

/*
 * The app only ever reads profile[0], so creating a second document would
 * silently strand the data. POST upserts the single company profile instead.
 */
router.post("/", async (req, res, next) => {
  try {
    const values = pickBody(req.body);
    if (!values.companyname) {
      return res
        .status(422)
        .json({ success: false, message: "Company name is required" });
    }

    const existing = await MyProfile.findOne();
    const profile = existing
      ? await MyProfile.findByIdAndUpdate(
          existing._id,
          { $set: values },
          { new: true, runValidators: true }
        )
      : await MyProfile.create(values);

    res.status(existing ? 200 : 201).json({
      success: true,
      data: profile,
      message: "My profile data saved successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const profile = await MyProfile.find().limit(1);
    res.json({
      success: true,
      profile,
      message: "My profile data successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const profile = await MyProfile.findByIdAndUpdate(
      id,
      { $set: pickBody(req.body) },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({
      success: true,
      profile,
      message: "My profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
