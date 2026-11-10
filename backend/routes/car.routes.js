const express = require("express");
const router = express.Router();
const Car = require("../models/car.model");

router.get("/", async (req, res) => {
try {
    const { location, maxPrice } = req.query;
    let filter = {};

    if (location) filter.location = new RegExp(location, "i");
    if (maxPrice) filter.price = { $lte: Number(maxPrice) };

    const cars = await Car.find(filter);
    res.json({ cars });
} catch (err) {
    res.status(500).json({ error: "Server error fetching cars" });
}
});

router.post("/", async (req, res) => {
try {
    const newCar = new Car(req.body);
    await newCar.save();
    res.status(201).json(newCar);
} catch (err) {
    res.status(400).json({ error: "Couldn't add car. Try again." });
}
});

module.exports = router;
