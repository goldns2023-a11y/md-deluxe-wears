require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const AWS = require("aws-sdk");

const Product = require("./models/Product.js");

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   MONGODB
========================= */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("Mongo Error:", err));

/* =========================
   AWS S3 CONFIG (SDK v2)
========================= */

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/* =========================
   MULTER (memory storage)
========================= */

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =========================
   CREATE PRODUCT (UPLOAD TO S3)
========================= */

app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded"
      });
    }

    const fileName = Date.now() + "-" + req.file.originalname;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read"
    };

    const uploadResult = await s3.upload(params).promise();

    const product = new Product({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      sizes: req.body.sizes,
      section: req.body.section,
      image: uploadResult.Location // FULL S3 URL
    });

    await product.save();

    res.json({
      success: true,
      message: "Uploaded successfully"
    });

  } catch (err) {
    console.log("Upload Error:", err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   GET ALL PRODUCTS
========================= */

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json(err);
  }
});

/* =========================
   DELETE PRODUCT (REMOVE FROM S3 + DB)
========================= */

app.delete("/api/products/:id", async (req, res) => {
  try {

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    /* =========================
       FIXED S3 DELETE LOGIC
    ========================= */

    const imageUrl = product.image;

    // extract filename safely
    const urlParts = imageUrl.split("/");
    const Key = urlParts[urlParts.length - 1];

    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: Key
    }).promise();

    /* DELETE FROM DATABASE */

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Deleted successfully"
    });

  } catch (err) {
    console.log("Delete Error:", err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Running on ${PORT}`);
});
