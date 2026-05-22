require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Product = require("./models/Product.js");

const app = express();

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

mongoose.connect(process.env.MONGO_URI)

.then(() => {

  console.log("MongoDB Atlas Connected");

})

.catch(err => {

  console.log("Mongo Error:", err);

});



/* =========================
   MULTER STORAGE
========================= */

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, "uploads");

  },

  filename: (req, file, cb) => {

    cb(
      null,
      Date.now() + "-" + file.originalname
    );

  }

});

const upload = multer({
  storage
});



/* =========================
   CREATE PRODUCT
========================= */

app.post(

  "/api/products",

  upload.single("image"),

  async (req, res) => {

    try {

      if (!req.file) {

        return res
        .status(400)
        .json({
          success: false,
          message: "No image uploaded"
        });

      }

      const product = new Product({

        title: req.body.title,

        description: req.body.description,

        price: req.body.price,

        sizes: req.body.sizes,

        section: req.body.section,

        image: "/uploads/" + req.file.filename

      });

      await product.save();

      res.json({

        success: true,
        message: "Uploaded successfully"

      });

    }

    catch (err) {

      console.log(err);

      res.status(500).json({

        success: false

      });

    }

  }

);



/* =========================
   GET ALL PRODUCTS
========================= */

app.get(

  "/api/products",

  async (req, res) => {

    try {

      const products = await Product.find()
      .sort({ _id: -1 });

      res.json(products);

    }

    catch (err) {

      res.status(500).json(err);

    }

  }

);



/* =========================
   DELETE PRODUCT
========================= */

app.delete(

  "/api/products/:id",

  async (req, res) => {

    try {

      const product = await Product.findById(req.params.id);

      if (!product) {

        return res.status(404).json({

          success: false,
          message: "Product not found"

        });

      }

      /* DELETE IMAGE FILE */

      const imagePath = path.join(
        __dirname,
        product.image
      );

      if (fs.existsSync(imagePath)) {

        fs.unlinkSync(imagePath);

      }

      /* DELETE FROM DATABASE */

      await Product.findByIdAndDelete(req.params.id);

      res.json({

        success: true,
        message: "Deleted successfully"

      });

    }

    catch (err) {

      console.log(err);

      res.status(500).json({

        success: false

      });

    }

  }

);



const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Running on ${PORT}`);
});
