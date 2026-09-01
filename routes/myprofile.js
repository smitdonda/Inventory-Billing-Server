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
 * One company profile per account, which the unique index on `user` enforces.
 * POST upserts it rather than creating a second document the app would never
 * read.
 */
router.post("/", async (req, res, next) => {
  try {
    const values = pickBody(req.body);
    if (!values.companyname) {
      return res
        .status(422)
        .json({ success: false, message: "Company name is required" });
    }

    const existing = await MyProfile.findOne({ user: req.user._id });
    const profile = existing
      ? await MyProfile.findOneAndUpdate(
          { _id: existing._id, user: req.user._id },
          { $set: values },
          { new: true, runValidators: true }
        )
      : await MyProfile.create({ ...values, user: req.user._id });

    res.status(existing ? 200 : 201).json({
      success: true,
      data: profile,
      message: "My profile data saved successfully",
    });
  } catch (error) {
    // A racing first save trips the unique index on `user`.
    if (error?.code === 11000) {
      const profile = await MyProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: pickBody(req.body) },
        { new: true, runValidators: true }
      );
      return res.json({
        success: true,
        data: profile,
        message: "My profile data saved successfully",
      });
    }
    next(error);
  }
});

/* Still an array, because that is the shape the client reads (profile[0]). */
router.get("/", async (req, res, next) => {
  try {
    const profile = await MyProfile.find({ user: req.user._id }).limit(1);
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
    const profile = await MyProfile.findOneAndUpdate(
      { _id: id, user: req.user._id },
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
